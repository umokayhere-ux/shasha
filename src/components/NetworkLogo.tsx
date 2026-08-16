import type { NetworkTheme } from "@/lib/network-theme";

/**
 * Network mark.
 *
 * Uploaded logos are rendered as large as the container allows — most carrier
 * marks already carry their own background, so wrapping them in an extra tile
 * left them looking like small stickers. `object-contain` keeps aspect ratio, so
 * a wide wordmark and a square badge both fill without distortion.
 *
 * Networks with no logo fall back to a wordmark tile in the brand colour.
 */
export function NetworkLogo({
  theme,
  logoUrl,
  name,
  className = "",
  rounded = "rounded-2xl",
}: {
  theme: NetworkTheme;
  logoUrl?: string | null;
  name: string;
  className?: string;
  rounded?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- stored inline as a data URI
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={`${className} ${rounded} object-contain`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`${className} ${rounded} grid place-items-center text-xs font-black tracking-tight`}
      style={{ background: theme.accent, color: theme.onAccent }}
    >
      {theme.mark}
    </span>
  );
}
