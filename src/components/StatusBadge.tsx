/**
 * Status pill. Colours come from the palette tokens rather than Tailwind's
 * defaults, so success/pending/error match the brand exactly everywhere they
 * appear — order lists, delivery queue, admin tables.
 */
const TONES: Record<string, { bg: string; fg: string }> = {
  SUCCESSFUL: { bg: "var(--success-soft)", fg: "var(--success)" },
  PAID: { bg: "var(--success-soft)", fg: "var(--success)" },
  DELIVERED: { bg: "var(--success-soft)", fg: "var(--success)" },

  PENDING: { bg: "var(--warning-soft)", fg: "#a15c07" },
  QUEUED: { bg: "var(--warning-soft)", fg: "#a15c07" },
  PROCESSING: { bg: "var(--brand-soft)", fg: "var(--brand)" },

  FAILED: { bg: "var(--danger-soft)", fg: "var(--danger)" },
  CANCELLED: { bg: "var(--surface-2)", fg: "var(--muted)" },
  REFUNDED: { bg: "var(--surface-2)", fg: "var(--muted)" },
  PARTIALLY_REFUNDED: { bg: "var(--surface-2)", fg: "var(--muted)" },
};

export function StatusBadge({ status }: { status: string }) {
  const tone = TONES[status] ?? { bg: "var(--surface-2)", fg: "var(--muted)" };

  return (
    <span className="badge" style={{ background: tone.bg, color: tone.fg }}>
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}
