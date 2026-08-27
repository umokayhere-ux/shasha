/**
 * WhatsApp support hand-off.
 *
 * A complaint is not stored on the server — it is composed into a WhatsApp
 * message and opened in the customer's own WhatsApp, so the conversation lands
 * in the operator's inbox where they already work, and they can reply directly
 * to a real person rather than through a ticket queue.
 *
 * Everything here is pure so the client component can build the link itself;
 * the destination number is resolved on the server and passed in.
 */

export const COMPLAINT_CATEGORIES = [
  "Data not delivered",
  "Wrong bundle received",
  "Payment issue",
  "Wrong recipient number",
  "Something else",
] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

/**
 * Normalises a WhatsApp number to the digits-only form wa.me requires.
 *
 * Deliberately not the SMS formatter: that one assumes Ghana and rewrites a
 * leading 0, whereas a support line may sit on any country code. A local
 * number with no country code is rejected rather than guessed at, because a
 * wrong guess produces a link that silently opens a chat with a stranger.
 */
export function normalizeWhatsApp(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!/^\d{10,15}$/.test(digits)) return null;
  // A leading 0 means a national number was pasted without a country code.
  if (digits.startsWith("0")) return null;
  return digits;
}

export interface ComplaintInput {
  business: string;
  customerName: string;
  customerPhone?: string | null;
  category: string;
  orderReference?: string | null;
  orderSummary?: string | null;
  message: string;
}

/** Builds the WhatsApp message body. `*text*` renders bold in WhatsApp. */
export function buildComplaintMessage(input: ComplaintInput): string {
  const lines = [
    `*Complaint · ${input.business}*`,
    "",
    `Name: ${input.customerName}`,
  ];
  if (input.customerPhone) lines.push(`Phone: ${input.customerPhone}`);
  lines.push(`Issue: ${input.category}`);
  if (input.orderReference) {
    lines.push(`Order: ${input.orderReference}${input.orderSummary ? ` (${input.orderSummary})` : ""}`);
  }
  lines.push("", input.message.trim());
  return lines.join("\n");
}

/** wa.me link. The number must already be digits-only with a country code. */
export function whatsappLink(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
