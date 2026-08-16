import { describe, it, expect } from "vitest";
import {
  phoneSchema,
  passwordSchema,
  createOrderSchema,
  networkLogoSchema,
} from "@/lib/validation";

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

describe("network logo", () => {
  const parse = (logoUrl: string) => networkLogoSchema.parse({ logoUrl });

  it("accepts a PNG data URI", () => {
    expect(parse("data:image/png;base64,iVBORw0KGgo=").logoUrl).toContain("image/png");
  });

  it("accepts an https URL", () => {
    expect(parse("https://cdn.example.com/mtn.png").logoUrl).toContain("https://");
  });

  it("accepts an empty string, which clears the logo", () => {
    expect(parse("").logoUrl).toBe("");
  });

  it("rejects SVG, which can carry script", () => {
    expect(() => parse("data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pg==")).toThrow();
  });

  it("rejects a javascript: payload", () => {
    expect(() => parse("javascript:alert(1)")).toThrow();
  });

  it("rejects plain http", () => {
    expect(() => parse("http://insecure.example.com/logo.png")).toThrow();
  });

  it("rejects an oversized image", () => {
    expect(() => parse(`data:image/png;base64,${"A".repeat(400_001)}`)).toThrow();
  });
});
