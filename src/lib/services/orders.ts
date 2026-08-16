import { randomBytes } from "node:crypto";
import {
  FulfillmentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  WalletDirection,
  WalletTxnType,
  type Order,
} from "@prisma/client";
import { prisma } from "../db";
import { ApiError } from "../api";
import { computeShares, getPaymentProvider, resolveSplitConfiguration } from "../payments";
import { enqueueFulfillment, runFulfillment } from "../fulfillment";
import { applyPromotion } from "./promotions";
import { notify } from "./notifications";
import { runInBackground } from "../background";

export function generateReference(): string {
  return `SH-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export interface CreateOrderInput {
  customerId: string;
  bundlePublicId: string;
  recipientPhone: string;
  promoCode?: string;
  paymentMethod: PaymentMethod;
}

/**
 * Creates a PENDING order. Every price is read from the database here — the
 * client sends only a bundle id, a recipient, and an optional promo code.
 * The full bundle/network state is snapshotted so later price edits can never
 * rewrite what this customer was charged.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const bundle = await prisma.bundle.findUnique({
    where: { publicId: input.bundlePublicId },
    include: { network: true },
  });

  if (!bundle || bundle.deletedAt || !bundle.isActive) {
    throw new ApiError("This bundle is not available.", 422);
  }
  if (!bundle.network.isActive || bundle.network.deletedAt) {
    throw new ApiError("This network is not available right now.", 422);
  }

  const baseAmount = bundle.sellingPrice; // Authoritative price.
  let discountAmount = 0;
  let promotionId: string | null = null;

  if (input.promoCode) {
    const applied = await applyPromotion(input.promoCode, input.customerId, baseAmount);
    discountAmount = applied.discountAmount;
    promotionId = applied.promotion.id;
  }

  const finalAmount = baseAmount - discountAmount;
  await assertPurchaseLimits(finalAmount);

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        reference: generateReference(),
        customerId: input.customerId,
        bundleId: bundle.id,
        networkId: bundle.networkId,
        networkNameSnapshot: bundle.network.name,
        bundleNameSnapshot: bundle.name,
        dataAmountSnapshot: bundle.dataAmount,
        dataUnitSnapshot: bundle.dataUnit,
        validityDaysSnapshot: bundle.validityDays,
        sellingPriceSnapshot: bundle.sellingPrice,
        costPriceSnapshot: bundle.costPrice,
        providerCodeSnapshot: bundle.providerCode,
        recipientPhone: input.recipientPhone,
        discountAmount,
        finalAmount,
        promotionId,
        paymentMethod: input.paymentMethod,
        paymentStatus: PaymentStatus.PENDING,
        fulfillmentStatus: FulfillmentStatus.PENDING,
        status: OrderStatus.PENDING,
      },
    });

    if (promotionId) {
      await tx.promotionUsage.create({
        data: { promotionId, userId: input.customerId, orderId: order.id, amountOff: discountAmount },
      });
      await tx.promotion.update({
        where: { id: promotionId },
        data: { usageCount: { increment: 1 } },
      });
    }

    return order;
  });
}

/** Starts a Paystack checkout for a pending order and records the payment row. */
export async function initializePayment(order: Order, email: string) {
  if (order.paymentStatus === PaymentStatus.PAID) {
    throw new ApiError("This order has already been paid.", 409);
  }

  const split = await resolveSplitConfiguration();
  const shares = computeShares(order.finalAmount, split);
  const provider = getPaymentProvider();

  const result = await provider.initializeTransaction({
    reference: order.reference,
    amount: order.finalAmount,
    currency: order.currency,
    email,
    callbackUrl: `${appUrl()}/orders/${order.publicId}/callback`,
    metadata: { orderPublicId: order.publicId, customerId: order.customerId },
    split,
  });

  await prisma.payment.upsert({
    where: { providerReference: order.reference },
    create: {
      orderId: order.id,
      customerId: order.customerId,
      provider: provider.name,
      providerReference: order.reference,
      amount: order.finalAmount,
      currency: order.currency,
      status: PaymentStatus.PENDING,
      splitMode: split.mode,
      subaccountCode: split.subaccountCode ?? null,
      platformShare: shares.platformShare,
      subaccountShare: shares.subaccountShare,
      splitConfigId: split.splitConfigId ?? null,
    },
    update: { status: PaymentStatus.PENDING },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus: PaymentStatus.PROCESSING },
  });

  return result;
}

/**
 * The single trusted path from "customer says they paid" to "data is queued".
 * Always re-verifies against the provider and is safe to call repeatedly —
 * webhook redeliveries, callback refreshes and manual admin checks all land
 * here and only the first successful run queues a fulfillment.
 */
export async function verifyAndSettle(reference: string): Promise<{
  paid: boolean;
  order: Order | null;
}> {
  const order = await prisma.order.findUnique({ where: { reference } });
  if (!order) return { paid: false, order: null };

  // Already settled — return without re-queuing anything.
  if (order.paymentStatus === PaymentStatus.PAID) {
    return { paid: true, order };
  }

  const verification = await getPaymentProvider().verifyTransaction(reference);

  if (!verification.success) {
    if (verification.status === "failed" || verification.status === "abandoned") {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: PaymentStatus.FAILED,
            status: OrderStatus.FAILED,
            failureReason: "Payment was not completed",
          },
        }),
        prisma.payment.updateMany({
          where: { providerReference: reference },
          data: { status: PaymentStatus.FAILED, providerResponse: verification.raw as object },
        }),
      ]);
      await notify(order.customerId, {
        type: "PAYMENT_FAILED",
        title: "Payment failed",
        body: "Your payment could not be completed. Please try again.",
        metadata: { orderId: order.publicId },
      });
    }
    return { paid: false, order };
  }

  // Guard against an underpaid or tampered transaction.
  if (verification.amount < order.finalAmount || verification.currency !== order.currency) {
    console.error(
      "[payments] amount mismatch on %s: charged %d %s, expected %d %s",
      reference,
      verification.amount,
      verification.currency,
      order.finalAmount,
      order.currency,
    );
    await prisma.order.update({
      where: { id: order.id },
      data: { failureReason: "Payment amount mismatch — under review" },
    });
    return { paid: false, order };
  }

  // Conditional update = the idempotency latch. Exactly one caller can move
  // the order out of the unpaid state, so exactly one queues fulfillment.
  const claimed = await prisma.order.updateMany({
    where: { id: order.id, paymentStatus: { not: PaymentStatus.PAID } },
    data: { paymentStatus: PaymentStatus.PAID, status: OrderStatus.PROCESSING },
  });

  await prisma.payment.updateMany({
    where: { providerReference: reference },
    data: {
      status: PaymentStatus.PAID,
      providerTransactionId: verification.providerTransactionId,
      channel: verification.channel,
      feesAmount: verification.fees,
      providerResponse: verification.raw as object,
      verifiedAt: new Date(),
    },
  });

  const settled = await prisma.order.findUnique({ where: { id: order.id } });

  if (claimed.count === 1) {
    await notify(order.customerId, {
      type: "PAYMENT_SUCCESSFUL",
      title: "Payment received",
      body: `We received ${order.currency} ${(order.finalAmount / 100).toFixed(2)} for ${order.bundleNameSnapshot}.`,
      metadata: { orderId: order.publicId },
    });
    const fulfillmentId = await enqueueFulfillment(order.id);
    if (fulfillmentId) {
      // Delivery runs outside the customer's request path, but must survive
      // the response on serverless — see runInBackground.
      runInBackground("fulfillment", () => runFulfillment(fulfillmentId));
    }
  }

  return { paid: true, order: settled };
}

/**
 * Wallet checkout.
 *
 * The debit is a single conditional update (`balance >= amount`), which MongoDB
 * applies atomically to the wallet document — concurrent debits cannot oversell
 * the balance even without a transaction. The surrounding $transaction keeps the
 * ledger entry and order update consistent with that debit, and requires the
 * deployment to be a replica set.
 */
export async function payFromWallet(order: Order): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: order.customerId } });
      if (!wallet) throw new ApiError("You do not have a wallet yet.", 422);
      if (wallet.isLocked) throw new ApiError("Your wallet is locked. Contact support.", 403);

      // Conditional decrement: concurrent debits cannot oversell the balance.
      const debited = await tx.wallet.updateMany({
        where: { id: wallet.id, balance: { gte: order.finalAmount } },
        data: { balance: { decrement: order.finalAmount } },
      });
      if (debited.count === 0) throw new ApiError("Insufficient wallet balance.", 422);

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTxnType.PURCHASE,
          direction: WalletDirection.DEBIT,
          amount: order.finalAmount,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance - order.finalAmount,
          description: `Purchase: ${order.bundleNameSnapshot}`,
          orderId: order.id,
          // Unique per order — a replayed wallet debit violates this constraint.
          reference: `wal_${order.reference}`,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: PaymentStatus.PAID, status: OrderStatus.PROCESSING },
      });
    },
    // MongoDB does not expose SQL isolation levels; the conditional update above
    // is what provides the atomicity guarantee.
    { maxWait: 5000, timeout: 15000 },
  );

  const fulfillmentId = await enqueueFulfillment(order.id);
  if (fulfillmentId) {
    runInBackground("fulfillment", () => runFulfillment(fulfillmentId));
  }
}

async function assertPurchaseLimits(amount: number): Promise<void> {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ["min_purchase", "max_purchase", "maintenance_mode"] } },
  });
  const get = (key: string) => settings.find((s) => s.key === key)?.value as number | boolean | undefined;

  if (get("maintenance_mode") === true) {
    throw new ApiError("The platform is under maintenance. Please try again shortly.", 503);
  }
  const min = get("min_purchase");
  const max = get("max_purchase");
  if (typeof min === "number" && amount < min) {
    throw new ApiError("This order is below the minimum purchase amount.", 422);
  }
  if (typeof max === "number" && amount > max) {
    throw new ApiError("This order exceeds the maximum purchase amount.", 422);
  }
}

export function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}
