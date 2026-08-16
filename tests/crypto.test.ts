import { describe, it, expect, beforeAll } from "vitest";
import { hashPassword, verifyPassword, hashToken, generateToken } from "@/lib/crypto";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-that-is-long-enough-for-hmac-usage";
});

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery 123");
    expect(await verifyPassword("correct horse battery 123", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery 123");
    expect(await verifyPassword("wrong password 123", hash)).toBe(false);
  });

  it("never stores the plaintext", async () => {
    const hash = await hashPassword("supersecret123");
    expect(hash).not.toContain("supersecret123");
    expect(hash.startsWith("scrypt$")).toBe(true);
  });

  it("salts, so identical passwords hash differently", async () => {
    expect(await hashPassword("same123456")).not.toBe(await hashPassword("same123456"));
  });

  it("rejects a malformed hash instead of throwing", async () => {
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("tokens", () => {
  it("hashes deterministically but is not reversible", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toContain(token);
  });
});
