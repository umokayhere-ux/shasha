import { describe, it, expect } from "vitest";
import { normalizeWhatsApp, buildComplaintMessage, whatsappLink } from "@/lib/support";

describe("whatsapp number normalisation", () => {
  it("accepts an international number in any common form", () => {
    expect(normalizeWhatsApp("+233593066582")).toBe("233593066582");
    expect(normalizeWhatsApp("233593066582")).toBe("233593066582");
    expect(normalizeWhatsApp("+233 59 306 6582")).toBe("233593066582");
    expect(normalizeWhatsApp("(233) 59-306-6582")).toBe("233593066582");
  });

  it("rejects a national number, rather than guessing a country code", () => {
    // Guessing here would build a link to a completely different person.
    expect(normalizeWhatsApp("0593066582")).toBeNull();
  });

  it("rejects junk and missing values", () => {
    expect(normalizeWhatsApp(undefined)).toBeNull();
    expect(normalizeWhatsApp(null)).toBeNull();
    expect(normalizeWhatsApp("")).toBeNull();
    expect(normalizeWhatsApp("not a number")).toBeNull();
    expect(normalizeWhatsApp("12345")).toBeNull();
  });
});

describe("complaint message", () => {
  const base = {
    business: "Shasha Data Plug",
    customerName: "Isaac Mensah",
    customerPhone: "0593066582",
    category: "Data not delivered",
    message: "  I paid but nothing arrived.  ",
  };

  it("carries who is complaining and about what", () => {
    const msg = buildComplaintMessage(base);
    expect(msg).toContain("Shasha Data Plug");
    expect(msg).toContain("Isaac Mensah");
    expect(msg).toContain("0593066582");
    expect(msg).toContain("Data not delivered");
    expect(msg).toContain("I paid but nothing arrived.");
    // The message is trimmed, not padded into the body.
    expect(msg).not.toContain("  I paid");
  });

  it("includes the order reference when one is chosen", () => {
    const msg = buildComplaintMessage({
      ...base,
      orderReference: "SH-ABC-1234",
      orderSummary: "MTN 1GB → 0244000000",
    });
    expect(msg).toContain("SH-ABC-1234");
    expect(msg).toContain("MTN 1GB → 0244000000");
  });

  it("omits the order line entirely when there is none", () => {
    expect(buildComplaintMessage(base)).not.toContain("Order:");
  });

  it("omits the phone line when the account has no phone", () => {
    expect(buildComplaintMessage({ ...base, customerPhone: null })).not.toContain("Phone:");
  });
});

describe("whatsapp link", () => {
  it("targets wa.me and encodes the message", () => {
    const link = whatsappLink("233593066582", "Hello there & welcome");
    expect(link.startsWith("https://wa.me/233593066582?text=")).toBe(true);
    expect(link).toContain("%26"); // & must be encoded, not treated as a param
    expect(link).not.toContain(" ");
  });

  it("survives newlines, which the message is full of", () => {
    const link = whatsappLink("233593066582", "line one\nline two");
    expect(link).toContain("%0A");
  });
});
