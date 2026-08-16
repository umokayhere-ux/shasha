import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orders = await prisma.order.findMany({
    where: { customerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My orders</h1>
        <Link href="/buy" className="btn-primary">Buy data</Link>
      </div>

      {orders.length === 0 ? (
        <div className="card text-center">
          <p className="muted">You have not bought any data yet.</p>
          <Link href="/buy" className="btn-primary mt-4">Buy your first bundle</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.publicId} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {order.networkNameSnapshot} {order.bundleNameSnapshot}
                  </p>
                  <p className="muted text-sm">To {order.recipientPhone}</p>
                  <p className="muted mt-1 font-mono text-xs">{order.reference}</p>
                </div>
                <div className="text-right">
                  {/* Amount actually charged, from the order's own snapshot. */}
                  <p className="font-bold">{formatMoney(order.finalAmount)}</p>
                  <p className="muted text-xs">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <StatusBadge status={order.paymentStatus} />
                <StatusBadge status={order.fulfillmentStatus} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
