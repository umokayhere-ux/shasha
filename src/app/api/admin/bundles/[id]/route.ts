import { prisma } from "@/lib/db";
import { handler, ok, parseBody, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { bundleUpdateSchema } from "@/lib/validation";
import { toMinor } from "@/lib/money";
import { recordAudit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const input = await parseBody(req, bundleUpdateSchema);

  const existing = await prisma.bundle.findUnique({ where: { publicId: id } });
  if (!existing || existing.deletedAt) throw new ApiError("Bundle not found", 404);

  const sellingPrice =
    input.sellingPrice != null ? toMinor(input.sellingPrice) : existing.sellingPrice;
  const costPrice = input.costPrice != null ? toMinor(input.costPrice) : existing.costPrice;
  if (sellingPrice < costPrice) {
    throw new ApiError("Selling price cannot be below cost price.", 422);
  }

  const priceChanged =
    sellingPrice !== existing.sellingPrice || costPrice !== existing.costPrice;

  const bundle = await prisma.$transaction(async (tx) => {
    const updated = await tx.bundle.update({
      where: { id: existing.id },
      data: {
        name: input.name ?? undefined,
        dataAmount:
          input.dataAmount != null
            ? input.dataUnit === "GB"
              ? input.dataAmount * 1024
              : input.dataAmount
            : undefined,
        sellingPrice,
        costPrice,
        validityDays: input.validityDays ?? undefined,
        description: input.description ?? undefined,
        providerCode: input.providerCode ?? undefined,
        isActive: input.isActive ?? undefined,
        isFeatured: input.isFeatured ?? undefined,
        displayOrder: input.displayOrder ?? undefined,
      },
    });

    // Every price movement is recorded. Past orders keep their own snapshot
    // and are never recalculated from this row.
    if (priceChanged) {
      await tx.bundlePriceHistory.create({
        data: {
          bundleId: existing.id,
          oldSellingPrice: existing.sellingPrice,
          newSellingPrice: sellingPrice,
          oldCostPrice: existing.costPrice,
          newCostPrice: costPrice,
          changedByUserId: admin.id,
          reason: input.priceChangeReason ?? null,
        },
      });
    }
    return updated;
  });

  await recordAudit({
    actorId: admin.id,
    action: priceChanged ? "BUNDLE_PRICE_CHANGED" : "BUNDLE_UPDATED",
    resourceType: "Bundle",
    resourceId: existing.id,
    oldValues: { sellingPrice: existing.sellingPrice, costPrice: existing.costPrice },
    newValues: { sellingPrice, costPrice },
  });

  return ok({ bundle });
});

// Soft delete only — bundles are referenced by historical financial records.
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;

  const existing = await prisma.bundle.findUnique({ where: { publicId: id } });
  if (!existing || existing.deletedAt) throw new ApiError("Bundle not found", 404);

  await prisma.bundle.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), isActive: false },
  });
  await recordAudit({
    actorId: admin.id,
    action: "BUNDLE_DELETED",
    resourceType: "Bundle",
    resourceId: existing.id,
    oldValues: { name: existing.name },
  });

  return ok({ deleted: true });
});
