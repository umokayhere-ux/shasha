import { PromotionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handler, ok, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { promotionSchema } from "@/lib/validation";
import { toMinor } from "@/lib/money";
import { recordAudit } from "@/lib/audit";

export const GET = handler(async () => {
  await requireAdmin();
  const promotions = await prisma.promotion.findMany({ orderBy: { createdAt: "desc" } });
  return ok({ promotions });
});

export const POST = handler(async (req: Request) => {
  const admin = await requireAdmin();
  const input = await parseBody(req, promotionSchema);

  const promotion = await prisma.promotion.create({
    data: {
      name: input.name,
      code: input.code,
      type: input.type as PromotionType,
      // Percentage promos store a whole percent; fixed promos store minor units.
      value: input.type === "FIXED" ? toMinor(input.value) : Math.round(input.value),
      minPurchase: toMinor(input.minPurchase),
      usageLimit: input.usageLimit ?? null,
      perCustomerLimit: input.perCustomerLimit ?? null,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      isActive: input.isActive,
    },
  });

  await recordAudit({
    actorId: admin.id,
    action: "PROMOTION_CREATED",
    resourceType: "Promotion",
    resourceId: promotion.id,
    newValues: { code: promotion.code, type: promotion.type, value: promotion.value },
  });

  return ok({ promotion }, 201);
});
