"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function markRead() {
    setBusy(true);
    await fetch("/api/notifications", { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={markRead}
      disabled={busy}
      className="rounded-full px-4 py-2 text-xs font-bold"
      style={{ background: "var(--cust-lime)", color: "var(--cust-deep)" }}
    >
      {busy ? "…" : "Mark read"}
    </button>
  );
}
