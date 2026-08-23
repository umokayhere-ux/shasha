import { z } from "zod";
import { Role, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handler, ok, parseBody, ApiError } from "@/lib/api";
import { requireAdmin, requireSuperAdmin, revokeAllSessions } from "@/lib/auth";
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

/**
 * Soft-deletes a customer.
 *
 * The row is retained rather than removed: orders, payments and wallet ledger
 * entries are financial records that must survive the customer, and a hard
 * delete would orphan them. `deletedAt` is what every listing and `authenticate`
 * already filter on, so the account disappears from the admin and can no longer
 * sign in.
 *
 * The unique email and phone are tombstoned on the way out. Both columns are
 * unique, so leaving them intact would permanently block that person from ever
 * registering again — they would just be told the account already exists. The
 * original values stay readable in the tombstone and in the audit trail.
 */
export const DELETE = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  // Deleting an account is destructive and irreversible from the UI, so it is
  // held to a higher bar than suspending one.
  const admin = await requireSuperAdmin();
  const { id } = await ctx.params;

  const customer = await prisma.user.findUnique({ where: { publicId: id } });
  if (!customer || customer.role !== Role.CUSTOMER) throw new ApiError("Customer not found", 404);
  if (customer.deletedAt) throw new ApiError("This customer has already been deleted.", 409);

  const stamp = Date.now();
  await prisma.user.update({
    where: { id: customer.id },
    data: {
      deletedAt: new Date(),
      status: UserStatus.SUSPENDED,
      email: `deleted.${stamp}.${customer.email}`,
      phone: customer.phone ? `deleted.${stamp}.${customer.phone}` : null,
    },
  });

  // Any open session must stop working immediately, not at its next expiry.
  await revokeAllSessions(customer.id);

  await recordAudit({
    actorId: admin.id,
    action: "CUSTOMER_DELETED",
    resourceType: "User",
    resourceId: customer.id,
    oldValues: { name: customer.name, email: customer.email, phone: customer.phone },
  });

  return ok({ deleted: true });
});
