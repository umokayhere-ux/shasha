"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Fixed bottom navigation with a raised centre action, in the style of a
 * banking app. Every tab points at a page that exists — no decorative
 * destinations that dead-end.
 */
const TABS: Array<[string, string, string]> = [
  ["Home", "/dashboard", "⌂"],
  ["Orders", "/orders", "🧾"],
];

const TABS_RIGHT: Array<[string, string, string]> = [
  ["Alerts", "/notifications", "🔔"],
  ["Account", "/account", "👤"],
];

export function CustomerTabBar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Spacer so page content is never hidden behind the fixed bar. */}
      <div className="h-24" aria-hidden />

      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3">
        <div
          className="relative mx-auto flex max-w-lg items-center justify-between rounded-3xl px-3 py-2.5"
          style={{
            background: "var(--cust-deep)",
            boxShadow: "0 -6px 24px rgba(2, 32, 22, 0.28)",
          }}
        >
          {TABS.map(([label, href, icon]) => (
            <Tab key={href} label={label} href={href} icon={icon} active={isActive(href)} />
          ))}

          {/* Raised primary action */}
          <Link
            href="/buy"
            aria-label="Buy data"
            className="-mt-8 grid h-16 w-16 shrink-0 place-items-center rounded-full text-2xl transition active:scale-95"
            style={{
              background: "var(--cust-lime)",
              color: "var(--cust-deep)",
              boxShadow: "0 10px 24px rgba(2, 32, 22, 0.35)",
            }}
          >
            ⚡
          </Link>

          {TABS_RIGHT.map(([label, href, icon]) => (
            <Tab key={href} label={label} href={href} icon={icon} active={isActive(href)} />
          ))}
        </div>
      </nav>
    </>
  );
}

function Tab({
  label,
  href,
  icon,
  active,
}: {
  label: string;
  href: string;
  icon: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex w-16 flex-col items-center gap-0.5 py-1 text-[10px] font-semibold"
      style={{ color: active ? "var(--cust-lime)" : "rgba(255,255,255,0.65)" }}
    >
      <span aria-hidden className="text-lg leading-none">
        {icon}
      </span>
      {label}
    </Link>
  );
}
