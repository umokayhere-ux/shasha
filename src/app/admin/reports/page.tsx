import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { PageHeader, EmptyState } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const paid = { paymentStatus: "PAID" as const };

  // Every figure comes from the per-order snapshot, so editing a bundle price
  // today cannot rewrite last month's reported margin.
  const [totals, byNetwork, topBundles] = await Promise.all([
    prisma.order.aggregate({
      where: paid,
      _sum: { finalAmount: true, costPriceSnapshot: true, discountAmount: true },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ["networkNameSnapshot"],
      where: paid,
      _sum: { finalAmount: true, costPriceSnapshot: true },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ["bundleNameSnapshot", "networkNameSnapshot"],
      where: paid,
      _sum: { finalAmount: true, costPriceSnapshot: true },
      _count: true,
      orderBy: { _count: { bundleNameSnapshot: "desc" } },
      take: 15,
    }),
  ]);

  const sales = totals._sum.finalAmount ?? 0;
  const cost = totals._sum.costPriceSnapshot ?? 0;

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Profit is calculated from historical order snapshots, never from current prices."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Paid orders" value={String(totals._count)} />
        <Stat label="Sales" value={formatMoney(sales)} />
        <Stat label="Cost" value={formatMoney(cost)} />
        <Stat label="Gross profit" value={formatMoney(sales - cost)} />
      </div>

      <div className="card mb-6">
        <h2 className="mb-3 font-semibold">By network</h2>
        {byNetwork.length === 0 ? (
          <EmptyState message="No paid orders yet." />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[520px]">
              <thead>
                <tr>
                  <th>Network</th>
                  <th>Orders</th>
                  <th>Sales</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {byNetwork.map((n) => (
                  <tr key={n.networkNameSnapshot}>
                    <td className="font-medium">{n.networkNameSnapshot}</td>
                    <td>{n._count}</td>
                    <td>{formatMoney(n._sum.finalAmount ?? 0)}</td>
                    <td className="font-semibold text-emerald-600">
                      {formatMoney((n._sum.finalAmount ?? 0) - (n._sum.costPriceSnapshot ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Top bundles</h2>
        {topBundles.length === 0 ? (
          <EmptyState message="No paid orders yet." />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[520px]">
              <thead>
                <tr>
                  <th>Bundle</th>
                  <th>Network</th>
                  <th>Orders</th>
                  <th>Sales</th>
                </tr>
              </thead>
              <tbody>
                {topBundles.map((b) => (
                  <tr key={`${b.networkNameSnapshot}-${b.bundleNameSnapshot}`}>
                    <td className="font-medium">{b.bundleNameSnapshot}</td>
                    <td className="muted">{b.networkNameSnapshot}</td>
                    <td>{b._count}</td>
                    <td>{formatMoney(b._sum.finalAmount ?? 0)}</td>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <p className="muted text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
