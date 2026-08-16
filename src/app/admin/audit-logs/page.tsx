import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage() {
  // Audit history is Super Admin only, even among admins.
  const user = await getCurrentUser();
  if (user?.role !== "SUPER_ADMIN") redirect("/admin");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { name: true, email: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Audit logs"
        subtitle="Read-only. Sensitive values are redacted before they are written."
      />
      <div className="card">
        {logs.length === 0 ? (
          <EmptyState message="No admin actions recorded yet." />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[640px]">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Admin</th>
                  <th>IP</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="font-medium">{l.action.replace(/_/g, " ").toLowerCase()}</td>
                    <td className="muted">{l.resourceType}</td>
                    <td>{l.actor?.name ?? "system"}</td>
                    <td className="muted font-mono text-xs">{l.ip ?? "—"}</td>
                    <td className="muted text-xs">{new Date(l.createdAt).toLocaleString()}</td>
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
