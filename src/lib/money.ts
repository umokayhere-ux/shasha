/**
 * Money is handled exclusively in minor units (pesewas for GHS) as integers.
 * Nothing in this codebase should ever put a currency amount in a float.
 */

export const CURRENCY = process.env.CURRENCY ?? "GHS";
export const CURRENCY_SYMBOL = process.env.CURRENCY_SYMBOL ?? "GH₵";

export function toMinor(major: number | string): number {
  const n = typeof major === "string" ? Number(major) : major;
  if (!Number.isFinite(n)) throw new Error("Invalid amount");
  return Math.round(n * 100);
}

export function toMajor(minor: number): number {
  return minor / 100;
}

export function formatMoney(minor: number, symbol = CURRENCY_SYMBOL): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${symbol}${(abs / 100).toFixed(2)}`;
}

/** Percentage discount, rounded down so the customer is never overcharged. */
export function percentageOf(minor: number, percent: number): number {
  return Math.floor((minor * percent) / 100);
}
