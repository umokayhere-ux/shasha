import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { PageHeader, EmptyState } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function AdminWalletsPage() {
  const [wallets, transactions, total] = await Promise.all([
    prisma.wallet.findMany({
      orderBy: { balance: "desc" },
      take: 50,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.walletTransaction.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.wallet.aggregate({ _sum: { balance: true } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Wallets"
        subtitle={`Total customer balance held: ${formatMoney(total._sum.balance ?? 0)}`}
      />

      <div className="card mb-6">
        <h2 className="mb-3 font-semibold">Balances</h2>
        {wallets.length === 0 ? (
          <EmptyState message="No wallets yet." />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[520px]">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Balance</th>
                  <th>Locked</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w) => (
                  <tr key={w.id}>
                    <td className="font-medium">{w.user.name}</td>
                    <td className="muted">{w.user.email}</td>
                    <td className="font-semibold">{formatMoney(w.balance)}</td>
                    <td>{w.isLocked ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Recent transactions</h2>
        {transactions.length === 0 ? (
          <EmptyState message="No wallet activity yet." />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[620px]">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Direction</th>
                  <th>Amount</th>
                  <th>Balance after</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.publicId}>
                    <td className="font-mono text-xs">{t.reference}</td>
                    <td className="capitalize">{t.type.toLowerCase()}</td>
                    <td className={t.direction === "CREDIT" ? "text-emerald-600" : "text-rose-600"}>
                      {t.direction === "CREDIT" ? "+" : "−"}
                    </td>
                    <td className="font-semibold">{formatMoney(t.amount)}</td>
                    <td>{formatMoney(t.balanceAfter)}</td>
                    <td className="muted text-xs">{new Date(t.createdAt).toLocaleDateString()}</td>
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
