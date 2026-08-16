/**
 * Environment values are typed by hand into a hosting dashboard, so they arrive
 * with whatever the clipboard carried: angle brackets from a pasted markdown
 * link, wrapping quotes, or a trailing newline. A URL like
 * "<https://api.paystack.co>\n" makes fetch throw a bare TypeError, which
 * surfaces to the customer as an unexplained "could not reach the provider".
 *
 * These helpers normalise the value and fall back rather than propagating junk.
 */

export function cleanUrl(raw: string | undefined, fallback: string): string {
  const value = (raw ?? "")
    .trim()
    .replace(/^[<"']+|[>"']+$/g, "") // pasted markdown link or quoted value
    .replace(/\s+/g, "") // stray newline or space
    .replace(/\/+$/, ""); // trailing slash

  if (!value) return fallback;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return fallback;
    return value;
  } catch {
    console.error("[env] ignoring malformed URL %o, using %s", raw, fallback);
    return fallback;
  }
}

/** Same tidy-up for non-URL secrets, which suffer the same paste damage. */
export function cleanSecret(raw: string | undefined): string | undefined {
  const value = (raw ?? "").trim().replace(/^["']+|["']+$/g, "");
  return value === "" ? undefined : value;
}
