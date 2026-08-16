import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

const BUSINESS = process.env.BUSINESS_NAME ?? "Shasha";

/**
 * The catalog is fetched defensively: a database outage should degrade the
 * storefront to an empty state, not return a 500 to every visitor.
 */
async function loadCatalog() {
  try {
    const [networks, featured] = await Promise.all([
      prisma.network.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { displayOrder: "asc" },
        select: { publicId: true, name: true, slug: true },
      }),
      prisma.bundle.findMany({
        where: { isActive: true, deletedAt: null, network: { isActive: true } },
        orderBy: [{ isFeatured: "desc" }, { displayOrder: "asc" }],
        take: 6,
        select: {
          publicId: true,
          name: true,
          sellingPrice: true,
          validityDays: true,
          network: { select: { name: true } },
        },
      }),
    ]);
    return { networks, featured, degraded: false };
  } catch (err) {
    console.error("[home] catalog unavailable", err);
    return { networks: [], featured: [], degraded: true };
  }
}

export default async function HomePage() {
  const { networks, featured, degraded } = await loadCatalog();

  return (
    <div>
      <header className="sticky top-0 z-10 border-b bg-[var(--surface)]/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold">
            {BUSINESS}
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost">
              Sign in
            </Link>
            <Link href="/register" className="btn-primary">
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        <section className="py-14 text-center sm:py-20">
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
            Data bundles, delivered in seconds
          </h1>
          <p className="muted mx-auto mt-4 max-w-xl text-base sm:text-lg">
            Pick a bundle, enter the number, pay securely. We handle the rest.
          </p>
          <Link href="/buy" className="btn-primary mt-8 px-8 text-base">
            Buy data now
          </Link>
        </section>

        <section className="pb-12">
          <h2 className="mb-4 text-xl font-semibold">Available networks</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {networks.map((network) => (
              <Link
                key={network.publicId}
                href={`/buy?network=${network.slug}`}
                className="card text-center font-semibold hover:border-brand-500"
              >
                {network.name}
              </Link>
            ))}
            {networks.length === 0 && (
              <p className="muted col-span-full">
                {degraded
                  ? "We're having trouble loading bundles right now. Please try again shortly."
                  : "Networks are being set up. Check back shortly."}
              </p>
            )}
          </div>
        </section>

        <section className="pb-12">
          <h2 className="mb-4 text-xl font-semibold">Popular bundles</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((bundle) => (
              <div key={bundle.publicId} className="card flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    {bundle.network.name} {bundle.name}
                  </p>
                  <p className="muted text-sm">Valid for {bundle.validityDays} days</p>
                </div>
                <p className="text-lg font-bold">{formatMoney(bundle.sellingPrice)}</p>
              </div>
            ))}
            {featured.length === 0 && <p className="muted">No bundles published yet.</p>}
          </div>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-3">
          {[
            ["1. Choose a bundle", "Pick your network and the data you need."],
            ["2. Enter the number", "Send data to yourself or anyone else."],
            ["3. Pay and receive", "Secure checkout, then instant delivery."],
          ].map(([title, body]) => (
            <div key={title} className="card">
              <h3 className="font-semibold">{title}</h3>
              <p className="muted mt-1 text-sm">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm">
        <p className="muted">
          © {new Date().getFullYear()} {BUSINESS}. Need help?{" "}
          {process.env.SUPPORT_EMAIL ?? "support@example.com"}
        </p>
      </footer>
    </div>
  );
}
