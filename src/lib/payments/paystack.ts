import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { SplitMode } from "@prisma/client";
import { ApiError } from "../api";
import type {
  InitializeParams,
  InitializeResult,
  PaymentProvider,
  RefundResult,
  VerifyResult,
  WebhookEvent,
} from "./types";

/**
 * The ONLY file that knows Paystack's wire format. Everything else in the app
 * depends on the PaymentProvider interface.
 *
 * NOTE FOR REVIEWERS: paystack.com is unreachable from this build environment,
 * so the endpoints, field names and the webhook signature scheme below were
 * written from the documented API shape and could NOT be diffed against the
 * live docs. Verify this file against https://paystack.com/docs/api/ and
 * https://paystack.com/docs/payments/webhooks/ before going to production.
 * All the shape-sensitive details are deliberately confined here.
 */

const BASE_URL = process.env.PAYSTACK_BASE_URL ?? "https://api.paystack.co";
const WEBHOOK_HEADER = "x-paystack-signature";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new ApiError("Payments are not configured. Contact support.", 503);
  return key;
}

type PaystackEnvelope<T> = { status: boolean; message: string; data: T };

async function call<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch (err) {
    console.error("[paystack] network failure", path, err);
    throw new ApiError("Could not reach the payment provider. Please try again.", 502);
  }

  const json = (await res.json().catch(() => null)) as PaystackEnvelope<T> | null;
  if (!res.ok || !json?.status) {
    // Provider messages can carry internal detail — log, don't forward.
    console.error("[paystack] error", path, res.status, json?.message);
    throw new ApiError("The payment provider rejected this request.", 502);
  }
  return json.data;
}

export class PaystackPaymentProvider implements PaymentProvider {
  readonly name = "paystack";

  async initializeTransaction(params: InitializeParams): Promise<InitializeResult> {
    const body: Record<string, unknown> = {
      email: params.email,
      // Paystack expects the amount in the currency's subunit.
      amount: params.amount,
      currency: params.currency,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata ?? {},
    };

    // Split settlement is resolved server-side; the browser never supplies it.
    const split = params.split;
    if (split && split.mode === SplitMode.SUBACCOUNT_SPLIT && split.subaccountCode) {
      body.subaccount = split.subaccountCode;
      if (split.transactionCharge != null) body.transaction_charge = split.transactionCharge;
      if (split.bearer) body.bearer = split.bearer;
    }

    const data = await call<{
      authorization_url: string;
      access_code: string;
      reference: string;
    }>("/transaction/initialize", { method: "POST", body });

    return {
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code,
      reference: data.reference,
    };
  }

  async verifyTransaction(reference: string): Promise<VerifyResult> {
    const data = await call<PaystackTransaction>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      { method: "GET" },
    );
    return normalizeTransaction(data, reference);
  }

  getTransaction(reference: string): Promise<VerifyResult> {
    return this.verifyTransaction(reference);
  }

  /**
   * Verifies authenticity with HMAC-SHA512 of the RAW request body keyed by the
   * secret key, compared in constant time. Body must not be re-serialized —
   * any whitespace change invalidates the digest.
   */
  processWebhook(rawBody: string, signatureHeader: string | null): WebhookEvent {
    if (!signatureHeader) throw new ApiError("Missing webhook signature", 401);

    const expected = createHmac("sha512", secretKey()).update(rawBody, "utf8").digest("hex");
    const received = Buffer.from(signatureHeader, "utf8");
    const expectedBuf = Buffer.from(expected, "utf8");
    if (received.length !== expectedBuf.length || !timingSafeEqual(received, expectedBuf)) {
      throw new ApiError("Invalid webhook signature", 401);
    }

    let parsed: { event?: string; data?: Record<string, unknown> };
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new ApiError("Invalid webhook payload", 400);
    }

    return {
      type: parsed.event ?? "unknown",
      reference: (parsed.data?.reference as string | undefined) ?? null,
      // Dedupe on the body digest: redeliveries of the same event collapse.
      signature: createHash("sha256").update(rawBody).digest("hex"),
      payload: (parsed as Record<string, unknown>) ?? {},
    };
  }

  async refundTransaction(reference: string, amount?: number): Promise<RefundResult> {
    const data = await call<{ status: string; refund_reference?: string; amount: number }>(
      "/refund",
      { method: "POST", body: { transaction: reference, ...(amount ? { amount } : {}) } },
    );
    return {
      success: data.status === "processed" || data.status === "pending",
      reference: data.refund_reference ?? reference,
      amount: data.amount,
      raw: data,
    };
  }

  /** Creates a subaccount for split settlement. Admin-only surface. */
  async createSubaccount(input: {
    businessName: string;
    settlementBank: string;
    accountNumber: string;
    percentageCharge: number;
  }) {
    return call<{
      subaccount_code: string;
      business_name: string;
      account_number: string;
      settlement_bank: string;
      account_name?: string;
    }>("/subaccount", {
      method: "POST",
      body: {
        business_name: input.businessName,
        settlement_bank: input.settlementBank,
        account_number: input.accountNumber,
        percentage_charge: input.percentageCharge,
      },
    });
  }

  async listBanks(country = "ghana") {
    return call<Array<{ name: string; code: string; currency: string }>>(
      `/bank?country=${encodeURIComponent(country)}`,
      { method: "GET" },
    );
  }
}

interface PaystackTransaction {
  id?: number | string;
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  channel?: string;
  paid_at?: string;
  fees?: number;
}

function normalizeTransaction(data: PaystackTransaction, fallbackRef: string): VerifyResult {
  return {
    reference: data.reference ?? fallbackRef,
    providerTransactionId: data.id != null ? String(data.id) : null,
    success: data.status === "success",
    status: data.status ?? "unknown",
    amount: data.amount ?? 0,
    currency: data.currency ?? "GHS",
    channel: data.channel ?? null,
    fees: data.fees ?? null,
    paidAt: data.paid_at ? new Date(data.paid_at) : null,
    raw: data,
  };
}

export { WEBHOOK_HEADER };
