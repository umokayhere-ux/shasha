"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { networkTheme, type NetworkTheme } from "@/lib/network-theme";

interface Bundle {
  publicId: string;
  name: string;
  sellingPrice: number;
  dataAmount: number;
}

interface Network {
  publicId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
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

  const theme = network ? networkTheme(network.slug) : null;

  /**
   * Sends only the bundle id, recipient and promo code. The price shown is a
   * preview — the server re-reads it and decides the real charge.
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

  // --- Step 1: network picker, on the neutral platform theme ---
  if (step === "network" || !network || !theme) {
    return (
      <main className="mx-auto max-w-lg px-4 py-8">
        <header className="mb-6">
          <p className="muted text-sm font-medium uppercase tracking-widest">Buy data</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
            Choose your network
          </h1>
        </header>

        <div className="grid gap-3">
          {networks.map((n) => {
            const t = networkTheme(n.slug);
            return (
              <button
                key={n.publicId}
                onClick={() => {
                  setNetwork(n);
                  setBundle(null);
                  setStep("bundle");
                }}
                className="flex items-center gap-4 rounded-2xl p-4 text-left transition active:scale-[0.99]"
                style={{
                  background: t.bg,
                  border: `1px solid ${t.surfaceBorder}`,
                  boxShadow: "0 10px 30px rgba(2,6,23,0.12)",
                }}
              >
                <span
                  className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl"
                  style={{ background: t.bg }}
                >
                  {n.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- data URI
                    <img src={n.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span
                      aria-hidden
                      className="text-[10px] font-black"
                      style={{ color: t.accent }}
                    >
                      {t.mark}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-bold" style={{ color: t.text }}>
                    {n.name}
                  </span>
                  <span className="block text-sm" style={{ color: t.muted }}>
                    {n.bundles.length} bundle{n.bundles.length === 1 ? "" : "s"} available
                  </span>
                </span>
                <span aria-hidden className="text-xl font-bold" style={{ color: t.accent }}>
                  →
                </span>
              </button>
            );
          })}
          {networks.length === 0 && (
            <p className="muted">No networks are available right now.</p>
          )}
        </div>

        <Link href="/dashboard" className="btn-ghost mt-6 w-full">
          Back to dashboard
        </Link>
      </main>
    );
  }

  // --- Steps 2-4: full network takeover ---
  return (
    <div className="min-h-screen" style={{ background: theme.bg, color: theme.text }}>
      <div className="mx-auto max-w-lg px-4 py-6">
        <header className="mb-6 flex items-center gap-3">
          <button
            onClick={() => {
              if (step === "bundle") setStep("network");
              else if (step === "recipient") setStep("bundle");
              else setStep("recipient");
            }}
            aria-label="Back"
            className="rounded-full px-3 py-2 text-lg font-bold"
            style={{ background: theme.surface, color: theme.accent }}
          >
            ←
          </button>
          <span
            className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl"
            style={{ background: theme.surface }}
          >
            {network.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URI
              <img src={network.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden className="text-[9px] font-black" style={{ color: theme.accent }}>
                {theme.mark}
              </span>
            )}
          </span>
          <div>
            <p className="text-xl font-extrabold" style={{ color: theme.accent }}>
              {network.name}
            </p>
            <p className="text-xs" style={{ color: theme.muted }}>
              {step === "bundle"
                ? "Select a bundle"
                : step === "recipient"
                  ? "Recipient number"
                  : "Confirm order"}
            </p>
          </div>
        </header>

        {step === "bundle" && (
          <section className="grid gap-3">
            {network.bundles.map((b) => (
              <button
                key={b.publicId}
                onClick={() => {
                  setBundle(b);
                  setStep("recipient");
                }}
                className="flex items-center justify-between rounded-2xl p-4 text-left transition active:scale-[0.99]"
                style={{
                  background: theme.surface,
                  border: `1px solid ${theme.surfaceBorder}`,
                }}
              >
                <span>
                  <span className="block text-2xl font-extrabold" style={{ color: theme.text }}>
                    {b.name}
                  </span>
                  <span className="block text-xs" style={{ color: theme.muted }}>
                    Non-expiring
                  </span>
                </span>
                <span
                  className="rounded-xl px-3 py-2 text-base font-extrabold"
                  style={{ background: theme.accent, color: theme.onAccent }}
                >
                  {formatMoney(b.sellingPrice)}
                </span>
              </button>
            ))}
            {network.bundles.length === 0 && (
              <p style={{ color: theme.muted }}>No bundles available for this network yet.</p>
            )}
          </section>
        )}

        {step === "recipient" && bundle && (
          <section>
            <div
              className="mb-5 rounded-2xl p-4"
              style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}
            >
              <p className="text-sm" style={{ color: theme.muted }}>
                Selected
              </p>
              <p className="text-xl font-extrabold">
                {bundle.name} ·{" "}
                <span style={{ color: theme.accent }}>{formatMoney(bundle.sellingPrice)}</span>
              </p>
            </div>

            <label className="mb-1.5 block text-sm font-semibold" htmlFor="phone">
              Send data to
            </label>
            <input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="0XXXXXXXXX"
              className="w-full rounded-xl px-4 py-3.5 text-lg font-semibold outline-none"
              style={{
                background: theme.surface,
                border: `1px solid ${theme.surfaceBorder}`,
                color: theme.text,
              }}
            />

            <label className="mb-1.5 mt-4 block text-sm font-semibold" htmlFor="promo">
              Promo code <span style={{ color: theme.muted }}>(optional)</span>
            </label>
            <input
              id="promo"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              className="w-full rounded-xl px-4 py-3.5 outline-none"
              style={{
                background: theme.surface,
                border: `1px solid ${theme.surfaceBorder}`,
                color: theme.text,
              }}
            />

            <button
              onClick={() => setStep("summary")}
              disabled={!/^(?:\+?233|0)\d{9}$/.test(phone.replace(/[\s-]/g, ""))}
              className="mt-6 w-full rounded-xl py-4 text-base font-extrabold transition active:scale-[0.99] disabled:opacity-40"
              style={{ background: theme.accent, color: theme.onAccent }}
            >
              Continue
            </button>
          </section>
        )}

        {step === "summary" && bundle && (
          <section>
            <div
              className="rounded-2xl p-5"
              style={{ background: theme.surface, border: `1px solid ${theme.surfaceBorder}` }}
            >
              <Row theme={theme} label="Network" value={network.name} />
              <Row theme={theme} label="Bundle" value={bundle.name} />
              <Row theme={theme} label="Validity" value="Non-expiring" />
              <Row theme={theme} label="Recipient" value={phone} />
              {promoCode && <Row theme={theme} label="Promo code" value={promoCode} />}

              <div
                className="mt-3 flex items-center justify-between border-t pt-4"
                style={{ borderColor: theme.surfaceBorder }}
              >
                <span className="text-sm font-semibold">Total</span>
                <span className="text-2xl font-extrabold" style={{ color: theme.accent }}>
                  {formatMoney(bundle.sellingPrice)}
                </span>
              </div>
              <p className="mt-2 text-xs" style={{ color: theme.muted }}>
                Any promo discount is confirmed at checkout.
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl px-4 py-3 text-sm font-medium"
                style={{ background: "#7f1d1d", color: "#fee2e2" }}
              >
                {error}
              </p>
            )}

            <button
              onClick={submit}
              disabled={submitting}
              className="mt-6 w-full rounded-xl py-4 text-base font-extrabold transition active:scale-[0.99] disabled:opacity-50"
              style={{ background: theme.accent, color: theme.onAccent }}
            >
              {submitting ? "Starting payment…" : `Pay ${formatMoney(bundle.sellingPrice)}`}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

function Row({ theme, label, value }: { theme: NetworkTheme; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span style={{ color: theme.muted }}>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
