import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { DeliveryQueue } from "./DeliveryQueue";

export const dynamic = "force-dynamic";

export default async function DeliveriesPage() {
  const fulfillments = await prisma.fulfillment.findMany({
    where: { status: { in: ["PENDING", "FAILED"] } },
    // Oldest first: the customer who has waited longest is served first.
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      order: {
        select: {
          reference: true,
          recipientPhone: true,
          bundleNameSnapshot: true,
          networkNameSnapshot: true,
          dataAmountSnapshot: true,
          finalAmount: true,
          createdAt: true,
          customer: { select: { name: true, phone: true } },
        },
      },
    },
  });

  return (
    <div>
      <PageHeader
        title="To deliver"
        subtitle="Paid orders waiting for you to send the bundle from your data plug."
      />
      <DeliveryQueue
        items={fulfillments.map((f) => ({
          publicId: f.publicId,
          status: f.status,
          retryCount: f.retryCount,
          lastError: f.lastError,
          reference: f.order.reference,
          recipientPhone: f.order.recipientPhone,
          bundle: `${f.order.networkNameSnapshot} ${f.order.bundleNameSnapshot}`,
          amount: f.order.finalAmount,
          customerName: f.order.customer.name,
          customerPhone: f.order.customer.phone,
          createdAt: f.order.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
