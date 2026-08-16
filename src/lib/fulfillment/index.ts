import { FulfillmentStatus, OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "../db";
import { notify } from "../services/notifications";
import { MockDataProvider } from "./mock-provider";
import type { DataProvider } from "./provider";

const MAX_RETRIES = 3;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

let dataProvider: DataProvider | null = null;

export function getDataProvider(): DataProvider {
  if (!dataProvider) {
    // Swap here once real provider credentials are available.
    dataProvider = new MockDataProvider();
  }
  return dataProvider;
}

export function setDataProvider(provider: DataProvider): void {
  dataProvider = provider;
}

/**
 * Creates the single fulfillment record for a paid order. Safe to call from
 * every webhook redelivery and from the verify endpoint: the unique constraint
 * on orderId/idempotencyKey collapses concurrent callers to one record.
 */
export async function enqueueFulfillment(orderId: string): Promise<string | null> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;

  // Hard gate: data is never delivered before a verified payment.
  if (order.paymentStatus !== PaymentStatus.PAID) {
    console.warn("[fulfillment] refusing to queue unpaid order %s", orderId);
    return null;
  }

  const existing = await prisma.fulfillment.findUnique({ where: { orderId } });
  if (existing) return existing.id;

  try {
    const created = await prisma.fulfillment.create({
      data: {
        orderId,
        idempotencyKey: `fulfil_${order.reference}`,
        status: FulfillmentStatus.QUEUED,
        provider: getDataProvider().name,
      },
    });
    await prisma.order.update({
      where: { id: orderId },
      data: { fulfillmentStatus: FulfillmentStatus.QUEUED, status: OrderStatus.PROCESSING },
    });
    return created.id;
  } catch {
    // Lost a race with a concurrent webhook — the other one created it.
    const raced = await prisma.fulfillment.findUnique({ where: { orderId } });
    return raced?.id ?? null;
  }
}

/**
 * Executes one delivery attempt. Claims the record with a conditional update
 * so two workers can never call the data provider for the same order.
 */
export async function runFulfillment(fulfillmentId: string): Promise<void> {
  const staleBefore = new Date(Date.now() - LOCK_TIMEOUT_MS);

  const claimed = await prisma.fulfillment.updateMany({
    where: {
      id: fulfillmentId,
      status: { in: [FulfillmentStatus.QUEUED, FulfillmentStatus.PENDING] },
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }],
    },
    data: { status: FulfillmentStatus.PROCESSING, lockedAt: new Date() },
  });
  if (claimed.count === 0) return; // Already claimed or already terminal.

  const fulfillment = await prisma.fulfillment.findUnique({
    where: { id: fulfillmentId },
    include: { order: { include: { network: true } } },
  });
  if (!fulfillment) return;

  const { order } = fulfillment;
  const provider = getDataProvider();

  try {
    const result = await provider.purchaseBundle({
      idempotencyKey: fulfillment.idempotencyKey,
      recipientPhone: order.recipientPhone,
      networkSlug: order.network?.slug ?? order.networkNameSnapshot.toLowerCase(),
      productCode: order.providerCodeSnapshot,
      dataAmountMb: order.dataAmountSnapshot,
      amount: order.finalAmount,
    });

    await prisma.providerTransaction.create({
      data: {
        provider: provider.name,
        orderId: order.id,
        reference: result.providerReference,
        request: { idempotencyKey: fulfillment.idempotencyKey, recipient: maskPhone(order.recipientPhone) },
        response: result.raw as object,
        success: result.state === "SUCCESSFUL",
      },
    });

    const status =
      result.state === "SUCCESSFUL"
        ? FulfillmentStatus.SUCCESSFUL
        : result.state === "PROCESSING"
          ? FulfillmentStatus.PROCESSING
          : FulfillmentStatus.FAILED;

    await prisma.fulfillment.update({
      where: { id: fulfillment.id },
      data: {
        status,
        providerReference: result.providerReference,
        providerResponse: result.raw as object,
        lastError: result.state === "FAILED" ? result.message : null,
        lockedAt: null,
        completedAt: status === FulfillmentStatus.SUCCESSFUL ? new Date() : null,
      },
    });

    // Payment status is deliberately untouched here: a delivery failure never
    // un-pays a verified payment.
    await prisma.order.update({
      where: { id: order.id },
      data: {
        fulfillmentStatus: status,
        status:
          status === FulfillmentStatus.SUCCESSFUL
            ? OrderStatus.SUCCESSFUL
            : status === FulfillmentStatus.FAILED
              ? OrderStatus.FAILED
              : OrderStatus.PROCESSING,
        failureReason: status === FulfillmentStatus.FAILED ? result.message : null,
        completedAt: status === FulfillmentStatus.SUCCESSFUL ? new Date() : null,
      },
    });

    if (status === FulfillmentStatus.SUCCESSFUL) {
      await notify(order.customerId, {
        type: "DATA_DELIVERED",
        title: "Data delivered",
        body: `${order.bundleNameSnapshot} has been sent to ${order.recipientPhone}.`,
        metadata: { orderId: order.publicId },
      });
    } else if (status === FulfillmentStatus.FAILED) {
      await notify(order.customerId, {
        type: "DELIVERY_FAILED",
        title: "Delivery issue",
        body: "Your payment was successful, but we could not deliver your data. Our team is on it.",
        metadata: { orderId: order.publicId },
      });
      if (result.retryable) await scheduleRetry(fulfillment.id);
    }
  } catch (err) {
    console.error("[fulfillment] attempt failed", fulfillmentId, err);
    await prisma.fulfillment.update({
      where: { id: fulfillment.id },
      data: {
        status: FulfillmentStatus.FAILED,
        lastError: err instanceof Error ? err.message.slice(0, 500) : "Unknown error",
        lockedAt: null,
      },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { fulfillmentStatus: FulfillmentStatus.FAILED, status: OrderStatus.FAILED },
    });
  }
}

/**
 * Re-queues a failed delivery. Only ever called for faults the provider marked
 * retryable; anything ambiguous is left for an admin to resolve so a customer
 * cannot receive the same bundle twice.
 */
export async function scheduleRetry(fulfillmentId: string): Promise<boolean> {
  const fulfillment = await prisma.fulfillment.findUnique({ where: { id: fulfillmentId } });
  if (!fulfillment || fulfillment.retryCount >= MAX_RETRIES) return false;
  if (fulfillment.status !== FulfillmentStatus.FAILED) return false;

  // If the provider ever issued a reference, confirm the real state first —
  // never blind-retry something that may already have been delivered.
  if (fulfillment.providerReference) {
    const status = await getDataProvider().getTransactionStatus(fulfillment.providerReference);
    if (status.state !== "FAILED") return false;
  }

  await prisma.fulfillment.update({
    where: { id: fulfillmentId },
    data: {
      status: FulfillmentStatus.QUEUED,
      retryCount: { increment: 1 },
      lockedAt: null,
    },
  });
  return true;
}

/** Drains queued work. Invoke from a worker process or a scheduled job. */
export async function processQueue(limit = 20): Promise<number> {
  const pending = await prisma.fulfillment.findMany({
    where: { status: { in: [FulfillmentStatus.QUEUED, FulfillmentStatus.PENDING] } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const item of pending) await runFulfillment(item.id);
  return pending.length;
}

function maskPhone(phone: string): string {
  return phone.length <= 4 ? "****" : `${"*".repeat(phone.length - 4)}${phone.slice(-4)}`;
}

export * from "./provider";
