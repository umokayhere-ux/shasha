import { cleanSecret, cleanUrl } from "../env";

/**
 * SMS delivery.
 *
 * The provider is reached over plain HTTP with values from the environment, so
 * swapping Arkesel for Hubtel, mNotify or anything else is configuration rather
 * than a code change. If the field names your provider expects differ from the
 * defaults, `buildBody` below is the single place to adjust.
 *
 * Sending is always best-effort: a failed SMS must never fail a registration or
 * a payment, so every error is logged and swallowed.
 */

export interface SmsResult {
  sent: boolean;
  reason?: string;
}

/** Most providers require international format; local 0XX numbers are rejected. */
export function toInternational(phone: string, countryCode = "233"): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith(countryCode)) return `+${digits}`;
  if (digits.startsWith("0")) return `+${countryCode}${digits.slice(1)}`;
  return `+${countryCode}${digits}`;
}

export function smsConfigured(): boolean {
  return Boolean(cleanSecret(process.env.SMS_API_KEY) && process.env.SMS_API_URL);
}

function buildBody(to: string, message: string): Record<string, unknown> {
  const sender = process.env.SMS_SENDER_ID?.trim() || "Shasha";
  return {
    // Common field names across Ghanaian SMS gateways. Adjust here if yours
    // expects something different.
    sender,
    to,
    message,
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

  const url = cleanUrl(process.env.SMS_API_URL, "");
  const key = cleanSecret(process.env.SMS_API_KEY)!;
  const to = toInternational(rawPhone);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Providers differ: some want a bearer token, others a bare api-key.
        ...(process.env.SMS_AUTH_HEADER?.trim()
          ? { [process.env.SMS_AUTH_HEADER.trim()]: key }
          : { Authorization: `Bearer ${key}` }),
      },
      body: JSON.stringify(buildBody(to, message)),
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[sms] provider rejected %s: %s %s", to, res.status, detail.slice(0, 200));
      return { sent: false, reason: `Provider replied ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[sms] send failed to %s", to, err);
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
