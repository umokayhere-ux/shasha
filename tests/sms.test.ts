import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { formatNumber, senderId, smsConfigured, buildRequest, smsTemplates } from "@/lib/sms";

const ENV_KEYS = ["SMS_API_URL", "SMS_API_KEY", "SMS_SENDER_ID"];

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  process.env.SMS_API_KEY = "secret-key";
  process.env.SMS_SENDER_ID = "Shasha";
});

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("number formatting", () => {
  it("produces an international number with no plus, as Arkesel expects", () => {
    expect(formatNumber("0593066582")).toBe("233593066582");
    expect(formatNumber("+233593066582")).toBe("233593066582");
    expect(formatNumber("233593066582")).toBe("233593066582");
    expect(formatNumber("059 306-6582")).toBe("233593066582");
  });
});

describe("sender id", () => {
  it("defaults to the business short name", () => {
    delete process.env.SMS_SENDER_ID;
    expect(senderId()).toBe("Shasha");
  });

  it("truncates to 11 characters, the alphanumeric limit", () => {
    process.env.SMS_SENDER_ID = "Shasha Data Plug";
    expect(senderId()).toBe("Shasha Data".slice(0, 11));
    expect(senderId().length).toBe(11);
  });
});

describe("configuration", () => {
  it("is off without an API key", () => {
    delete process.env.SMS_API_KEY;
    expect(smsConfigured()).toBe(false);
  });

  it("is on with one", () => {
    expect(smsConfigured()).toBe(true);
  });
});

describe("request building", () => {
  it("posts the documented JSON body to the Arkesel v2 endpoint", () => {
    const { url, init } = buildRequest("0593066582", "Hello");

    expect(url).toBe("https://sms.arkesel.com/api/v2/sms/send");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    // Arkesel wants a bare api-key header, not an Authorization bearer.
    expect(headers["api-key"]).toBe("secret-key");
    expect(headers.Authorization).toBeUndefined();
    expect(headers["Content-Type"]).toBe("application/json");

    expect(JSON.parse(init.body as string)).toEqual({
      sender: "Shasha",
      message: "Hello",
      recipients: ["233593066582"],
    });
  });

  it("sends recipients as an array even for one number", () => {
    const { init } = buildRequest("0593066582", "Hi");
    const body = JSON.parse(init.body as string) as { recipients: unknown };
    expect(Array.isArray(body.recipients)).toBe(true);
  });

  it("honours an overridden endpoint", () => {
    process.env.SMS_API_URL = "https://gateway.example/send";
    expect(buildRequest("0593066582", "Hi").url).toBe("https://gateway.example/send");
  });

  it("survives a pasted url with wrappers and a trailing newline", () => {
    process.env.SMS_API_URL = "<https://gateway.example/send>\n";
    expect(buildRequest("0593066582", "Hi").url).toBe("https://gateway.example/send");
  });

  it("keeps the key out of the body", () => {
    const { init } = buildRequest("0593066582", "Hello");
    expect(init.body as string).not.toContain("secret-key");
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
    expect(smsTemplates.delivered("MTN 1GB", "0593066582", "Shasha Data Plug")).toMatch(
      /delivered/i,
    );
  });
});
