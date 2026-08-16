import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SubaccountsPage() {
  // Settlement configuration is Super Admin only, even among admins.
  const user = await getCurrentUser();
  if (user?.role !== "SUPER_ADMIN") redirect("/admin");

  const [subaccounts, configs] = await Promise.all([
    prisma.paystackSubaccount.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.paymentSplitConfiguration.findMany({
      orderBy: { createdAt: "desc" },
      include: { subaccount: { select: { displayName: true } } },
    }),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Paystack subaccounts</h1>
      <p className="muted mb-6 text-sm">
        Settlement destinations for split payments. These are not customer accounts, and are never
        exposed to the storefront.
      </p>

      <section className="card mb-6 overflow-x-auto">
        <h2 className="mb-3 font-semibold">Subaccounts</h2>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="muted text-xs uppercase">
            <tr>
              <th className="pb-2">Name</th>
              <th className="pb-2">Subaccount code</th>
              <th className="pb-2">Bank</th>
              <th className="pb-2">Account</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {subaccounts.map((s) => (
              <tr key={s.publicId}>
                <td className="py-2 font-medium">{s.displayName}</td>
                <td className="py-2 font-mono text-xs">{s.subaccountCode}</td>
                <td className="py-2">{s.settlementBank ?? "—"}</td>
                {/* Only the masked tail is stored, so only it can be shown. */}
                <td className="py-2 font-mono text-xs">{s.accountNumberMasked ?? "—"}</td>
                <td className="py-2">
                  <span className={`badge ${s.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                    {s.isActive ? "active" : "inactive"}
                  </span>
                </td>
              </tr>
            ))}
            {subaccounts.length === 0 && (
              <tr>
                <td colSpan={5} className="muted py-6 text-center">
                  No subaccounts linked. Payments settle to the main platform account.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Split configurations</h2>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="muted text-xs uppercase">
            <tr>
              <th className="pb-2">Name</th>
              <th className="pb-2">Mode</th>
              <th className="pb-2">Subaccount</th>
              <th className="pb-2">Charge</th>
              <th className="pb-2">Default</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {configs.map((c) => (
              <tr key={c.publicId}>
                <td className="py-2 font-medium">{c.name}</td>
                <td className="py-2">{c.mode.replace(/_/g, " ").toLowerCase()}</td>
                <td className="py-2">{c.subaccount?.displayName ?? "—"}</td>
                <td className="py-2">
                  {c.transactionCharge != null
                    ? `flat ${(c.transactionCharge / 100).toFixed(2)}`
                    : c.percentageCharge != null
                      ? `${c.percentageCharge}%`
                      : "—"}
                </td>
                <td className="py-2">{c.isDefault ? "Yes" : "No"}</td>
              </tr>
            ))}
            {configs.length === 0 && (
              <tr>
                <td colSpan={5} className="muted py-6 text-center">
                  No split configuration. All payments settle to the platform account.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
