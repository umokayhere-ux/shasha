import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { SubaccountManager } from "./SubaccountManager";

export const dynamic = "force-dynamic";

export default async function SubaccountsPage() {
  // Settlement configuration is Super Admin only, even among admins.
  const user = await getCurrentUser();
  if (user?.role !== "SUPER_ADMIN") redirect("/admin");

  const [subaccounts, configs] = await Promise.all([
    prisma.paystackSubaccount.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.paymentSplitConfiguration.findMany({
      orderBy: { createdAt: "desc" },
      include: { subaccount: { select: { displayName: true } } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Paystack subaccounts"
        subtitle="Settlement destinations owned by the platform. These are never customer accounts and are never exposed to the storefront."
      />
      <SubaccountManager
        paystackConfigured={Boolean(process.env.PAYSTACK_SECRET_KEY)}
        subaccounts={subaccounts.map((s) => ({
          publicId: s.publicId,
          displayName: s.displayName,
          subaccountCode: s.subaccountCode,
          businessName: s.businessName,
          settlementBank: s.settlementBank,
          // Only the masked tail is stored, so only it can be shown.
          accountNumberMasked: s.accountNumberMasked,
          isActive: s.isActive,
        }))}
        configs={configs.map((c) => ({
          publicId: c.publicId,
          name: c.name,
          mode: c.mode,
          subaccountName: c.subaccount?.displayName ?? null,
          percentageCharge: c.percentageCharge,
          transactionCharge: c.transactionCharge,
          isDefault: c.isDefault,
          isActive: c.isActive,
        }))}
      />
    </div>
  );
}
