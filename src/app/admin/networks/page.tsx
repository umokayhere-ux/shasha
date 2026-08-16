import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { SeedButton } from "./SeedButton";
import { LogoUploader } from "./LogoUploader";

export const dynamic = "force-dynamic";

export default async function AdminNetworksPage() {
  const networks = await prisma.network.findMany({
    // On MongoDB a never-deleted document has no deletedAt field at all, which
    // is distinct from an explicit null — match both so seeded rows are listed.
    where: { OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] },
    orderBy: { displayOrder: "asc" },
    include: { _count: { select: { bundles: true, orders: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Networks"
        subtitle="Networks come from the database, so new ones need no code change."
        action={<SeedButton hasNetworks={networks.length > 0} />}
      />
      <div className="card">
        {networks.length === 0 ? (
          <EmptyState message="No networks yet. Use the seed button above to create MTN, Telecel and AirtelTigo with starter bundles." />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>Logo</th>
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
                    <td>
                      <LogoUploader
                        networkId={n.publicId}
                        networkName={n.name}
                        currentLogo={n.logoUrl}
                      />
                    </td>
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
