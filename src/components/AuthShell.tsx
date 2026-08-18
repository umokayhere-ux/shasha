import Link from "next/link";
import { BUSINESS_NAME, BUSINESS_TAGLINE } from "@/lib/branding";

/**
 * Split-panel auth layout: an emerald brand panel with a swept curve beside the
 * form. On phones the panel stacks above the form and the curve runs along its
 * bottom edge, so the shape survives without a second layout.
 */
export function AuthShell({
  heading,
  subheading,
  panelTitle,
  panelBody,
  panelCtaLabel,
  panelCtaHref,
  children,
}: {
  heading: string;
  subheading: string;
  panelTitle: string;
  panelBody: string;
  panelCtaLabel: string;
  panelCtaHref: string;
  children: React.ReactNode;
}) {
  return (
    <main
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: "var(--bg)" }}
    >
      <div className="auth-shell grid md:grid-cols-2">
        {/* Brand panel */}
        <section className="auth-panel auth-curve flex flex-col items-center px-8 py-10 text-center md:justify-center md:py-14">
          <span
            className="grid h-16 w-16 place-items-center rounded-full"
            style={{ background: "#ffffff" }}
          >
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
              <path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="var(--cust-deep)" />
            </svg>
          </span>
          <p className="mt-3 text-sm font-semibold tracking-wide">{BUSINESS_NAME}</p>

          <h2 className="mt-6 text-3xl font-bold">{panelTitle}</h2>
          <p className="mt-2 max-w-xs text-sm opacity-85">{panelBody}</p>

          <Link
            href={panelCtaHref}
            className="btn-pill mt-6 max-w-[16rem] border"
            style={{ borderColor: "rgba(255,255,255,0.75)", color: "#ffffff" }}
          >
            {panelCtaLabel}
          </Link>
        </section>

        {/* Form panel */}
        <section className="px-7 py-10 md:py-14">
          <div className="mx-auto w-full max-w-sm">
            <h1
              className="text-center text-4xl font-bold lowercase"
              style={{ color: "var(--cust-deep)" }}
            >
              {heading}
            </h1>
            <p className="muted mt-1 text-center text-sm">{subheading}</p>
            {children}
            <p className="muted mt-8 text-center text-[11px]">{BUSINESS_TAGLINE}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
