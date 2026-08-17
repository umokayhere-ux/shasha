"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Fixed bottom navigation with a raised centre action.
 *
 * Icons are inline SVG rather than emoji: emoji render in each platform's own
 * colour and weight, which made the bar look like five unrelated pictures.
 * Every tab points at a page that exists — no decorative dead ends.
 */

function Icon({ path, filled = false }: { path: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

const HOME = "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z";
const RECEIPT = "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6";
const BELL = "M18 8a6 6 0 1 0-12 0c0 7-2 8-2 8h16s-2-1-2-8M13.7 21a2 2 0 0 1-3.4 0";
const USER = "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8";
const BOLT = "M13 2 4 14h6l-1 8 9-12h-6z";

const LEFT: Array<[string, string, string]> = [
  ["Home", "/dashboard", HOME],
  ["Orders", "/orders", RECEIPT],
];

const RIGHT: Array<[string, string, string]> = [
  ["Alerts", "/notifications", BELL],
  ["Account", "/account", USER],
];

export function CustomerTabBar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Spacer so content is never hidden behind the fixed bar. */}
      <div className="h-24" aria-hidden />

      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3">
        <div
          className="mx-auto flex max-w-lg items-center justify-between rounded-[1.75rem] px-2 py-2"
          style={{
            background: "var(--cust-deep)",
            boxShadow: "0 -4px 20px rgba(2, 32, 22, 0.25)",
          }}
        >
          {LEFT.map(([label, href, path]) => (
            <Tab key={href} label={label} href={href} path={path} active={isActive(href)} />
          ))}

          <Link
            href="/buy"
            aria-label="Buy data"
            className="-mt-7 grid h-14 w-14 shrink-0 place-items-center rounded-full transition active:scale-95"
            style={{
              background: "var(--cust-lime)",
              color: "var(--cust-deep)",
              boxShadow: "0 8px 20px rgba(2, 32, 22, 0.35)",
            }}
          >
            <Icon path={BOLT} filled />
          </Link>

          {RIGHT.map(([label, href, path]) => (
            <Tab key={href} label={label} href={href} path={path} active={isActive(href)} />
          ))}
        </div>
      </nav>
    </>
  );
}

function Tab({
  label,
  href,
  path,
  active,
}: {
  label: string;
  href: string;
  path: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex w-16 flex-col items-center gap-1 py-1.5 text-[10px] font-semibold"
      style={{ color: active ? "var(--cust-lime)" : "rgba(255,255,255,0.6)" }}
    >
      <Icon path={path} />
      {label}
    </Link>
  );
}
