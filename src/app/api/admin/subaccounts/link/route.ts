import { prisma } from "@/lib/db";
import { handler, ok, parseBody, ApiError } from "@/lib/api";
import { requireSuperAdmin } from "@/lib/auth";
import { linkSubaccountSchema } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Registers a subaccount that already exists in the Paystack dashboard.
 *
 * Unlike the create endpoint this needs no Paystack call, so it works before
 * API keys are configured — and it never asks for bank details, since Paystack
 * already holds them for that subaccount code.
 */
export const POST = handler(async (req: Request) => {
  const admin = await requireSuperAdmin();
  const input = await parseBody(req, linkSubaccountSchema);

  const existing = await prisma.paystackSubaccount.findUnique({
    where: { subaccountCode: input.subaccountCode },
  });
  if (existing) throw new ApiError("That subaccount code is already linked.", 409);

  const subaccount = await prisma.paystackSubaccount.create({
    data: {
      displayName: input.displayName,
      subaccountCode: input.subaccountCode,
      businessName: input.businessName ?? null,
      isActive: false,
    },
  });

  await recordAudit({
    actorId: admin.id,
    action: "SUBACCOUNT_LINKED",
    resourceType: "PaystackSubaccount",
    resourceId: subaccount.id,
    newValues: { displayName: subaccount.displayName, subaccountCode: subaccount.subaccountCode },
  });

  return ok({ subaccount }, 201);
});
