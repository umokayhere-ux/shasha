import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { PageHeader, EmptyState } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  const customers = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    orderBy: { createdAt: "desc" },
    take: 100,
    // passwordHash is never selected.
    select: {
      publicId: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      wallet: { select: { balance: true } },
      _count: { select: { orders: true } },
    },
  });

  return (
    <div>
      <PageHeader title="Customers" subtitle={`${customers.length} registered customer(s).`} />
      <div className="card">
        {customers.length === 0 ? (
          <EmptyState message="No customers have registered yet." />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Orders</th>
                  <th>Wallet</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.publicId}>
                    <td className="font-medium">{c.name}</td>
                    <td className="muted">{c.email}</td>
                    <td className="font-mono text-xs">{c.phone ?? "—"}</td>
                    <td>{c._count.orders}</td>
                    <td>{formatMoney(c.wallet?.balance ?? 0)}</td>
                    <td>
                      <span className={`badge ${c.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                        {c.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="muted text-xs">
                      {new Date(c.createdAt).toLocaleDateString()}
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
