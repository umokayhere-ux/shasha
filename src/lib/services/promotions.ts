import { PromotionType, type Promotion } from "@prisma/client";
import { prisma } from "../db";
import { ApiError } from "../api";
import { percentageOf } from "../money";

export interface AppliedPromotion {
  promotion: Promotion;
  discountAmount: number;
}

/**
 * Validates a promo code against live rules and computes the discount here on
 * the server. A discount amount supplied by the client is always ignored.
 */
export async function applyPromotion(
  code: string,
  userId: string,
  baseAmount: number,
): Promise<AppliedPromotion> {
  const promotion = await prisma.promotion.findUnique({
    where: { code: code.trim().toUpperCase() },
  });
  if (!promotion || !promotion.isActive) throw new ApiError("This promo code is not valid.", 422);

  const now = new Date();
  if (promotion.startsAt && promotion.startsAt > now) {
    throw new ApiError("This promo code is not active yet.", 422);
  }
  if (promotion.endsAt && promotion.endsAt < now) {
    throw new ApiError("This promo code has expired.", 422);
  }
  if (baseAmount < promotion.minPurchase) {
    throw new ApiError("Your order does not meet the minimum for this promo code.", 422);
  }
  if (promotion.usageLimit != null && promotion.usageCount >= promotion.usageLimit) {
    throw new ApiError("This promo code has reached its usage limit.", 422);
  }
  if (promotion.perCustomerLimit != null) {
    const used = await prisma.promotionUsage.count({
      where: { promotionId: promotion.id, userId },
    });
    if (used >= promotion.perCustomerLimit) {
      throw new ApiError("You have already used this promo code.", 422);
    }
  }

  const raw =
    promotion.type === PromotionType.PERCENTAGE
      ? percentageOf(baseAmount, promotion.value)
      : promotion.value;

  // A discount can never exceed the order, and never produce a negative charge.
  const discountAmount = Math.max(0, Math.min(raw, baseAmount));
  return { promotion, discountAmount };
}
