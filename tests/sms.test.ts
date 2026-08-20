import { describe, it, expect } from "vitest";
import { toInternational, smsTemplates } from "@/lib/sms";

describe("phone normalisation for SMS", () => {
  it("converts a local Ghana number to international format", () => {
    expect(toInternational("0593066582")).toBe("+233593066582");
  });

  it("leaves an already-international number alone", () => {
    expect(toInternational("+233593066582")).toBe("+233593066582");
  });

  it("handles a country code without the plus", () => {
    expect(toInternational("233593066582")).toBe("+233593066582");
  });

  it("strips spaces and dashes", () => {
    expect(toInternational("059 306-6582")).toBe("+233593066582");
  });
});

describe("message templates", () => {
  it("welcomes by first name and business", () => {
    const msg = smsTemplates.welcome("Isaac", "Shasha Data Plug");
    expect(msg).toContain("Isaac");
    expect(msg).toContain("Shasha Data Plug");
  });

  it("tells the buyer delivery is coming, naming the recipient", () => {
    const msg = smsTemplates.paymentReceived("MTN 1GB", "0593066582", "Shasha Data Plug");
    expect(msg).toContain("MTN 1GB");
    expect(msg).toContain("0593066582");
    expect(msg).toMatch(/few minutes/i);
  });

  it("confirms delivery", () => {
    const msg = smsTemplates.delivered("MTN 1GB", "0593066582", "Shasha Data Plug");
    expect(msg).toMatch(/delivered/i);
  });
});
