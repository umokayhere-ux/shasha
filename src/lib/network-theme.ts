/**
 * Per-network branding for the purchase flow. Keyed by network slug, so adding
 * a network in the admin only needs an entry here to pick up its colours —
 * anything unknown falls back to the neutral platform theme rather than
 * breaking the page.
 */

export interface NetworkTheme {
  /** Page background once this network is selected. */
  bg: string;
  /** Raised surfaces (bundle cards, inputs) against that background. */
  surface: string;
  surfaceBorder: string;
  /** Brand colour: logo tile, prices, highlights. */
  accent: string;
  /** Readable text on top of the accent colour. */
  onAccent: string;
  /** Primary text on the background. */
  text: string;
  muted: string;
  /** Short mark used in the logo tile. */
  mark: string;
}

const THEMES: Record<string, NetworkTheme> = {
  // Black canvas, MTN yellow.
  mtn: {
    bg: "#0a0a0a",
    surface: "#161616",
    surfaceBorder: "#2a2a2a",
    accent: "#FFCB05",
    onAccent: "#0a0a0a",
    text: "#ffffff",
    muted: "#a3a3a3",
    mark: "MTN",
  },
  // Black canvas, Telecel red.
  telecel: {
    bg: "#0a0a0a",
    surface: "#161616",
    surfaceBorder: "#2a2a2a",
    accent: "#E4002B",
    onAccent: "#ffffff",
    text: "#ffffff",
    muted: "#a3a3a3",
    mark: "TELECEL",
  },
  // White canvas, AirtelTigo red.
  airteltigo: {
    bg: "#ffffff",
    surface: "#ffffff",
    surfaceBorder: "#e6e6e6",
    accent: "#ED1C24",
    onAccent: "#ffffff",
    text: "#0b1220",
    muted: "#6b7280",
    mark: "AT",
  },
};

const FALLBACK: NetworkTheme = {
  bg: "#0b1220",
  surface: "#151d2e",
  surfaceBorder: "#26314a",
  accent: "#4f9bee",
  onAccent: "#04121f",
  text: "#ffffff",
  muted: "#94a3b8",
  mark: "NET",
};

export function networkTheme(slug: string): NetworkTheme {
  return THEMES[slug.toLowerCase()] ?? FALLBACK;
}
