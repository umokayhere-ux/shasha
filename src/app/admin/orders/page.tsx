import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader, EmptyState } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      customer: { select: { name: true, email: true } },
      fulfillment: { select: { status: true, retryCount: true } },
    },
  });

  return (
    <div>
      <PageHeader title="Orders" subtitle="Most recent 100 orders across all customers." />
      <div className="card">
        {orders.length === 0 ? (
          <EmptyState message="No orders yet." />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[860px]">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Bundle</th>
                  <th>Recipient</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Delivery</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.publicId}>
                    <td className="font-mono text-xs">{o.reference}</td>
                    <td>
                      <div className="font-medium">{o.customer.name}</div>
                      <div className="muted text-xs">{o.customer.email}</div>
                    </td>
                    <td>
                      {o.networkNameSnapshot} {o.bundleNameSnapshot}
                    </td>
                    <td className="font-mono text-xs">{o.recipientPhone}</td>
                    <td className="font-semibold">{formatMoney(o.finalAmount)}</td>
                    <td><StatusBadge status={o.paymentStatus} /></td>
                    <td><StatusBadge status={o.fulfillmentStatus} /></td>
                    <td className="muted text-xs">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
