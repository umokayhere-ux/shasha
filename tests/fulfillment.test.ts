import { describe, it, expect } from "vitest";
import { MockDataProvider } from "@/lib/fulfillment/mock-provider";

const base = {
  recipientPhone: "0244123456",
  networkSlug: "mtn",
  productCode: "MOCK-MTN-1GB",
  dataAmountMb: 1024,
  amount: 600,
};

describe("data provider idempotency", () => {
  it("does not deliver twice for the same idempotency key", async () => {
    const provider = new MockDataProvider();
    const first = await provider.purchaseBundle({ ...base, idempotencyKey: "fulfil_SH-1" });
    const second = await provider.purchaseBundle({ ...base, idempotencyKey: "fulfil_SH-1" });

    expect(first.state).toBe("SUCCESSFUL");
    // Same reference returned — a replay, not a second delivery.
    expect(second.providerReference).toBe(first.providerReference);
  });

  it("treats different orders as distinct deliveries", async () => {
    const provider = new MockDataProvider();
    const a = await provider.purchaseBundle({ ...base, idempotencyKey: "fulfil_SH-A" });
    const b = await provider.purchaseBundle({ ...base, idempotencyKey: "fulfil_SH-B" });
    expect(a.providerReference).not.toBe(b.providerReference);
  });

  it("reports a permanent failure as non-retryable", async () => {
    const provider = new MockDataProvider();
    const result = await provider.purchaseBundle({
      ...base,
      recipientPhone: "0244120000",
      idempotencyKey: "fulfil_SH-F",
    });
    expect(result.state).toBe("FAILED");
    expect(result.retryable).toBe(false);
  });

  it("marks a transient failure retryable and does not cache it", async () => {
    const provider = new MockDataProvider();
    const key = "fulfil_SH-T";
    const first = await provider.purchaseBundle({
      ...base,
      recipientPhone: "0244122222",
      idempotencyKey: key,
    });
    expect(first.retryable).toBe(true);

    // A retryable fault must stay retryable rather than latch as delivered.
    const retry = await provider.purchaseBundle({
      ...base,
      recipientPhone: "0244122222",
      idempotencyKey: key,
    });
    expect(retry.state).toBe("FAILED");
  });

  it("surfaces a delayed delivery as PROCESSING, not FAILED", async () => {
    const provider = new MockDataProvider();
    const result = await provider.purchaseBundle({
      ...base,
      recipientPhone: "0244121111",
      idempotencyKey: "fulfil_SH-D",
    });
    expect(result.state).toBe("PROCESSING");
  });
});
