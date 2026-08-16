import { prisma } from "@/lib/db";
import { handler, ok, parsePagination } from "@/lib/api";
import { requireSuperAdmin } from "@/lib/auth";

// Read-only by design: no create/update/delete endpoints exist for audit logs.
export const GET = handler(async (req: Request) => {
  await requireSuperAdmin();
  const url = new URL(req.url);
  const { page, pageSize, skip, take } = parsePagination(url);
  const action = url.searchParams.get("action");

  const where = action ? { action } : {};
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { actor: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return ok({ logs, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
});
