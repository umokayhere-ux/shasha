import { prisma } from "@/lib/db";
import { handler, ok, parseBody, ApiError } from "@/lib/api";
import { requireSuperAdmin } from "@/lib/auth";
import { subaccountSchema } from "@/lib/validation";
import { paystack } from "@/lib/payments";
import { recordAudit } from "@/lib/audit";

/**
 * Paystack subaccounts are settlement destinations owned by the platform.
 * They are NOT customer accounts and are never linked to a User row.
 * Super Admin only.
 */

export const GET = handler(async () => {
  await requireSuperAdmin();
  const subaccounts = await prisma.paystackSubaccount.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { splitConfigs: true } } },
  });
  // accountNumberMasked is the only account-number field that exists.
  return ok({ subaccounts });
});

export const POST = handler(async (req: Request) => {
  const admin = await requireSuperAdmin();
  const input = await parseBody(req, subaccountSchema);

  const created = await paystack.createSubaccount({
    businessName: input.businessName,
    settlementBank: input.settlementBank,
    accountNumber: input.accountNumber,
    percentageCharge: input.percentageCharge,
  });

  const existing = await prisma.paystackSubaccount.findUnique({
    where: { subaccountCode: created.subaccount_code },
  });
  if (existing) throw new ApiError("That subaccount is already linked.", 409);

  const subaccount = await prisma.paystackSubaccount.create({
    data: {
      displayName: input.displayName,
      subaccountCode: created.subaccount_code,
      businessName: created.business_name ?? input.businessName,
      settlementBank: created.settlement_bank ?? input.settlementBank,
      bankCode: input.settlementBank,
      accountName: created.account_name ?? null,
      // Only the last four digits are ever persisted.
      accountNumberMasked: `****${input.accountNumber.slice(-4)}`,
      isActive: false,
    },
  });

  await recordAudit({
    actorId: admin.id,
    action: "SUBACCOUNT_CREATED",
    resourceType: "PaystackSubaccount",
    resourceId: subaccount.id,
    newValues: { displayName: subaccount.displayName, subaccountCode: subaccount.subaccountCode },
  });

  return ok({ subaccount }, 201);
});
