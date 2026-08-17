import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CustomerTabBar } from "@/components/CustomerTabBar";
import { MarkAllRead } from "./MarkAllRead";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="min-h-screen">
      <header
        className="rounded-b-[2rem] px-5 pb-7 pt-6"
        style={{ background: "var(--cust-deep)", color: "var(--cust-on-deep)" }}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold">Notifications</h1>
            <p className="text-sm opacity-75">
              {unread > 0 ? `${unread} unread` : "You're all caught up"}
            </p>
          </div>
          {unread > 0 && <MarkAllRead />}
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {notifications.length === 0 ? (
          <div className="card text-center">
            <p className="text-2xl">🔔</p>
            <p className="mt-2 font-semibold">Nothing yet</p>
            <p className="muted mt-1 text-sm">
              Updates about your purchases will appear here.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {notifications.map((n) => (
              <li
                key={n.id}
                className="card"
                style={
                  n.readAt ? undefined : { borderLeft: "4px solid var(--brand)" }
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold">{n.title}</p>
                  <span className="muted shrink-0 text-xs">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="muted mt-1 text-sm">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </main>

      <CustomerTabBar />
    </div>
  );
}
