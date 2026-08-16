import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments";
import { WEBHOOK_HEADER } from "@/lib/payments/paystack";
import { verifyAndSettle } from "@/lib/services/orders";

// Raw body access is required for signature verification — no caching, and
// the body must never be re-serialized before hashing.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Paystack webhook receiver.
 *
 * Order of operations matters:
 *  1. Verify the signature against the RAW body (reject otherwise).
 *  2. Insert a dedupe row — a unique constraint makes redelivery a no-op.
 *  3. Only then settle, through the same idempotent path the callback uses.
 *
 * Always returns 200 for authentic events, including duplicates, so the
 * provider does not retry indefinitely.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get(WEBHOOK_HEADER);

  let event;
  try {
    event = getPaymentProvider().processWebhook(rawBody, signature);
  } catch (err) {
    console.warn("[webhook] rejected: %s", err instanceof Error ? err.message : "unknown");
    return new Response(JSON.stringify({ ok: false }), { status: 401 });
  }

  // Claim the event. A duplicate delivery loses this race and exits here.
  let eventRow;
  try {
    eventRow = await prisma.paymentWebhookEvent.create({
      data: {
        provider: "paystack",
        eventSignature: event.signature,
        eventType: event.type,
        reference: event.reference,
        payload: event.payload as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });
    }
    console.error("[webhook] could not persist event", err);
    // Signal a retry — the event was authentic but we failed to store it.
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }

  try {
    if (event.type === "charge.success" && event.reference) {
      // Re-verifies with Paystack; the webhook payload alone is not trusted
      // as proof of the amount actually captured.
      await verifyAndSettle(event.reference);
    }
    await prisma.paymentWebhookEvent.update({
      where: { id: eventRow.id },
      data: { processedAt: new Date() },
    });
  } catch (err) {
    console.error("[webhook] processing failed", event.type, err);
    await prisma.paymentWebhookEvent.update({
      where: { id: eventRow.id },
      data: { processingError: err instanceof Error ? err.message.slice(0, 500) : "unknown" },
    });
    // Acknowledged: the event is recorded and can be replayed by an admin.
    // Returning 500 would only trigger redeliveries that dedupe out anyway.
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
