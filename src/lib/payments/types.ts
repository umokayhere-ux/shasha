import type { SplitMode } from "@prisma/client";

/**
 * Provider-agnostic payment contract. The order/fulfillment layer talks only
 * to this interface so a second provider can be added without touching it.
 */

export interface InitializeParams {
  reference: string;
  /** Minor units (pesewas). Providers convert as needed. */
  amount: number;
  currency: string;
  email: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
  split?: ResolvedSplit;
}

export interface ResolvedSplit {
  mode: SplitMode;
  subaccountCode?: string | null;
  /** Flat fee retained by the platform, in minor units. */
  transactionCharge?: number | null;
  /** Percentage retained by the subaccount, per provider semantics. */
  percentageCharge?: number | null;
  bearer?: string | null;
  splitConfigId?: string | null;
}

export interface InitializeResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface VerifyResult {
  reference: string;
  providerTransactionId: string | null;
  /** True only when the provider reports a completed, successful charge. */
  success: boolean;
  status: string;
  amount: number;
  currency: string;
  channel: string | null;
  fees: number | null;
  paidAt: Date | null;
  raw: unknown;
}

export interface WebhookEvent {
  type: string;
  reference: string | null;
  /** Stable per-delivery dedupe key derived from the raw payload. */
  signature: string;
  payload: Record<string, unknown>;
}

export interface RefundResult {
  success: boolean;
  reference: string;
  amount: number;
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  initializeTransaction(params: InitializeParams): Promise<InitializeResult>;
  verifyTransaction(reference: string): Promise<VerifyResult>;
  /** Must throw when the signature is absent or does not match. */
  processWebhook(rawBody: string, signatureHeader: string | null): WebhookEvent;
  getTransaction(reference: string): Promise<VerifyResult>;
  refundTransaction(reference: string, amount?: number): Promise<RefundResult>;
}
