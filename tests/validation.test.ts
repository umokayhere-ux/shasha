import { describe, it, expect } from "vitest";
import { phoneSchema, passwordSchema, createOrderSchema } from "@/lib/validation";

describe("phone validation", () => {
  it("accepts and normalizes local format", () => {
    expect(phoneSchema.parse("0244123456")).toBe("0244123456");
    expect(phoneSchema.parse("024 412 3456")).toBe("0244123456");
  });

  it("normalizes international format to local", () => {
    expect(phoneSchema.parse("+233244123456")).toBe("0244123456");
  });

  it("rejects malformed numbers", () => {
    expect(() => phoneSchema.parse("12345")).toThrow();
    expect(() => phoneSchema.parse("not-a-number")).toThrow();
  });
});

describe("password policy", () => {
  it("requires length plus a letter and a digit", () => {
    expect(() => passwordSchema.parse("short1")).toThrow();
    expect(() => passwordSchema.parse("alllettersonly")).toThrow();
    expect(passwordSchema.parse("goodpassword1")).toBe("goodpassword1");
  });
});

describe("order input", () => {
  it("accepts no price field — pricing is server-side only", () => {
    const parsed = createOrderSchema.parse({
      bundleId: "3f0d4b6e-4c2a-4f9e-9a1b-2c3d4e5f6a7b",
      recipientPhone: "0244123456",
    });
    expect(parsed).not.toHaveProperty("amount");
    expect(parsed.paymentMethod).toBe("PAYSTACK");
  });

  it("rejects a non-uuid bundle id", () => {
    expect(() =>
      createOrderSchema.parse({ bundleId: "1", recipientPhone: "0244123456" }),
    ).toThrow();
  });
});
