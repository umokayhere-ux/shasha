import { prisma } from "@/lib/db";
import { handler, ok, parseBody, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { bundleSchema } from "@/lib/validation";
import { toMinor } from "@/lib/money";
import { recordAudit } from "@/lib/audit";
import { NOT_DELETED } from "@/lib/not-deleted";

export const GET = handler(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const networkId = url.searchParams.get("networkId");

  const bundles = await prisma.bundle.findMany({
    where: { ...NOT_DELETED, ...(networkId ? { network: { publicId: networkId } } : {}) },
    orderBy: [{ network: { displayOrder: "asc" } }, { displayOrder: "asc" }],
    include: { network: { select: { publicId: true, name: true } } },
  });

  return ok({
    bundles: bundles.map((b) => ({ ...b, margin: b.sellingPrice - b.costPrice })),
  });
});

export const POST = handler(async (req: Request) => {
  const admin = await requireAdmin();
  const input = await parseBody(req, bundleSchema);

  const network = await prisma.network.findUnique({ where: { publicId: input.networkId } });
  if (!network) throw new ApiError("Network not found", 404);

  const sellingPrice = toMinor(input.sellingPrice);
  const costPrice = toMinor(input.costPrice);
  if (sellingPrice < costPrice) {
    throw new ApiError("Selling price cannot be below cost price.", 422);
  }

  const bundle = await prisma.bundle.create({
    data: {
      networkId: network.id,
      name: input.name,
      dataAmount: input.dataUnit === "GB" ? input.dataAmount * 1024 : input.dataAmount,
      dataUnit: "MB",
      sellingPrice,
      costPrice,
      validityDays: input.validityDays,
      description: input.description ?? null,
      providerCode: input.providerCode ?? null,
      isActive: input.isActive,
      isFeatured: input.isFeatured,
      displayOrder: input.displayOrder,
    },
  });

  await recordAudit({
    actorId: admin.id,
    action: "BUNDLE_CREATED",
    resourceType: "Bundle",
    resourceId: bundle.id,
    newValues: { name: bundle.name, sellingPrice, costPrice },
  });

  return ok({ bundle }, 201);
});
