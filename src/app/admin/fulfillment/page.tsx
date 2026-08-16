import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { getDataProvider } from "@/lib/fulfillment";

export const dynamic = "force-dynamic";

export default async function AdminFulfillmentPage() {
  const [fulfillments, counts] = await Promise.all([
    prisma.fulfillment.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        order: {
          select: {
            reference: true,
            recipientPhone: true,
            bundleNameSnapshot: true,
            networkNameSnapshot: true,
            paymentStatus: true,
          },
        },
      },
    }),
    prisma.fulfillment.groupBy({ by: ["status"], _count: true }),
  ]);

  return (
    <div>
      <PageHeader
        title="Fulfillment"
        subtitle={`Delivery provider: ${getDataProvider().name}. Payment status is tracked separately, so a failed delivery never un-pays an order.`}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {counts.map((c) => (
          <div key={c.status} className="stat">
            <p className="muted text-xs uppercase tracking-wide">{c.status.toLowerCase()}</p>
            <p className="mt-1 text-xl font-bold">{c._count}</p>
          </div>
        ))}
      </div>

      <div className="card">
        {fulfillments.length === 0 ? (
          <EmptyState message="No deliveries yet." />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[820px]">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Bundle</th>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th>Retries</th>
                  <th>Provider ref</th>
                  <th>Last error</th>
                </tr>
              </thead>
              <tbody>
                {fulfillments.map((f) => (
                  <tr key={f.publicId}>
                    <td className="font-mono text-xs">{f.order.reference}</td>
                    <td>
                      {f.order.networkNameSnapshot} {f.order.bundleNameSnapshot}
                    </td>
                    <td className="font-mono text-xs">{f.order.recipientPhone}</td>
                    <td><StatusBadge status={f.status} /></td>
                    <td>{f.retryCount}</td>
                    <td className="muted font-mono text-xs">{f.providerReference ?? "—"}</td>
                    <td className="muted max-w-[220px] truncate text-xs">{f.lastError ?? "—"}</td>
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
