"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Deletes a customer, behind a typed confirmation.
 *
 * The action cannot be undone from the UI, so a plain click is not enough —
 * the admin has to type the customer's name. This is a phone-first admin, where
 * a stray tap on a small row is easy.
 */
export function DeleteCustomerButton({
  publicId,
  name,
  orderCount,
}: {
  publicId: string;
  name: string;
  orderCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${publicId}`, { method: "DELETE" });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(body?.error ?? "Could not delete this customer.");
        setBusy(false);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setTyped("");
          setError(null);
          setOpen(true);
        }}
        className="text-sm font-semibold"
        style={{ color: "var(--danger)" }}
      >
        Delete
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="card w-full max-w-md">
        <h3 className="text-lg font-bold">Delete {name}?</h3>
        <p className="muted mt-2 text-sm">
          They will lose access immediately and can no longer sign in.
          {orderCount > 0 && (
            <>
              {" "}
              Their {orderCount} order{orderCount === 1 ? "" : "s"} and payment records are kept,
              so your reports stay correct.
            </>
          )}
        </p>

        <label className="label mt-4">
          Type <span className="font-semibold">{name}</span> to confirm
        </label>
        <input
          className="input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />

        {error && <p className="alert-error mt-3">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn flex-1 text-white"
            style={{ background: "var(--danger)" }}
            disabled={busy || typed.trim() !== name}
            onClick={remove}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
