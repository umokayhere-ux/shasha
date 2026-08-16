import { describe, it, expect } from "vitest";
import { toMinor, toMajor, formatMoney, percentageOf } from "@/lib/money";

describe("money", () => {
  it("converts major to minor units without float drift", () => {
    expect(toMinor(5)).toBe(500);
    expect(toMinor(5.55)).toBe(555);
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });

  it("round-trips", () => {
    expect(toMajor(toMinor(12.34))).toBe(12.34);
  });

  it("formats to two decimals", () => {
    expect(formatMoney(600, "GH₵")).toBe("GH₵6.00");
    expect(formatMoney(5, "GH₵")).toBe("GH₵0.05");
  });

  it("rounds percentage discounts down, never against the customer", () => {
    expect(percentageOf(999, 10)).toBe(99);
  });
});
