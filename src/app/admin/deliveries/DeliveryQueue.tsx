"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/money";

interface Item {
  publicId: string;
  status: string;
  retryCount: number;
  lastError: string | null;
  reference: string;
  recipientPhone: string;
  bundle: string;
  amount: number;
  customerName: string;
  customerPhone: string | null;
  createdAt: string;
}

export function DeliveryQueue({ items }: { items: Item[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(fulfillmentId: string, action: "delivered" | "failed" | "requeue") {
    const reason =
      action === "failed" ? window.prompt("What went wrong? (shown to no one but staff)") : null;
    if (action === "failed" && reason === null) return;

    setBusy(fulfillmentId);
    setError(null);
    const res = await fetch("/api/admin/fulfillments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fulfillmentId, action, reason: reason ?? undefined }),
    });
    const json = await res.json();
    setBusy(null);

    if (!json.ok) {
      setError(json.error ?? "Could not update that delivery.");
      return;
    }
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="card text-center">
        <p className="text-2xl">✅</p>
        <p className="mt-2 font-semibold">Nothing to deliver</p>
        <p className="muted mt-1 text-sm">Every paid order has been sent.</p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-rose-100 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      <div className="grid gap-3">
        {items.map((item) => (
          <article key={item.publicId} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-extrabold">{item.bundle}</p>
                {/* The number the bundle must be sent to. */}
                <p className="mt-1 font-mono text-xl font-bold" style={{ color: "var(--brand)" }}>
                  {item.recipientPhone}
                </p>
                <p className="muted mt-1 text-xs">
                  {item.customerName} · {item.reference} ·{" "}
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{formatMoney(item.amount)}</p>
                <span
                  className={`badge mt-1 ${item.status === "FAILED" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-900"}`}
                >
                  {item.status.toLowerCase()}
                </span>
              </div>
            </div>

            {item.lastError && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {item.lastError}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => act(item.publicId, "delivered")}
                disabled={busy === item.publicId}
                className="btn-primary flex-1"
              >
                {busy === item.publicId ? "Saving…" : "Mark delivered"}
              </button>
              {item.status === "FAILED" ? (
                <button
                  onClick={() => act(item.publicId, "requeue")}
                  disabled={busy === item.publicId}
                  className="btn-ghost"
                >
                  Put back
                </button>
              ) : (
                <button
                  onClick={() => act(item.publicId, "failed")}
                  disabled={busy === item.publicId}
                  className="btn-ghost"
                >
                  Can't deliver
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
