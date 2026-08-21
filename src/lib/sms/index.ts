import { cleanSecret, cleanUrl } from "../env";

/**
 * SMS delivery via NkomoSMS.
 *
 * POST https://app.nkomosms.com/api/v3/sms/send
 *   Authorization: Bearer <token>, Accept: application/json
 *   { recipient, sender_id, type: "plain", message }
 *
 * Two details from their API that are easy to get wrong:
 *  - A failure still comes back as HTTP 200 with {"status":"error"}, so the
 *    body has to be inspected; res.ok alone would report success on a rejected
 *    message.
 *  - sender_id is capped at 11 characters for an alphanumeric sender, so the
 *    business name is truncated rather than silently rejected by the gateway.
 *
 * Sending is best-effort throughout: a failed SMS must never fail a
 * registration or a payment, so errors are logged and swallowed.
 */

const DEFAULT_ENDPOINT = "https://app.nkomosms.com/api/v3/sms/send";
const SENDER_ID_MAX = 11;

export interface SmsResult {
  sent: boolean;
  reason?: string;
}

/**
 * NkomoSMS expects an international number without the leading plus
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
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        recipient: formatNumber(rawPhone),
        sender_id: senderId(),
        type: "plain",
        message,
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
    const body = (await res.json().catch(() => null)) as
      | { status?: string; message?: string }
      | null;

    // NkomoSMS reports rejections in the body, not the HTTP status.
    if (!res.ok || body?.status !== "success") {
      const reason = body?.message ?? `Provider replied ${res.status}`;
      console.error("[sms] not sent: %s", reason);
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
