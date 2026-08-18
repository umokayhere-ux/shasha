import Link from "next/link";
import { BUSINESS_NAME, BUSINESS_TAGLINE } from "@/lib/branding";

/**
 * Split-panel auth layout: an emerald brand panel with a swept curve beside the
 * form.
 *
 * On phones the panel becomes a compact banner — logo and name only — and the
 * marketing copy and cross-link are dropped, because stacking the full panel
 * above the form pushed the submit button below the fold. The same cross-link
 * already sits under the form, so nothing is lost. From md upwards the full
 * two-column treatment returns.
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
      className="flex min-h-screen items-center justify-center p-3 sm:p-4"
      style={{ background: "var(--bg)" }}
    >
      <div className="auth-shell grid md:grid-cols-2">
        {/* Brand panel — compact banner on phones, full panel from md up */}
        <section className="auth-panel auth-curve flex flex-col items-center px-6 py-6 text-center md:justify-center md:px-8 md:py-14">
          <span
            className="grid h-11 w-11 place-items-center rounded-full md:h-16 md:w-16"
            style={{ background: "#ffffff" }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 md:h-7 md:w-7" aria-hidden>
              <path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="var(--cust-deep)" />
            </svg>
          </span>
          <p className="mt-2 text-sm font-semibold tracking-wide md:mt-3">{BUSINESS_NAME}</p>

          <h2 className="mt-6 hidden text-3xl font-bold md:block">{panelTitle}</h2>
          <p className="mt-2 hidden max-w-xs text-sm opacity-85 md:block">{panelBody}</p>

          <Link
            href={panelCtaHref}
            className="btn-pill mt-6 hidden max-w-[16rem] border md:inline-flex"
            style={{ borderColor: "rgba(255,255,255,0.75)", color: "#ffffff" }}
          >
            {panelCtaLabel}
          </Link>
        </section>

        {/* Form panel */}
        <section className="px-6 py-7 md:px-7 md:py-14">
          <div className="mx-auto w-full max-w-sm">
            <h1
              className="text-center text-3xl font-bold lowercase md:text-4xl"
              style={{ color: "var(--cust-deep)" }}
            >
              {heading}
            </h1>
            <p className="muted mt-1 text-center text-xs md:text-sm">{subheading}</p>
            {children}
            <p className="muted mt-5 hidden text-center text-[11px] md:block">
              {BUSINESS_TAGLINE}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
