import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NAV = [
  ["Dashboard", "/admin"],
  ["Orders", "/admin/orders"],
  ["Customers", "/admin/customers"],
  ["Networks", "/admin/networks"],
  ["Data Bundles", "/admin/bundles"],
  ["Payments", "/admin/payments"],
  ["Paystack Subaccounts", "/admin/subaccounts"],
  ["Fulfillment", "/admin/fulfillment"],
  ["Wallets", "/admin/wallets"],
  ["Promotions", "/admin/promotions"],
  ["Reports", "/admin/reports"],
  ["Audit Logs", "/admin/audit-logs"],
  ["Settings", "/admin/settings"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Gate every admin page in one place, on the server.
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPER_ADMIN" && user.role !== "STAFF") redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b bg-[var(--surface)] lg:w-64 lg:border-b-0 lg:border-r">
        <div className="p-4">
          <p className="text-lg font-bold">Admin</p>
          <p className="muted truncate text-xs">{user.email}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-col lg:overflow-visible">
          {NAV.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium hover:bg-brand-50 hover:text-brand-700"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-4 lg:p-8">{children}</main>
    </div>
  );
}
