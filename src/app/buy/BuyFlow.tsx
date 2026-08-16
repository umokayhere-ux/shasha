"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";

interface Bundle {
  publicId: string;
  name: string;
  sellingPrice: number;
  validityDays: number;
  dataAmount: number;
}

interface Network {
  publicId: string;
  name: string;
  slug: string;
  bundles: Bundle[];
}

type Step = "network" | "bundle" | "recipient" | "summary";

export function BuyFlow({ networks }: { networks: Network[] }) {
  const [step, setStep] = useState<Step>("network");
  const [network, setNetwork] = useState<Network | null>(null);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [phone, setPhone] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Sends only the bundle id, recipient and promo code. The amount shown below
   * is a preview — the server re-reads the price and computes the real charge.
   */
  async function submit() {
    if (!bundle || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundleId: bundle.publicId,
          recipientPhone: phone,
          promoCode: promoCode || undefined,
          paymentMethod: "PAYSTACK",
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        const details = json.details as Record<string, string[]> | undefined;
        setError(details ? (Object.values(details)[0]?.[0] ?? json.error) : json.error);
        setSubmitting(false);
        return;
      }
      window.location.href = json.data.authorizationUrl;
    } catch {
      setError("We could not start your payment. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <ol className="muted mb-6 flex gap-2 text-xs font-semibold uppercase tracking-wide">
        {(["network", "bundle", "recipient", "summary"] as Step[]).map((s, i) => (
          <li key={s} className={step === s ? "text-brand-600" : undefined}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === "network" && (
        <section>
          <h1 className="mb-4 text-xl font-bold">Choose a network</h1>
          <div className="grid grid-cols-2 gap-3">
            {networks.map((n) => (
              <button
                key={n.publicId}
                onClick={() => {
                  setNetwork(n);
                  setStep("bundle");
                }}
                className="card min-h-20 font-semibold hover:border-brand-500"
              >
                {n.name}
              </button>
            ))}
          </div>
          {networks.length === 0 && <p className="muted">No networks are available right now.</p>}
        </section>
      )}

      {step === "bundle" && network && (
        <section>
          <h1 className="mb-4 text-xl font-bold">{network.name} bundles</h1>
          <div className="space-y-3">
            {network.bundles.map((b) => (
              <button
                key={b.publicId}
                onClick={() => {
                  setBundle(b);
                  setStep("recipient");
                }}
                className="card flex w-full items-center justify-between text-left hover:border-brand-500"
              >
                <span>
                  <span className="block font-semibold">{b.name}</span>
                  <span className="muted text-sm">Valid {b.validityDays} days</span>
                </span>
                <span className="text-lg font-bold">{formatMoney(b.sellingPrice)}</span>
              </button>
            ))}
            {network.bundles.length === 0 && (
              <p className="muted">No bundles available for this network yet.</p>
            )}
          </div>
          <button onClick={() => setStep("network")} className="btn-ghost mt-4">
            Back
          </button>
        </section>
      )}

      {step === "recipient" && bundle && (
        <section>
          <h1 className="mb-4 text-xl font-bold">Who is this data for?</h1>
          <label className="label" htmlFor="phone">
            Recipient phone number
          </label>
          <input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="0XXXXXXXXX"
            className="input"
          />
          <label className="label mt-4" htmlFor="promo">
            Promo code (optional)
          </label>
          <input
            id="promo"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            className="input"
          />
          <div className="mt-4 flex gap-2">
            <button onClick={() => setStep("bundle")} className="btn-ghost flex-1">
              Back
            </button>
            <button
              onClick={() => setStep("summary")}
              disabled={!/^(?:\+?233|0)\d{9}$/.test(phone.replace(/[\s-]/g, ""))}
              className="btn-primary flex-1"
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === "summary" && bundle && network && (
        <section>
          <h1 className="mb-4 text-xl font-bold">Confirm your order</h1>
          <div className="card space-y-2 text-sm">
            <Row label="Network" value={network.name} />
            <Row label="Bundle" value={bundle.name} />
            <Row label="Validity" value={`${bundle.validityDays} days`} />
            <Row label="Recipient" value={phone} />
            {promoCode && <Row label="Promo code" value={promoCode} />}
            <div className="flex justify-between border-t pt-3 text-base font-bold">
              <span>Total</span>
              <span>{formatMoney(bundle.sellingPrice)}</span>
            </div>
            <p className="muted text-xs">
              Any promo discount is applied and confirmed at checkout.
            </p>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button onClick={() => setStep("recipient")} className="btn-ghost flex-1">
              Back
            </button>
            <button onClick={submit} disabled={submitting} className="btn-primary flex-1">
              {submitting ? "Starting payment…" : "Pay now"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
