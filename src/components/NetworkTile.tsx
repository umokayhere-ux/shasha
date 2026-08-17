import Link from "next/link";
import { networkTheme } from "@/lib/network-theme";

/**
 * Network shortcut where the logo IS the tile.
 *
 * Carrier logos ship with their own background baked in, so nesting them inside
 * a themed card produced a visible box-within-a-box. The image is bled to the
 * full tile instead, and the network name sits underneath rather than crowding
 * the artwork. Networks with no logo keep a coloured wordmark tile so the row
 * stays even.
 */
export function NetworkTile({
  name,
  slug,
  logoUrl,
  href = "/buy",
}: {
  name: string;
  slug: string;
  logoUrl: string | null;
  href?: string;
}) {
  const theme = networkTheme(slug);

  return (
    <Link href={href} className="group flex flex-col items-center gap-2">
      <span
        className="grid aspect-square w-full place-items-center overflow-hidden rounded-2xl transition active:scale-[0.97]"
        style={{
          background: theme.bg,
          border: `1px solid ${theme.surfaceBorder}`,
          boxShadow: "0 6px 16px rgba(2, 6, 23, 0.10)",
        }}
      >
        {logoUrl ? (
          // object-cover fills the tile edge to edge; the logo's own background
          // becomes the tile background, which is what makes it read as an icon.
          // eslint-disable-next-line @next/next/no-img-element -- stored inline as a data URI
          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span
            aria-hidden
            className="text-[11px] font-black tracking-tight"
            style={{ color: theme.accent }}
          >
            {theme.mark}
          </span>
        )}
      </span>
      <span className="text-xs font-bold">{name}</span>
    </Link>
  );
}
