import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";
import { networkTheme } from "@/lib/network-theme";
import { NetworkLogo } from "@/components/NetworkLogo";
import { CustomerTabBar } from "@/components/CustomerTabBar";
import { NOT_DELETED } from "@/lib/not-deleted";
import { BUSINESS_NAME } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function CustomerDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CUSTOMER") redirect("/admin");

  const [orders, spend, delivered, unread, networks] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    // The headline figure is lifetime spend on data, counting only orders the
    // customer actually paid for.
    prisma.order.aggregate({
      where: { customerId: user.id, paymentStatus: "PAID" },
      _sum: { finalAmount: true },
      _count: true,
    }),
    prisma.order.count({ where: { customerId: user.id, status: "SUCCESSFUL" } }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.network.findMany({
      where: { isActive: true, ...NOT_DELETED },
      orderBy: { displayOrder: "asc" },
      select: { publicId: true, name: true, slug: true, logoUrl: true },
    }),
  ]);

  const totalSpent = spend._sum.finalAmount ?? 0;
  const firstName = user.name.split(" ")[0];

  return (
    <div className="min-h-screen">
      {/* Deep header carrying the greeting and the headline figure */}
      <header
        className="rounded-b-[2rem] px-5 pb-8 pt-6"
        style={{ background: "var(--cust-deep)", color: "var(--cust-on-deep)" }}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="grid h-11 w-11 place-items-center rounded-full text-base font-extrabold"
              style={{ background: "var(--cust-lime)", color: "var(--cust-deep)" }}
            >
              {firstName.charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="text-sm opacity-80">Hello,</p>
              <p className="text-lg font-bold leading-tight">{firstName}</p>
            </div>
          </div>

          <Link
            href="/notifications"
            aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
            className="relative grid h-11 w-11 place-items-center rounded-full text-lg"
            style={{ background: "var(--cust-lime)", color: "var(--cust-deep)" }}
          >
            🔔
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        </div>

        <div className="mx-auto mt-7 max-w-lg text-center">
          <p className="text-sm font-medium" style={{ color: "var(--cust-lime)" }}>
            Total spent on data
          </p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight">{formatMoney(totalSpent)}</p>
          <p className="mt-1 text-xs opacity-70">
            {spend._count} purchase{spend._count === 1 ? "" : "s"} · {delivered} delivered
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/buy"
              className="rounded-full px-7 py-3 text-sm font-extrabold"
              style={{ background: "var(--cust-lime)", color: "var(--cust-deep)" }}
            >
              Buy data
            </Link>
            <Link
              href="/orders"
              className="rounded-full px-7 py-3 text-sm font-extrabold"
              style={{
                background: "transparent",
                color: "var(--cust-on-deep)",
                border: "1px solid rgba(255,255,255,0.35)",
              }}
            >
              My orders
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Network quick-buy, in each network's own colours */}
        <section className="card mb-5">
          <h2 className="mb-3 text-sm font-bold">Buy by network</h2>
          <div className="grid grid-cols-3 gap-3">
            {networks.map((n) => {
              const t = networkTheme(n.slug);
              return (
                <Link
                  key={n.publicId}
                  href="/buy"
                  className="flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl p-2 transition active:scale-[0.98]"
                  style={{ background: t.bg, border: `1px solid ${t.surfaceBorder}` }}
                >
                  <NetworkLogo
                    theme={t}
                    logoUrl={n.logoUrl}
                    name={n.name}
                    className="h-full w-full flex-1"
                    rounded="rounded-xl"
                  />
                  <span className="shrink-0 text-[11px] font-bold" style={{ color: t.text }}>
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
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">Recent purchases</h2>
            <Link href="/orders" className="text-xs font-bold" style={{ color: "var(--brand)" }}>
              See all
            </Link>
          </div>

          {orders.length === 0 ? (
            <p className="muted py-8 text-center text-sm">
              No purchases yet — tap Buy data to get started.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
              {orders.map((order) => {
                const t = networkTheme(order.networkNameSnapshot.toLowerCase());
                return (
                  <li key={order.publicId} className="flex items-center gap-3 py-3">
                    <span
                      aria-hidden
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[9px] font-black"
                      style={{ background: t.accent, color: t.onAccent }}
                    >
                      {t.mark}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {order.networkNameSnapshot} {order.bundleNameSnapshot}
                      </p>
                      <p className="muted truncate text-xs">
                        To {order.recipientPhone} ·{" "}
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {/* Amount actually charged, from the order's own snapshot. */}
                      <p className="text-sm font-extrabold">{formatMoney(order.finalAmount)}</p>
                      <StatusBadge status={order.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="muted mt-6 text-center text-xs">{BUSINESS_NAME}</p>
      </main>

      <CustomerTabBar />
    </div>
  );
}
