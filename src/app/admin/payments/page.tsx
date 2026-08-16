import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader, EmptyState } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const [payments, webhooks] = await Promise.all([
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { customer: { select: { name: true, email: true } } },
    }),
    prisma.paymentWebhookEvent.count(),
  ]);

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle={`${webhooks} webhook event(s) received and de-duplicated.`}
      />
      <div className="card">
        {payments.length === 0 ? (
          <EmptyState message="No payments recorded yet." />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[820px]">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Channel</th>
                  <th>Settlement</th>
                  <th>Status</th>
                  <th>Verified</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.publicId}>
                    <td className="font-mono text-xs">{p.providerReference}</td>
                    <td>{p.customer.name}</td>
                    <td className="font-semibold">{formatMoney(p.amount)}</td>
                    <td className="muted">{p.channel ?? "—"}</td>
                    {/* Split snapshot captured at initialization. */}
                    <td className="muted text-xs">
                      {p.splitMode === "SUBACCOUNT_SPLIT" ? p.subaccountCode ?? "split" : "platform"}
                    </td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="muted text-xs">
                      {p.verifiedAt ? new Date(p.verifiedAt).toLocaleString() : "—"}
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
