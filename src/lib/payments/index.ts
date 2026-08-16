import { SplitMode } from "@prisma/client";
import { prisma } from "../db";
import { PaystackPaymentProvider } from "./paystack";
import type { PaymentProvider, ResolvedSplit } from "./types";

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (!provider) provider = new PaystackPaymentProvider();
  return provider;
}

export const paystack = new PaystackPaymentProvider();

/**
 * Chooses the split configuration for a transaction. This runs server-side
 * only — split codes and percentages are never accepted from the client.
 */
export async function resolveSplitConfiguration(): Promise<ResolvedSplit> {
  const config = await prisma.paymentSplitConfiguration.findFirst({
    where: { isActive: true, isDefault: true },
    include: { subaccount: true },
  });

  if (!config || config.mode === SplitMode.PLATFORM_ONLY) {
    return { mode: SplitMode.PLATFORM_ONLY };
  }
  // A split config pointing at an inactive subaccount falls back to the
  // platform account rather than failing the customer's purchase.
  if (!config.subaccount?.isActive) {
    console.warn("[payments] split config %s has no active subaccount", config.name);
    return { mode: SplitMode.PLATFORM_ONLY };
  }

  return {
    mode: SplitMode.SUBACCOUNT_SPLIT,
    subaccountCode: config.subaccount.subaccountCode,
    transactionCharge: config.transactionCharge,
    percentageCharge: config.percentageCharge,
    bearer: config.bearer,
    splitConfigId: config.id,
  };
}

/** Records how a paid amount is expected to settle, for reporting. */
export function computeShares(amount: number, split: ResolvedSplit) {
  if (split.mode === SplitMode.PLATFORM_ONLY) {
    return { platformShare: amount, subaccountShare: 0 };
  }
  if (split.transactionCharge != null) {
    const platformShare = Math.min(amount, split.transactionCharge);
    return { platformShare, subaccountShare: amount - platformShare };
  }
  const pct = split.percentageCharge ?? 0;
  const subaccountShare = Math.floor((amount * pct) / 100);
  return { platformShare: amount - subaccountShare, subaccountShare };
}

export * from "./types";
