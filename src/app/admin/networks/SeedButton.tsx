"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SeedButton({ hasNetworks }: { hasNetworks: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function seed() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/seed", { method: "POST" });
    const json = await res.json();
    setBusy(false);

    if (!json.ok) {
      setMessage(json.error ?? "Seeding failed.");
      return;
    }
    setMessage(`${json.data.networks} network(s), ${json.data.bundles} bundle(s) present.`);
    // router.refresh() can leave the already-rendered server component in place,
    // which made a successful seed look like it had done nothing. Reload so the
    // table always reflects what the seed just reported.
    router.refresh();
    window.location.reload();
  }

  return (
    <div className="text-right">
      <button onClick={seed} disabled={busy} className="btn-primary">
        {busy ? "Seeding…" : hasNetworks ? "Re-run seed" : "Seed default networks"}
      </button>
      {message && <p className="muted mt-2 text-xs">{message}</p>}
    </div>
  );
}
