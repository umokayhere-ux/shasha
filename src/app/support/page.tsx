import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { BUSINESS_NAME } from "@/lib/branding";
import { normalizeWhatsApp } from "@/lib/support";
import { CustomerTabBar } from "@/components/CustomerTabBar";
import { ComplaintForm, type ComplaintOrderOption } from "@/components/ComplaintForm";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CUSTOMER") redirect("/admin");

  const [profile, orders] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { name: true, phone: true } }),
    prisma.order.findMany({
      where: { customerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        reference: true,
        networkNameSnapshot: true,
        bundleNameSnapshot: true,
        recipientPhone: true,
        createdAt: true,
      },
    }),
  ]);

  const options: ComplaintOrderOption[] = orders.map((o) => ({
    reference: o.reference,
    summary: `${o.networkNameSnapshot} ${o.bundleNameSnapshot} → ${o.recipientPhone} · ${new Date(
      o.createdAt,
    ).toLocaleDateString()}`,
  }));

  // Resolved server-side so the raw env value never reaches the browser.
  const whatsappNumber = normalizeWhatsApp(process.env.SUPPORT_WHATSAPP);

  return (
    <div className="min-h-screen">
      <header
        className="rounded-b-3xl px-5 pb-6 pt-5"
        style={{ background: "var(--cust-deep)", color: "var(--cust-on-deep)" }}
      >
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="Back to dashboard"
            className="grid h-9 w-9 place-items-center rounded-full"
            style={{ background: "rgba(255,255,255,0.14)", color: "var(--cust-on-deep)" }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-lg font-extrabold">Help &amp; complaints</h1>
        </div>
        <p className="mx-auto mt-3 max-w-lg text-sm opacity-75">
          Tell us what went wrong and we&apos;ll sort it out on WhatsApp.
        </p>
      </header>

      <main className="mx-auto max-w-lg px-4 py-5">
        <ComplaintForm
          whatsappNumber={whatsappNumber}
          business={BUSINESS_NAME}
          customerName={profile?.name ?? user.name}
          customerPhone={profile?.phone ?? null}
          orders={options}
        />
      </main>

      <CustomerTabBar />
    </div>
  );
}
