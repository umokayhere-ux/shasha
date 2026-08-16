import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "node:crypto";
import { SplitMode } from "@prisma/client";
import { PaystackPaymentProvider } from "@/lib/payments/paystack";
import { computeShares } from "@/lib/payments";

const SECRET = "sk_test_fake_key_for_signature_tests";

beforeAll(() => {
  process.env.PAYSTACK_SECRET_KEY = SECRET;
});

function sign(body: string): string {
  return createHmac("sha512", SECRET).update(body, "utf8").digest("hex");
}

describe("webhook verification", () => {
  const provider = new PaystackPaymentProvider();
  const body = JSON.stringify({ event: "charge.success", data: { reference: "SH-TEST-1" } });

  it("accepts a correctly signed payload", () => {
    const event = provider.processWebhook(body, sign(body));
    expect(event.type).toBe("charge.success");
    expect(event.reference).toBe("SH-TEST-1");
  });

  it("rejects a tampered body", () => {
    const tampered = JSON.stringify({ event: "charge.success", data: { reference: "SH-EVIL" } });
    expect(() => provider.processWebhook(tampered, sign(body))).toThrow(/signature/i);
  });

  it("rejects a missing signature", () => {
    expect(() => provider.processWebhook(body, null)).toThrow(/signature/i);
  });

  it("rejects a forged signature", () => {
    expect(() => provider.processWebhook(body, "deadbeef")).toThrow(/signature/i);
  });

  it("produces a stable dedupe key per payload", () => {
    const a = provider.processWebhook(body, sign(body)).signature;
    const b = provider.processWebhook(body, sign(body)).signature;
    expect(a).toBe(b);

    const other = JSON.stringify({ event: "charge.success", data: { reference: "SH-TEST-2" } });
    expect(provider.processWebhook(other, sign(other)).signature).not.toBe(a);
  });
});

describe("split shares", () => {
  it("gives everything to the platform when no split applies", () => {
    expect(computeShares(1000, { mode: SplitMode.PLATFORM_ONLY })).toEqual({
      platformShare: 1000,
      subaccountShare: 0,
    });
  });

  it("applies a flat transaction charge", () => {
    expect(
      computeShares(1000, { mode: SplitMode.SUBACCOUNT_SPLIT, transactionCharge: 150 }),
    ).toEqual({ platformShare: 150, subaccountShare: 850 });
  });

  it("applies a percentage charge", () => {
    expect(
      computeShares(1000, { mode: SplitMode.SUBACCOUNT_SPLIT, percentageCharge: 20 }),
    ).toEqual({ platformShare: 800, subaccountShare: 200 });
  });

  it("never lets a charge exceed the amount paid", () => {
    const shares = computeShares(100, { mode: SplitMode.SUBACCOUNT_SPLIT, transactionCharge: 500 });
    expect(shares.platformShare).toBe(100);
    expect(shares.subaccountShare).toBe(0);
  });
});
