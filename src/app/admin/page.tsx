import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [customers, totalOrders, todayOrders, pendingFulfil, failedFulfil, revenue, todayRevenue, recent] =
    await Promise.all([
      prisma.user.count({ where: { role: "CUSTOMER", deletedAt: null } }),
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.fulfillment.count({ where: { status: { in: ["QUEUED", "PENDING", "PROCESSING"] } } }),
      prisma.fulfillment.count({ where: { status: "FAILED" } }),
      prisma.order.aggregate({
        where: { paymentStatus: "PAID" },
        _sum: { finalAmount: true, costPriceSnapshot: true },
      }),
      prisma.order.aggregate({
        where: { paymentStatus: "PAID", createdAt: { gte: today } },
        _sum: { finalAmount: true },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { customer: { select: { name: true, email: true } } },
      }),
    ]);

  const sales = revenue._sum.finalAmount ?? 0;
  const cost = revenue._sum.costPriceSnapshot ?? 0;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Customers" value={String(customers)} />
        <Stat label="Total orders" value={String(totalOrders)} />
        <Stat label="Orders today" value={String(todayOrders)} />
        <Stat label="Revenue today" value={formatMoney(todayRevenue._sum.finalAmount ?? 0)} />
        <Stat label="Total revenue" value={formatMoney(sales)} />
        <Stat label="Total cost" value={formatMoney(cost)} />
        {/* Profit uses per-order snapshots, so past margins never move. */}
        <Stat label="Gross profit" value={formatMoney(sales - cost)} />
        <Stat label="Failed deliveries" value={String(failedFulfil)} tone={failedFulfil > 0 ? "warn" : undefined} />
      </div>

      {pendingFulfil > 0 && (
        <p className="mb-6 rounded-lg bg-amber-100 px-4 py-3 text-sm text-amber-900">
          {pendingFulfil} delivery job{pendingFulfil === 1 ? "" : "s"} awaiting processing.
        </p>
      )}

      <section className="card">
        <h2 className="mb-3 font-semibold">Recent orders</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="muted text-xs uppercase">
              <tr>
                <th className="pb-2">Reference</th>
                <th className="pb-2">Customer</th>
                <th className="pb-2">Bundle</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Payment</th>
                <th className="pb-2">Delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recent.map((order) => (
                <tr key={order.publicId}>
                  <td className="py-2 font-mono text-xs">{order.reference}</td>
                  <td className="py-2">{order.customer.name}</td>
                  <td className="py-2">
                    {order.networkNameSnapshot} {order.bundleNameSnapshot}
                  </td>
                  <td className="py-2 font-semibold">{formatMoney(order.finalAmount)}</td>
                  <td className="py-2"><StatusBadge status={order.paymentStatus} /></td>
                  <td className="py-2"><StatusBadge status={order.fulfillmentStatus} /></td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={6} className="muted py-6 text-center">No orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="card">
      <p className="muted text-xs uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone === "warn" ? "text-rose-600" : ""}`}>{value}</p>
    </div>
  );
}
