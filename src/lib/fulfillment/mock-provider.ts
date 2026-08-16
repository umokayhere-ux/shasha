import { randomUUID } from "node:crypto";
import type { DataProvider, PurchaseRequest, PurchaseResult } from "./provider";

/**
 * Test double used until real data provider credentials exist. It delivers
 * nothing real. Behaviour is driven by the recipient number so every branch
 * (success, delayed, hard failure, transient failure) is reproducible:
 *
 *   ...0000 -> FAILED (permanent)   ...1111 -> PROCESSING (delayed)
 *   ...2222 -> FAILED (retryable)   anything else -> SUCCESSFUL
 */
export class MockDataProvider implements DataProvider {
  readonly name = "mock";
  private readonly delivered = new Map<string, PurchaseResult>();

  async getAvailableProducts() {
    return [
      { code: "MOCK-500MB", name: "500MB", amountMb: 500 },
      { code: "MOCK-1GB", name: "1GB", amountMb: 1024 },
      { code: "MOCK-2GB", name: "2GB", amountMb: 2048 },
      { code: "MOCK-5GB", name: "5GB", amountMb: 5120 },
    ];
  }

  async purchaseBundle(req: PurchaseRequest): Promise<PurchaseResult> {
    // Mirrors a real provider's idempotency guarantee.
    const seen = this.delivered.get(req.idempotencyKey);
    if (seen) return seen;

    const suffix = req.recipientPhone.slice(-4);
    let result: PurchaseResult;

    if (suffix === "0000") {
      result = {
        state: "FAILED",
        providerReference: null,
        message: "Recipient number rejected by provider",
        retryable: false,
        raw: { simulated: "permanent_failure" },
      };
    } else if (suffix === "1111") {
      result = {
        state: "PROCESSING",
        providerReference: `MOCK-${randomUUID()}`,
        message: "Delivery queued at provider",
        retryable: false,
        raw: { simulated: "delayed" },
      };
    } else if (suffix === "2222") {
      result = {
        state: "FAILED",
        providerReference: null,
        message: "Provider temporarily unavailable",
        retryable: true,
        raw: { simulated: "transient_failure" },
      };
    } else {
      result = {
        state: "SUCCESSFUL",
        providerReference: `MOCK-${randomUUID()}`,
        message: "Bundle delivered",
        retryable: false,
        raw: { simulated: "success", amountMb: req.dataAmountMb },
      };
    }

    // Retryable faults are not cached — the request genuinely did not land.
    if (!result.retryable) this.delivered.set(req.idempotencyKey, result);
    return result;
  }

  async getTransactionStatus(providerReference: string): Promise<PurchaseResult> {
    for (const result of this.delivered.values()) {
      if (result.providerReference === providerReference) {
        // Delayed deliveries settle as successful on the follow-up check.
        return result.state === "PROCESSING" ? { ...result, state: "SUCCESSFUL" } : result;
      }
    }
    return {
      state: "FAILED",
      providerReference,
      message: "Unknown transaction",
      retryable: false,
      raw: null,
    };
  }

  async checkBalance() {
    return { balance: 100_000_00, currency: "GHS" };
  }
}
