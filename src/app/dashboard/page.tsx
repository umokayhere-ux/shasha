import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";
import { networkTheme } from "@/lib/network-theme";
import { NetworkLogo } from "@/components/NetworkLogo";
import { SignOutButton } from "@/components/SignOutButton";
import { NOT_DELETED } from "@/lib/not-deleted";
import { BUSINESS_NAME } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function CustomerDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CUSTOMER") redirect("/admin");

  const [orders, wallet, successful, networks] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.wallet.findUnique({ where: { userId: user.id } }),
    prisma.order.count({ where: { customerId: user.id, status: "SUCCESSFUL" } }),
    prisma.network.findMany({
      where: { isActive: true, ...NOT_DELETED },
      orderBy: { displayOrder: "asc" },
      select: { publicId: true, name: true, slug: true, logoUrl: true },
    }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-extrabold tracking-tight" style={{ color: "var(--brand)" }}>
            {BUSINESS_NAME}
          </p>
          <p className="muted mt-0.5 text-sm">
            Welcome back, <span className="font-semibold">{user.name.split(" ")[0]}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/orders" className="btn-ghost">
            Orders
          </Link>
          <SignOutButton />
        </div>
      </header>

      {/* Balance hero */}
      <section
        className="mb-6 rounded-3xl p-6 text-white"
        style={{
          background: "linear-gradient(135deg, #1565c0 0%, #0d47a1 55%, #06305f 100%)",
          boxShadow: "0 18px 40px rgba(13, 71, 161, 0.32)",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest opacity-75">
          Wallet balance
        </p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight">
          {formatMoney(wallet?.balance ?? 0)}
        </p>
        <div className="mt-5 flex gap-6 text-sm">
          <span>
            <span className="block text-xl font-bold">{successful}</span>
            <span className="opacity-75">Delivered</span>
          </span>
          <span>
            <span className="block text-xl font-bold">{orders.length}</span>
            <span className="opacity-75">Recent</span>
          </span>
        </div>
      </section>

      {/* Network quick-buy, in each network's own colours */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-bold">Buy data</h2>
        <div className="grid grid-cols-3 gap-3">
          {networks.map((n) => {
            const t = networkTheme(n.slug);
            return (
              <Link
                key={n.publicId}
                href="/buy"
                className="flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl p-2 transition active:scale-[0.98]"
                style={{
                  background: t.bg,
                  border: `1px solid ${t.surfaceBorder}`,
                  boxShadow: "0 10px 24px rgba(2,6,23,0.12)",
                }}
              >
                {/* The logo is the tile: it takes the whole card, name underneath. */}
                <NetworkLogo
                  theme={t}
                  logoUrl={n.logoUrl}
                  name={n.name}
                  className="h-full w-full flex-1"
                  rounded="rounded-xl"
                />
                <span
                  className="shrink-0 text-[11px] font-bold leading-none"
                  style={{ color: t.text }}
                >
                  {n.name}
                </span>
              </Link>
            );
          })}
          {networks.length === 0 && (
            <p className="muted col-span-3 text-sm">No networks available yet.</p>
          )}
        </div>
      </section>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Recent orders</h2>
          <Link href="/orders" className="text-sm font-semibold" style={{ color: "var(--brand)" }}>
            View all
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="muted py-6 text-center text-sm">
            No orders yet — pick a network above to get started.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {orders.map((order) => (
              <li key={order.publicId} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {order.networkNameSnapshot} {order.bundleNameSnapshot}
                  </p>
                  <p className="muted text-xs">{order.recipientPhone}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {/* Amount actually charged, from the order's own snapshot. */}
                  <span className="text-sm font-bold">{formatMoney(order.finalAmount)}</span>
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
