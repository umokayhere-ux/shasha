import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function CustomerDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CUSTOMER") redirect("/admin");

  const [orders, wallet, unread, successful] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.wallet.findUnique({ where: { userId: user.id } }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.order.count({ where: { customerId: user.id, status: "SUCCESSFUL" } }),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Hi, {user.name.split(" ")[0]}</h1>
          <p className="muted text-sm">Here is what is happening with your account.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/orders" className="btn-ghost">My orders</Link>
          <Link href="/buy" className="btn-primary">Buy data</Link>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Wallet" value={formatMoney(wallet?.balance ?? 0)} />
        <Stat label="Successful" value={String(successful)} />
        <Stat label="Total orders" value={String(orders.length)} />
        <Stat label="Unread" value={String(unread)} />
      </div>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Recent orders</h2>
          <Link href="/orders" className="text-sm font-semibold text-brand-600">View all</Link>
        </div>
        {orders.length === 0 ? (
          <p className="muted text-sm">No orders yet.</p>
        ) : (
          <ul className="divide-y">
            {orders.map((order) => (
              <li key={order.publicId} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">
                    {order.networkNameSnapshot} {order.bundleNameSnapshot}
                  </p>
                  <p className="muted text-xs">{order.recipientPhone}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{formatMoney(order.finalAmount)}</span>
                  <StatusBadge status={order.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
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
