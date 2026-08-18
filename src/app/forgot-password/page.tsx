"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });
    const json = await res.json();
    setLoading(false);

    if (!json.ok) {
      setError(json.error ?? "Could not send the reset link.");
      return;
    }
    // The response is identical whether or not the address exists, so the page
    // cannot be used to discover which emails are registered.
    setSent(true);
  }

  return (
    <AuthShell
      heading="reset"
      subheading="We'll send you a link to set a new password"
      panelTitle="Forgot it?"
      panelBody="It happens. Enter your email and we'll help you back into your account."
      panelCtaLabel="Back to sign in"
      panelCtaHref="/login"
    >
      {sent ? (
        <div className="mt-8 text-center">
          <p className="alert-ok">
            If that email is registered, a reset link has been sent.
          </p>
          <Link href="/login" className="btn-pill mt-6" style={{ background: "var(--cust-deep)", color: "#fff" }}>
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="sr-only" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="Email"
            className="input-mint"
          />

          {error && (
            <p role="alert" className="alert-error text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-pill"
            style={{ background: "var(--cust-deep)", color: "#ffffff" }}
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
