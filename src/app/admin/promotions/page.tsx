import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { PageHeader, EmptyState } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage() {
  const promotions = await prisma.promotion.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader
        title="Promotions"
        subtitle="Discounts are validated and calculated server-side; the browser cannot set an amount."
      />
      <div className="card">
        {promotions.length === 0 ? (
          <EmptyState message="No promotions created yet." />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[680px]">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Used</th>
                  <th>Expires</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((p) => (
                  <tr key={p.publicId}>
                    <td className="font-mono text-xs font-semibold">{p.code}</td>
                    <td>{p.name}</td>
                    <td className="capitalize">{p.type.toLowerCase()}</td>
                    <td>{p.type === "PERCENTAGE" ? `${p.value}%` : formatMoney(p.value)}</td>
                    <td>
                      {p.usageCount}
                      {p.usageLimit != null ? ` / ${p.usageLimit}` : ""}
                    </td>
                    <td className="muted text-xs">
                      {p.endsAt ? new Date(p.endsAt).toLocaleDateString() : "—"}
                    </td>
                    <td>
                      <span className={`badge ${p.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                        {p.isActive ? "active" : "inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
