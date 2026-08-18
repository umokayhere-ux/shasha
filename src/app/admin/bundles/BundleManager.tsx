"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface BundleRow {
  publicId: string;
  name: string;
  networkName: string;
  networkId: string;
  sellingPrice: number;
  costPrice: number;
  sellingPriceLabel: string;
  costPriceLabel: string;
  marginLabel: string;
  isActive: boolean;
}

export function BundleManager({
  bundles,
  networks,
}: {
  bundles: BundleRow[];
  networks: Array<{ publicId: string; name: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(url: string, method: string, body: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setBusy(false);
    if (!json.ok) {
      const details = json.details as Record<string, string[]> | undefined;
      setError(details ? (Object.values(details)[0]?.[0] ?? json.error) : json.error);
      return false;
    }
    setEditing(null);
    setCreating(false);
    router.refresh();
    return true;
  }

  async function updatePrice(e: React.FormEvent<HTMLFormElement>, publicId: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await send(`/api/admin/bundles/${publicId}`, "PATCH", {
      sellingPrice: Number(form.get("sellingPrice")),
      costPrice: Number(form.get("costPrice")),
      priceChangeReason: String(form.get("reason") || ""),
    });
  }

  async function createBundle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await send("/api/admin/bundles", "POST", {
      networkId: form.get("networkId"),
      name: form.get("name"),
      dataAmount: Number(form.get("dataAmount")),
      dataUnit: form.get("dataUnit"),
      sellingPrice: Number(form.get("sellingPrice")),
      costPrice: Number(form.get("costPrice")),
    });
  }

  return (
    <div>
      {error && (
        <p role="alert" className="alert-error mb-4">
          {error}
        </p>
      )}

      <button onClick={() => setCreating((v) => !v)} className="btn-primary mb-4">
        {creating ? "Cancel" : "Add bundle"}
      </button>

      {creating && (
        <form onSubmit={createBundle} className="card mb-6 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="networkId">Network</label>
            <select id="networkId" name="networkId" required className="input">
              {networks.map((n) => (
                <option key={n.publicId} value={n.publicId}>{n.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="name">Bundle name</label>
            <input id="name" name="name" required placeholder="1GB" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="dataAmount">Data amount</label>
            <input id="dataAmount" name="dataAmount" type="number" min={1} required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="dataUnit">Unit</label>
            <select id="dataUnit" name="dataUnit" className="input">
              <option value="MB">MB</option>
              <option value="GB">GB</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sellingPrice">Selling price</label>
            <input id="sellingPrice" name="sellingPrice" type="number" step="0.01" min={0} required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="costPrice">Cost price</label>
            <input id="costPrice" name="costPrice" type="number" step="0.01" min={0} required className="input" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={busy} className="btn-primary w-full">Create bundle</button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="muted text-xs uppercase">
            <tr>
              <th className="pb-2">Network</th>
              <th className="pb-2">Bundle</th>
              <th className="pb-2">Selling</th>
              <th className="pb-2">Cost</th>
              <th className="pb-2">Margin</th>
              <th className="pb-2">Status</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {bundles.map((b) => (
              <tr key={b.publicId}>
                <td className="py-2">{b.networkName}</td>
                <td className="py-2 font-medium">{b.name}</td>
                <td className="py-2">{b.sellingPriceLabel}</td>
                <td className="py-2">{b.costPriceLabel}</td>
                <td className="py-2 font-semibold text-emerald-600">{b.marginLabel}</td>
                <td className="py-2">
                  <span className={`${b.isActive ? "badge-ok" : "badge-neutral"}`}>
                    {b.isActive ? "active" : "inactive"}
                  </span>
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => setEditing(editing === b.publicId ? null : b.publicId)}
                    className="link text-sm"
                  >
                    {editing === b.publicId ? "Close" : "Edit price"}
                  </button>
                </td>
              </tr>
            ))}
            {bundles.length === 0 && (
              <tr><td colSpan={7} className="muted py-6 text-center">No bundles yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <form
          onSubmit={(e) => updatePrice(e, editing)}
          className="card mt-4 grid gap-3 sm:grid-cols-4"
        >
          <div>
            <label className="label" htmlFor="edit-selling">New selling price</label>
            <input
              id="edit-selling"
              name="sellingPrice"
              type="number"
              step="0.01"
              min={0}
              required
              defaultValue={(bundles.find((b) => b.publicId === editing)!.sellingPrice / 100).toFixed(2)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="edit-cost">New cost price</label>
            <input
              id="edit-cost"
              name="costPrice"
              type="number"
              step="0.01"
              min={0}
              required
              defaultValue={(bundles.find((b) => b.publicId === editing)!.costPrice / 100).toFixed(2)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="edit-reason">Reason (optional)</label>
            <input id="edit-reason" name="reason" className="input" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={busy} className="btn-primary w-full">Save price</button>
          </div>
        </form>
      )}
    </div>
  );
}
