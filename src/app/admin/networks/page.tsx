import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function AdminNetworksPage() {
  const networks = await prisma.network.findMany({
    where: { deletedAt: null },
    orderBy: { displayOrder: "asc" },
    include: { _count: { select: { bundles: true, orders: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Networks"
        subtitle="Networks come from the database, so new ones need no code change."
      />
      <div className="card">
        {networks.length === 0 ? (
          <EmptyState message="No networks yet. Run /setup to seed them." />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[560px]">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Bundles</th>
                  <th>Orders</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {networks.map((n) => (
                  <tr key={n.publicId}>
                    <td className="font-medium">{n.name}</td>
                    <td className="muted font-mono text-xs">{n.slug}</td>
                    <td>{n._count.bundles}</td>
                    <td>{n._count.orders}</td>
                    <td>
                      <span className={`badge ${n.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                        {n.isActive ? "active" : "inactive"}
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
