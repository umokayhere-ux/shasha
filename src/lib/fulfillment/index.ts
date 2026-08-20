import { FulfillmentStatus, OrderStatus, PaymentStatus, Role } from "@prisma/client";
import { prisma } from "../db";
import { notify } from "../services/notifications";
import { formatMoney } from "../money";
import { sendSms, smsTemplates } from "../sms";
import { BUSINESS_NAME } from "../branding";

/**
 * Manual fulfillment.
 *
 * Bundles are bought by the operator from their own data plug, not through an
 * automated provider API. So a paid order is queued for a human, the admins are
 * notified, and an admin marks it delivered or failed afterwards.
 *
 * Payment status stays separate throughout: a delivery that fails never
 * un-pays a verified payment.
 */

/**
 * Creates the single fulfillment record for a paid order and alerts the admins.
 * Safe to call from every webhook redelivery — the unique constraint on
 * orderId collapses concurrent callers to one record, so the operator is
 * never told to deliver the same order twice.
 */
export async function enqueueFulfillment(orderId: string): Promise<string | null> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;

  // Hard gate: nothing is queued for delivery before a verified payment.
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
        status: FulfillmentStatus.PENDING,
        provider: "manual",
      },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { fulfillmentStatus: FulfillmentStatus.PENDING, status: OrderStatus.PROCESSING },
    });

    await notifyAdmins({
      type: "ORDER_TO_FULFIL",
      title: "New order to deliver",
      body: `${order.bundleNameSnapshot} ${order.networkNameSnapshot} to ${order.recipientPhone} — ${formatMoney(order.finalAmount)} paid.`,
      metadata: { orderId: order.publicId, reference: order.reference },
    });

    return created.id;
  } catch {
    // Lost a race with a concurrent webhook — the other call created it.
    const raced = await prisma.fulfillment.findUnique({ where: { orderId } });
    return raced?.id ?? null;
  }
}

/** Marks an order delivered after the operator has sent the bundle. */
export async function markDelivered(publicId: string, adminId: string): Promise<boolean> {
  const fulfillment = await prisma.fulfillment.findUnique({
    where: { publicId },
    include: { order: true },
  });
  if (!fulfillment) return false;
  if (fulfillment.status === FulfillmentStatus.SUCCESSFUL) return true; // Idempotent.

  await prisma.$transaction([
    prisma.fulfillment.update({
      where: { id: fulfillment.id },
      data: {
        status: FulfillmentStatus.SUCCESSFUL,
        completedAt: new Date(),
        lastError: null,
        providerResponse: { deliveredBy: adminId, deliveredAt: new Date().toISOString() },
      },
    }),
    prisma.order.update({
      where: { id: fulfillment.orderId },
      data: {
        fulfillmentStatus: FulfillmentStatus.SUCCESSFUL,
        status: OrderStatus.SUCCESSFUL,
        failureReason: null,
        completedAt: new Date(),
      },
    }),
  ]);

  await notify(fulfillment.order.customerId, {
    type: "DATA_DELIVERED",
    title: "Data delivered",
    body: `${fulfillment.order.bundleNameSnapshot} has been sent to ${fulfillment.order.recipientPhone}.`,
    metadata: { orderId: fulfillment.order.publicId },
  });

  // Close the loop by SMS too — the customer may never open the app again.
  const buyer = await prisma.user.findUnique({
    where: { id: fulfillment.order.customerId },
    select: { phone: true },
  });
  if (buyer?.phone) {
    await sendSms(
      buyer.phone,
      smsTemplates.delivered(
        `${fulfillment.order.networkNameSnapshot} ${fulfillment.order.bundleNameSnapshot}`,
        fulfillment.order.recipientPhone,
        BUSINESS_NAME,
      ),
    );
  }

  return true;
}

/** Flags a delivery the operator could not complete. Payment is untouched. */
export async function markFailed(
  publicId: string,
  adminId: string,
  reason: string,
): Promise<boolean> {
  const fulfillment = await prisma.fulfillment.findUnique({
    where: { publicId },
    include: { order: true },
  });
  if (!fulfillment) return false;

  await prisma.$transaction([
    prisma.fulfillment.update({
      where: { id: fulfillment.id },
      data: {
        status: FulfillmentStatus.FAILED,
        lastError: reason.slice(0, 300),
        providerResponse: { failedBy: adminId, failedAt: new Date().toISOString() },
      },
    }),
    prisma.order.update({
      where: { id: fulfillment.orderId },
      // paymentStatus is deliberately not touched — the customer did pay.
      data: {
        fulfillmentStatus: FulfillmentStatus.FAILED,
        status: OrderStatus.FAILED,
        failureReason: reason.slice(0, 300),
      },
    }),
  ]);

  await notify(fulfillment.order.customerId, {
    type: "DELIVERY_FAILED",
    title: "Delivery issue",
    body: "Your payment was successful, but we could not deliver your data. Our team will contact you.",
    metadata: { orderId: fulfillment.order.publicId },
  });

  return true;
}

/** Returns a delivery to the queue after a failure, so it can be retried by hand. */
export async function requeue(publicId: string): Promise<boolean> {
  const fulfillment = await prisma.fulfillment.findUnique({ where: { publicId } });
  if (!fulfillment || fulfillment.status === FulfillmentStatus.SUCCESSFUL) return false;

  await prisma.$transaction([
    prisma.fulfillment.update({
      where: { id: fulfillment.id },
      data: {
        status: FulfillmentStatus.PENDING,
        retryCount: { increment: 1 },
        lastError: null,
      },
    }),
    prisma.order.update({
      where: { id: fulfillment.orderId },
      data: {
        fulfillmentStatus: FulfillmentStatus.PENDING,
        status: OrderStatus.PROCESSING,
        failureReason: null,
      },
    }),
  ]);
  return true;
}

/** Fans a notification out to every admin account. */
export async function notifyAdmins(input: {
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: { in: [Role.SUPER_ADMIN, Role.STAFF] } },
    select: { id: true },
  });
  await Promise.all(admins.map((admin) => notify(admin.id, input)));
}

export async function pendingCount(): Promise<number> {
  return prisma.fulfillment.count({ where: { status: FulfillmentStatus.PENDING } });
}
