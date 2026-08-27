import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";
import { networkTheme } from "@/lib/network-theme";
import { NetworkTile } from "@/components/NetworkTile";
import { CustomerTabBar } from "@/components/CustomerTabBar";
import { NOT_DELETED } from "@/lib/not-deleted";

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
    // Headline figure: lifetime spend, counting only orders actually paid for.
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

  // Orders snapshot the network name, so match logos back by name for the list.
  const logoByName = new Map(networks.map((n) => [n.name.toLowerCase(), n.logoUrl]));
  const firstName = user.name.split(" ")[0];

  return (
    <div className="min-h-screen">
      <header
        className="rounded-b-3xl px-5 pb-6 pt-5"
        style={{ background: "var(--cust-deep)", color: "var(--cust-on-deep)" }}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className="grid h-9 w-9 place-items-center rounded-full text-sm font-extrabold"
              style={{ background: "var(--cust-lime)", color: "var(--cust-deep)" }}
            >
              {firstName.charAt(0).toUpperCase()}
            </span>
            <p className="text-sm font-bold">Hello, {firstName}</p>
          </div>

          <Link
            href="/notifications"
            aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
            className="relative grid h-9 w-9 place-items-center rounded-full"
            style={{ background: "rgba(255,255,255,0.14)", color: "var(--cust-lime)" }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 8a6 6 0 1 0-12 0c0 7-2 8-2 8h16s-2-1-2-8M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        </div>

        {/* Compact balance block: label, figure, one line of context. */}
        <div className="mx-auto mt-5 max-w-lg text-center">
          <p className="text-xs font-semibold" style={{ color: "var(--cust-lime)" }}>
            Total spent on data
          </p>
          <p className="mt-0.5 text-3xl font-extrabold tracking-tight">
            {formatMoney(spend._sum.finalAmount ?? 0)}
          </p>
          <p className="mt-0.5 text-[11px] opacity-70">
            {spend._count} purchase{spend._count === 1 ? "" : "s"} · {delivered} delivered
          </p>

          <div className="mt-4 flex justify-center gap-2.5">
            <Link
              href="/buy"
              className="rounded-full px-6 py-2.5 text-sm font-extrabold"
              style={{ background: "var(--cust-lime)", color: "var(--cust-deep)" }}
            >
              Buy data
            </Link>
            <Link
              href="/orders"
              className="rounded-full px-6 py-2.5 text-sm font-bold"
              style={{ color: "var(--cust-on-deep)", border: "1px solid rgba(255,255,255,0.3)" }}
            >
              My orders
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-5">
        <section className="mb-5">
          <h2 className="mb-3 text-sm font-bold">Buy by network</h2>
          <div className="grid grid-cols-3 gap-4">
            {networks.map((n) => (
              <NetworkTile key={n.publicId} name={n.name} slug={n.slug} logoUrl={n.logoUrl} />
            ))}
            {networks.length === 0 && (
              <p className="muted col-span-3 text-sm">No networks available yet.</p>
            )}
          </div>
        </section>

        {/* Complaints entry point: deliberately above the fold of the list, so a
            customer chasing an undelivered bundle finds it without scrolling. */}
        <Link
          href="/support"
          className="card mb-5 flex items-center gap-3 no-underline"
          style={{ color: "var(--text)" }}
        >
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
            style={{ background: "var(--success-soft)", color: "var(--success)" }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.9-.9L3 21l2-4.9A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Problem with an order?</span>
            <span className="muted block text-xs">Make a complaint on WhatsApp</span>
          </span>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ color: "var(--muted)" }}>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>

        <section className="card">
          <div className="mb-1 flex items-center justify-between">
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
                const key = order.networkNameSnapshot.toLowerCase();
                const theme = networkTheme(key);
                const logo = logoByName.get(key) ?? null;

                return (
                  <li key={order.publicId} className="flex items-center gap-3 py-3">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full"
                      style={{ background: theme.bg }}
                    >
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- data URI
                        <img src={logo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span
                          aria-hidden
                          className="text-[8px] font-black"
                          style={{ color: theme.accent }}
                        >
                          {theme.mark}
                        </span>
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {order.networkNameSnapshot} {order.bundleNameSnapshot}
                      </p>
                      <p className="muted truncate text-xs">
                        {order.recipientPhone} · {new Date(order.createdAt).toLocaleDateString()}
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
      </main>

      <CustomerTabBar />
    </div>
  );
}
