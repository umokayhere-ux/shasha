import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, parseBody, ApiError } from "@/lib/api";
import { requireSuperAdmin } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

const patchSchema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireSuperAdmin();
  const { id } = await ctx.params;
  const input = await parseBody(req, patchSchema);

  const existing = await prisma.paystackSubaccount.findUnique({ where: { publicId: id } });
  if (!existing) throw new ApiError("Subaccount not found", 404);

  const subaccount = await prisma.paystackSubaccount.update({
    where: { id: existing.id },
    data: { displayName: input.displayName ?? undefined, isActive: input.isActive ?? undefined },
  });

  await recordAudit({
    actorId: admin.id,
    action: input.isActive === undefined
      ? "SUBACCOUNT_UPDATED"
      : input.isActive
        ? "SUBACCOUNT_ACTIVATED"
        : "SUBACCOUNT_DEACTIVATED",
    resourceType: "PaystackSubaccount",
    resourceId: existing.id,
    oldValues: { isActive: existing.isActive },
    newValues: { isActive: subaccount.isActive },
  });

  return ok({ subaccount });
});
