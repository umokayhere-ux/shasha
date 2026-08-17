import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { CustomerTabBar } from "@/components/CustomerTabBar";
import { SignOutButton } from "@/components/SignOutButton";
import { BUSINESS_NAME } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [profile, spend, delivered] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      // passwordHash is never selected.
      select: { name: true, email: true, phone: true, createdAt: true },
    }),
    prisma.order.aggregate({
      where: { customerId: user.id, paymentStatus: "PAID" },
      _sum: { finalAmount: true },
      _count: true,
    }),
    prisma.order.count({ where: { customerId: user.id, status: "SUCCESSFUL" } }),
  ]);

  const firstName = user.name.split(" ")[0];

  return (
    <div className="min-h-screen">
      <header
        className="rounded-b-[2rem] px-5 pb-8 pt-6 text-center"
        style={{ background: "var(--cust-deep)", color: "var(--cust-on-deep)" }}
      >
        <span
          className="mx-auto grid h-16 w-16 place-items-center rounded-full text-2xl font-extrabold"
          style={{ background: "var(--cust-lime)", color: "var(--cust-deep)" }}
        >
          {firstName.charAt(0).toUpperCase()}
        </span>
        <h1 className="mt-3 text-xl font-extrabold">{profile?.name}</h1>
        <p className="text-sm opacity-75">{profile?.email}</p>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="stat text-center">
            <p className="muted text-xs uppercase tracking-wide">Total spent</p>
            <p className="mt-1 text-lg font-extrabold">
              {formatMoney(spend._sum.finalAmount ?? 0)}
            </p>
          </div>
          <div className="stat text-center">
            <p className="muted text-xs uppercase tracking-wide">Delivered</p>
            <p className="mt-1 text-lg font-extrabold">{delivered}</p>
          </div>
        </div>

        <section className="card">
          <h2 className="mb-3 text-sm font-bold">Your details</h2>
          <ul className="divide-y text-sm" style={{ borderColor: "var(--border)" }}>
            <Row label="Name" value={profile?.name ?? "—"} />
            <Row label="Email" value={profile?.email ?? "—"} />
            <Row label="Phone" value={profile?.phone ?? "—"} />
            <Row
              label="Member since"
              value={profile ? new Date(profile.createdAt).toLocaleDateString() : "—"}
            />
          </ul>
        </section>

        <div className="mt-5">
          <SignOutButton />
        </div>

        <p className="muted mt-6 text-center text-xs">
          {BUSINESS_NAME} · Need help? {process.env.SUPPORT_EMAIL ?? "support@example.com"}
        </p>
      </main>

      <CustomerTabBar />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <span className="muted">{label}</span>
      <span className="truncate font-semibold">{value}</span>
    </li>
  );
}
