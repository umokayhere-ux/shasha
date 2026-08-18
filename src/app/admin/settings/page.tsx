import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  if (user?.role !== "SUPER_ADMIN") redirect("/admin");

  // Secret-flagged rows are excluded; real secrets live in env vars, not here.
  const settings = await prisma.systemSetting.findMany({ where: { isSecret: false } });

  const integrations = [
    ["Paystack secret key", Boolean(process.env.PAYSTACK_SECRET_KEY)],
    ["Paystack public key", Boolean(process.env.PAYSTACK_PUBLIC_KEY)],
    ["Data provider API", Boolean(process.env.DATA_PROVIDER_API_KEY)],
    ["Cron secret", Boolean(process.env.CRON_SECRET)],
    ["Email delivery", process.env.EMAIL_ENABLED === "true"],
  ] as const;

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Credentials are read from environment variables and are never displayed here."
      />

      <div className="card mb-6">
        <h2 className="mb-3 font-semibold">Integrations</h2>
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {integrations.map(([label, configured]) => (
            <li key={label} className="flex items-center justify-between py-3 text-sm">
              <span>{label}</span>
              <span className={`${configured ? "badge-ok" : "badge-warn"}`}>
                {configured ? "configured" : "not set"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Platform settings</h2>
        {settings.length === 0 ? (
          <p className="muted text-sm">No settings stored yet.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {settings.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="muted">{s.key.replace(/_/g, " ")}</span>
                <span className="font-medium">{JSON.stringify(s.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
