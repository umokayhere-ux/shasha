"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Subaccount {
  publicId: string;
  displayName: string;
  subaccountCode: string;
  businessName: string | null;
  settlementBank: string | null;
  accountNumberMasked: string | null;
  isActive: boolean;
}

interface SplitConfig {
  publicId: string;
  name: string;
  mode: string;
  subaccountName: string | null;
  percentageCharge: number | null;
  transactionCharge: number | null;
  isDefault: boolean;
  isActive: boolean;
}

type Tab = "link" | "create" | "split";

export function SubaccountManager({
  subaccounts,
  configs,
  paystackConfigured,
}: {
  subaccounts: Subaccount[];
  configs: SplitConfig[];
  paystackConfigured: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("link");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function send(url: string, method: string, body: unknown, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);

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
    setNotice(success);
    router.refresh();
    return true;
  }

  async function linkExisting(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const okDone = await send(
      "/api/admin/subaccounts/link",
      "POST",
      {
        displayName: f.get("displayName"),
        subaccountCode: String(f.get("subaccountCode")).trim(),
        businessName: String(f.get("businessName") || "") || undefined,
      },
      "Subaccount linked. Activate it below to make it usable.",
    );
    if (okDone) e.currentTarget.reset();
  }

  async function createNew(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const okDone = await send(
      "/api/admin/subaccounts",
      "POST",
      {
        displayName: f.get("displayName"),
        businessName: f.get("businessName"),
        settlementBank: String(f.get("settlementBank")).trim(),
        accountNumber: String(f.get("accountNumber")).trim(),
        percentageCharge: Number(f.get("percentageCharge")),
      },
      "Subaccount created at Paystack and linked.",
    );
    if (okDone) e.currentTarget.reset();
  }

  async function createSplit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const mode = String(f.get("mode"));
    const chargeType = String(f.get("chargeType"));
    const chargeValue = Number(f.get("chargeValue"));

    const okDone = await send(
      "/api/admin/split-configs",
      "POST",
      {
        name: f.get("name"),
        mode,
        subaccountId: mode === "SUBACCOUNT_SPLIT" ? f.get("subaccountId") : undefined,
        bearer: "account",
        percentageCharge:
          mode === "SUBACCOUNT_SPLIT" && chargeType === "percentage" ? chargeValue : undefined,
        transactionCharge:
          mode === "SUBACCOUNT_SPLIT" && chargeType === "flat" ? chargeValue : undefined,
        isDefault: f.get("isDefault") === "on",
        isActive: true,
      },
      "Split configuration saved.",
    );
    if (okDone) e.currentTarget.reset();
  }

  async function toggleActive(publicId: string, isActive: boolean) {
    await send(
      `/api/admin/subaccounts/${publicId}`,
      "PATCH",
      { isActive: !isActive },
      isActive ? "Subaccount deactivated." : "Subaccount activated.",
    );
  }

  return (
    <div>
      {!paystackConfigured && (
        <p className="mb-4 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
          Paystack is not configured on this deployment. You can still link a subaccount you
          created in the Paystack dashboard — creating a new one from here needs
          PAYSTACK_SECRET_KEY.
        </p>
      )}

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-rose-100 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 rounded-xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900">
          {notice}
        </p>
      )}

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {(
          [
            ["link", "Link existing"],
            ["create", "Create new"],
            ["split", "Split rules"],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={tab === key ? "btn-primary !min-h-9 !px-3 !text-xs" : "btn-ghost !min-h-9 !px-3 !text-xs"}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "link" && (
        <form onSubmit={linkExisting} className="card mb-6 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="muted text-xs">
              Copy the subaccount code from your Paystack dashboard (Settings → Subaccounts).
            </p>
          </div>
          <div>
            <label className="label" htmlFor="l-name">Display name</label>
            <input id="l-name" name="displayName" required className="input" placeholder="Partner payout" />
          </div>
          <div>
            <label className="label" htmlFor="l-code">Subaccount code</label>
            <input id="l-code" name="subaccountCode" required className="input" placeholder="ACCT_xxxxxxxxxx" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="l-biz">Business name (optional)</label>
            <input id="l-biz" name="businessName" className="input" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Linking…" : "Link subaccount"}
            </button>
          </div>
        </form>
      )}

      {tab === "create" && (
        <form onSubmit={createNew} className="card mb-6 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="muted text-xs">
              Creates the subaccount at Paystack, then links it here. Bank details go to Paystack —
              only the last four digits of the account number are stored on this platform.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="c-name">Display name</label>
            <input id="c-name" name="displayName" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="c-biz">Business name</label>
            <input id="c-biz" name="businessName" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="c-bank">Settlement bank code</label>
            <input id="c-bank" name="settlementBank" required className="input" placeholder="e.g. 058" />
          </div>
          <div>
            <label className="label" htmlFor="c-acct">Account number</label>
            <input id="c-acct" name="accountNumber" required inputMode="numeric" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="c-pct">Percentage to subaccount (%)</label>
            <input
              id="c-pct"
              name="percentageCharge"
              type="number"
              step="0.01"
              min={0}
              max={100}
              required
              className="input"
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy || !paystackConfigured} className="btn-primary w-full">
              {busy ? "Creating…" : "Create at Paystack"}
            </button>
          </div>
        </form>
      )}

      {tab === "split" && (
        <form onSubmit={createSplit} className="card mb-6 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="muted text-xs">
              The default rule is applied server-side to every checkout. Customers never see or
              control it.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="s-name">Rule name</label>
            <input id="s-name" name="name" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="s-mode">Mode</label>
            <select id="s-mode" name="mode" className="input" defaultValue="SUBACCOUNT_SPLIT">
              <option value="PLATFORM_ONLY">Platform only (no split)</option>
              <option value="SUBACCOUNT_SPLIT">Split with subaccount</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="s-sub">Subaccount</label>
            <select id="s-sub" name="subaccountId" className="input">
              <option value="">— none —</option>
              {subaccounts.map((s) => (
                <option key={s.publicId} value={s.publicId}>
                  {s.displayName} {s.isActive ? "" : "(inactive)"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="s-type">Charge type</label>
            <select id="s-type" name="chargeType" className="input" defaultValue="percentage">
              <option value="percentage">Percentage to subaccount</option>
              <option value="flat">Flat fee kept by platform</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="s-val">Value</label>
            <input id="s-val" name="chargeValue" type="number" step="0.01" min={0} className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="isDefault" className="h-4 w-4" />
            Use as the default rule for all checkouts
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Saving…" : "Save split rule"}
            </button>
          </div>
        </form>
      )}

      <section className="card mb-6">
        <h2 className="mb-3 font-semibold">Subaccounts</h2>
        {subaccounts.length === 0 ? (
          <p className="muted py-6 text-center text-sm">
            None linked. Payments settle entirely to the main platform account.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[680px]">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Bank</th>
                  <th>Account</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {subaccounts.map((s) => (
                  <tr key={s.publicId}>
                    <td className="font-medium">{s.displayName}</td>
                    <td className="font-mono text-xs">{s.subaccountCode}</td>
                    <td className="muted">{s.settlementBank ?? "—"}</td>
                    <td className="muted font-mono text-xs">{s.accountNumberMasked ?? "—"}</td>
                    <td>
                      <span
                        className={`badge ${s.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}
                      >
                        {s.isActive ? "active" : "inactive"}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => toggleActive(s.publicId, s.isActive)}
                        disabled={busy}
                        className="text-sm font-semibold"
                        style={{ color: "var(--brand)" }}
                      >
                        {s.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">Split rules</h2>
        {configs.length === 0 ? (
          <p className="muted py-6 text-center text-sm">
            No split rule. All payments settle to the platform account.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[620px]">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Mode</th>
                  <th>Subaccount</th>
                  <th>Charge</th>
                  <th>Default</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((c) => (
                  <tr key={c.publicId}>
                    <td className="font-medium">{c.name}</td>
                    <td>{c.mode.replace(/_/g, " ").toLowerCase()}</td>
                    <td className="muted">{c.subaccountName ?? "—"}</td>
                    <td>
                      {c.transactionCharge != null
                        ? `flat ${(c.transactionCharge / 100).toFixed(2)}`
                        : c.percentageCharge != null
                          ? `${c.percentageCharge}%`
                          : "—"}
                    </td>
                    <td>{c.isDefault ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
