const TONES: Record<string, string> = {
  SUCCESSFUL: "bg-emerald-100 text-emerald-800",
  PAID: "bg-emerald-100 text-emerald-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  QUEUED: "bg-blue-100 text-blue-800",
  PENDING: "bg-amber-100 text-amber-800",
  FAILED: "bg-rose-100 text-rose-800",
  CANCELLED: "bg-slate-200 text-slate-700",
  REFUNDED: "bg-slate-200 text-slate-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${TONES[status] ?? "bg-slate-200 text-slate-700"}`}>
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}
