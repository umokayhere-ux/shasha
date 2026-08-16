/**
 * Business identity, in one place.
 *
 * Overridable with BUSINESS_NAME, but the default is the real trading name so
 * the app is branded correctly without depending on an env var being set. Note
 * that the env read only resolves on the server; client components receive the
 * name as a prop rather than reading it directly.
 */
export const BUSINESS_NAME = process.env.BUSINESS_NAME?.trim() || "Shasha Data Plug";
export const BUSINESS_TAGLINE = "Data bundles, delivered in seconds.";
