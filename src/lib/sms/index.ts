import { cleanSecret, cleanUrl } from "../env";

/**
 * SMS delivery via Arkesel (SMS API v2).
 *
 * POST https://sms.arkesel.com/api/v2/sms/send
 *   api-key: <key>
 *   { sender, message, recipients: ["233593066582"] }
 *
 * Details from their API that are easy to get wrong:
 *  - Auth is a bare `api-key` header, NOT `Authorization: Bearer`.
 *  - `recipients` is an array even for a single number, and each number is
 *    international with no leading plus (233593066582).
 *  - A rejected send can still come back as HTTP 200 with
 *    {"status":"error"} — or with a non-"success" code such as
 *    "insufficient_balance" — so the body is inspected rather than res.ok
 *    alone, which would report a rejection as a success.
 *  - The alphanumeric sender is capped at 11 characters, so the configured
 *    sender is truncated rather than being rejected by the gateway.
 *
 * Sending is best-effort throughout: a failed SMS must never fail a
 * registration or a payment, so errors are logged and swallowed.
 */

const DEFAULT_ENDPOINT = "https://sms.arkesel.com/api/v2/sms/send";
const SENDER_ID_MAX = 11;

export interface SmsResult {
  sent: boolean;
  reason?: string;
}

/**
 * Arkesel expects an international number without the leading plus
 * (233593066582), matching the examples in their docs.
 */
export function formatNumber(phone: string, countryCode = "233"): string {
  const digits = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  const national = digits.startsWith(countryCode)
    ? digits.slice(countryCode.length)
    : digits.replace(/^0/, "");
  return `${countryCode}${national}`;
}

/** Alphanumeric sender IDs are limited to 11 characters. */
export function senderId(): string {
  const raw = process.env.SMS_SENDER_ID?.trim() || "Shasha";
  return raw.slice(0, SENDER_ID_MAX);
}

export function smsConfigured(): boolean {
  return Boolean(cleanSecret(process.env.SMS_API_KEY));
}

export interface SmsRequest {
  url: string;
  init: RequestInit;
}

/** Builds the provider call. Exported so tests can assert the shape. */
export function buildRequest(rawPhone: string, message: string): SmsRequest {
  const url = cleanUrl(process.env.SMS_API_URL, DEFAULT_ENDPOINT);
  const key = cleanSecret(process.env.SMS_API_KEY) ?? "";

  return {
    url,
    init: {
      method: "POST",
      headers: {
        "api-key": key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: senderId(),
        message,
        recipients: [formatNumber(rawPhone)],
      }),
      cache: "no-store",
    },
  };
}

/**
 * Sends one message. Returns rather than throws, so callers can log the outcome
 * without wrapping every call site in try/catch.
 */
export async function sendSms(rawPhone: string, message: string): Promise<SmsResult> {
  if (!smsConfigured()) {
    // Not an error: the platform runs fine without SMS, it just stays quiet.
    console.info("[sms] skipped (not configured) -> %s: %s", rawPhone, message);
    return { sent: false, reason: "SMS is not configured" };
  }

  try {
    const { url, init } = buildRequest(rawPhone, message);
    const res = await fetch(url, init);
    const raw = await res.text();
    const body = (() => {
      try {
        return JSON.parse(raw) as { status?: string; message?: string };
      } catch {
        return null;
      }
    })();

    // Arkesel reports rejections in the body, not always in the HTTP status.
    if (!res.ok || body?.status !== "success") {
      const reason = body?.message ?? body?.status ?? `Provider replied ${res.status}`;
      // The raw body is logged too: if the provider ever answers in a shape
      // this adapter does not expect, the parsed reason alone is useless for
      // working out what actually happened.
      console.error("[sms] not sent to %s: %s | raw: %s", formatNumber(rawPhone), reason, raw.slice(0, 300));
      return { sent: false, reason };
    }
    return { sent: true };
  } catch (err) {
    console.error("[sms] send failed", err);
    return { sent: false, reason: "Could not reach the SMS provider" };
  }
}

/** Message templates, kept together so the wording is easy to review. */
export const smsTemplates = {
  welcome: (name: string, business: string) =>
    `Hi ${name}, welcome to ${business}! Your account is ready. Buy data anytime at your dashboard.`,

  paymentReceived: (bundle: string, recipient: string, business: string) =>
    `${business}: Payment received for ${bundle}. Your bundle will be delivered to ${recipient} in a few minutes.`,

  delivered: (bundle: string, recipient: string, business: string) =>
    `${business}: ${bundle} has been delivered to ${recipient}. Thank you!`,
};
