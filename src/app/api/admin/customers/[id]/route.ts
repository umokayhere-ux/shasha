import { z } from "zod";
import { Role, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handler, ok, parseBody, ApiError } from "@/lib/api";
import { requireAdmin, revokeAllSessions } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

const patchSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });

export const PATCH = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const { status } = await parseBody(req, patchSchema);

  const customer = await prisma.user.findUnique({ where: { publicId: id } });
  if (!customer || customer.role !== Role.CUSTOMER) throw new ApiError("Customer not found", 404);

  const updated = await prisma.user.update({
    where: { id: customer.id },
    data: { status: status as UserStatus },
  });
  // A suspended customer must lose active sessions immediately.
  if (status === "SUSPENDED") await revokeAllSessions(customer.id);

  await recordAudit({
    actorId: admin.id,
    action: status === "SUSPENDED" ? "CUSTOMER_SUSPENDED" : "CUSTOMER_ACTIVATED",
    resourceType: "User",
    resourceId: customer.id,
    oldValues: { status: customer.status },
    newValues: { status: updated.status },
  });

  return ok({ status: updated.status });
});
