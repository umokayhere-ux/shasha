import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { verifyAndSettle } from "@/lib/services/orders";
import { StatusBadge } from "@/components/StatusBadge";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Landing page after the Paystack redirect. The redirect is treated purely as
 * a cue to re-verify server-side — never as evidence that payment succeeded.
 */
export default async function CallbackPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { publicId } = await params;
  const order = await prisma.order.findUnique({ where: { publicId } });
  if (!order || order.customerId !== user.id) redirect("/dashboard");

  await verifyAndSettle(order.reference).catch((err) =>
    console.error("[callback] verification failed", err),
  );

  const settled = await prisma.order.findUnique({
    where: { id: order.id },
    include: { fulfillment: true },
  });
  if (!settled) redirect("/dashboard");

  const paid = settled.paymentStatus === "PAID";
  const delivered = settled.fulfillmentStatus === "SUCCESSFUL";
  const failedDelivery = settled.fulfillmentStatus === "FAILED";

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="card text-center">
        <h1 className="text-xl font-bold">
          {!paid
            ? "Payment not confirmed"
            : delivered
              ? "Data delivered"
              : failedDelivery
                ? "Payment received"
                : "Payment received"}
        </h1>

        <p className="muted mt-2 text-sm">
          {!paid
            ? "Your payment could not be completed. Please try again."
            : delivered
              ? `${settled.bundleNameSnapshot} has been sent to ${settled.recipientPhone}.`
              : failedDelivery
                ? "Your payment was successful, but we encountered an issue delivering your data. Our team will resolve this as soon as possible."
                : "Your payment was successful. Your data bundle is currently being processed."}
        </p>

        <div className="mt-6 space-y-2 text-left text-sm">
          <div className="flex justify-between">
            <span className="muted">Reference</span>
            <span className="font-mono text-xs">{settled.reference}</span>
          </div>
          <div className="flex justify-between">
            <span className="muted">Payment</span>
            <StatusBadge status={settled.paymentStatus} />
          </div>
          <div className="flex justify-between">
            <span className="muted">Delivery</span>
            <StatusBadge status={settled.fulfillmentStatus} />
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <Link href="/orders" className="btn-ghost flex-1">
            My orders
          </Link>
          <Link href="/buy" className="btn-primary flex-1">
            Buy again
          </Link>
        </div>
      </div>
    </main>
  );
}
