"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: Array<[string, string, string]> = [
  ["Dashboard", "/admin", "▦"],
  ["To deliver", "/admin/deliveries", "🚀"],
  ["Orders", "/admin/orders", "🧾"],
  ["Customers", "/admin/customers", "👤"],
  ["Networks", "/admin/networks", "📶"],
  ["Data Bundles", "/admin/bundles", "📦"],
  ["Payments", "/admin/payments", "💳"],
  ["Subaccounts", "/admin/subaccounts", "🏦"],
  ["Wallets", "/admin/wallets", "👛"],
  ["Reports", "/admin/reports", "📈"],
  ["Audit Logs", "/admin/audit-logs", "🔒"],
  ["Settings", "/admin/settings", "⚙️"],
];

export function AdminNav({
  email,
  name,
  businessName,
}: {
  email: string;
  name: string;
  businessName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Exact match for the dashboard, prefix match for sections, so
  // /admin/bundles does not also light up /admin.
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const current = NAV.find(([, href]) => isActive(href))?.[0] ?? "Admin";

  return (
    <>
      {/* Mobile top bar */}
      <div
        className="sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 lg:hidden"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="btn-ghost !min-h-10 !px-3"
        >
          ☰
        </button>
        <span className="font-semibold">{current}</span>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <aside
            className="absolute left-0 top-0 flex h-full w-72 flex-col overflow-y-auto p-4"
            style={{ background: "var(--surface)" }}
          >
            <Header name={name} email={email} businessName={businessName} />
            <nav className="mt-4 flex flex-col gap-1">
              {NAV.map(([label, href, icon]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`nav-link ${isActive(href) ? "nav-link-active" : ""}`}
                >
                  <span aria-hidden>{icon}</span>
                  {label}
                </Link>
              ))}
              <LogoutButton />
            </nav>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className="hidden w-64 shrink-0 border-r lg:flex lg:flex-col"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="sticky top-0 p-4">
          <Header name={name} email={email} businessName={businessName} />
          <nav className="mt-4 flex flex-col gap-1">
            {NAV.map(([label, href, icon]) => (
              <Link
                key={href}
                href={href}
                className={`nav-link ${isActive(href) ? "nav-link-active" : ""}`}
              >
                <span aria-hidden>{icon}</span>
                {label}
              </Link>
            ))}
            <LogoutButton />
          </nav>
        </div>
      </aside>
    </>
  );
}

function Header({
  name,
  email,
  businessName,
}: {
  name: string;
  email: string;
  businessName: string;
}) {
  return (
    <div>
      <p className="text-lg font-extrabold tracking-tight">{businessName}</p>
      <p className="muted text-[11px] font-semibold uppercase tracking-widest">Admin</p>
      <p className="muted truncate text-xs">{name}</p>
      <p className="muted truncate text-xs">{email}</p>
    </div>
  );
}

function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <button onClick={logout} className="nav-link mt-2 text-left">
      <span aria-hidden>↩</span> Sign out
    </button>
  );
}
