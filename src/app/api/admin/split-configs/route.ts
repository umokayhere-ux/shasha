import { SplitMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handler, ok, parseBody, ApiError } from "@/lib/api";
import { requireSuperAdmin } from "@/lib/auth";
import { splitConfigSchema } from "@/lib/validation";
import { toMinor } from "@/lib/money";
import { recordAudit } from "@/lib/audit";

export const GET = handler(async () => {
  await requireSuperAdmin();
  const configs = await prisma.paymentSplitConfiguration.findMany({
    orderBy: { createdAt: "desc" },
    include: { subaccount: { select: { publicId: true, displayName: true, subaccountCode: true } } },
  });
  return ok({ configs });
});

export const POST = handler(async (req: Request) => {
  const admin = await requireSuperAdmin();
  const input = await parseBody(req, splitConfigSchema);

  let subaccountId: string | null = null;
  if (input.mode === "SUBACCOUNT_SPLIT") {
    if (!input.subaccountId) throw new ApiError("Select a subaccount for split mode.", 422);
    const sub = await prisma.paystackSubaccount.findUnique({
      where: { publicId: input.subaccountId },
    });
    if (!sub) throw new ApiError("Subaccount not found", 404);
    subaccountId = sub.id;
  }
  if (input.percentageCharge == null && input.transactionCharge == null && input.mode === "SUBACCOUNT_SPLIT") {
    throw new ApiError("Set either a percentage charge or a flat transaction charge.", 422);
  }

  const config = await prisma.$transaction(async (tx) => {
    // Exactly one default may be active at a time.
    if (input.isDefault) {
      await tx.paymentSplitConfiguration.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.paymentSplitConfiguration.create({
      data: {
        name: input.name,
        subaccountId,
        mode: input.mode as SplitMode,
        bearer: input.bearer,
        percentageCharge: input.percentageCharge ?? null,
        transactionCharge:
          input.transactionCharge != null ? toMinor(input.transactionCharge) : null,
        isDefault: input.isDefault,
        isActive: input.isActive,
      },
    });
  });

  await recordAudit({
    actorId: admin.id,
    action: "SPLIT_CONFIG_CREATED",
    resourceType: "PaymentSplitConfiguration",
    resourceId: config.id,
    newValues: { name: config.name, mode: config.mode, isDefault: config.isDefault },
  });

  return ok({ config }, 201);
});
