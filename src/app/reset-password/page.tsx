"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: form.get("password") }),
    });
    const json = await res.json();
    setLoading(false);

    if (!json.ok) {
      const details = json.details as Record<string, string[]> | undefined;
      setError(details ? (Object.values(details)[0]?.[0] ?? json.error) : json.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-8 text-center">
        <p className="alert-ok">Your password has been reset.</p>
        <Link
          href="/login"
          className="btn-pill mt-6"
          style={{ background: "var(--cust-deep)", color: "#fff" }}
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      {!token && (
        <p className="alert-warn text-center">
          This link is missing its reset token. Request a new one.
        </p>
      )}

      <label className="sr-only" htmlFor="password">
        New password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        minLength={10}
        placeholder="New password"
        className="input-mint"
        autoComplete="new-password"
      />
      <p className="muted text-center text-[11px]">
        At least 10 characters, with a letter and a number.
      </p>

      {error && (
        <p role="alert" className="alert-error text-center">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !token}
        className="btn-pill"
        style={{ background: "var(--cust-deep)", color: "#ffffff" }}
      >
        {loading ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      heading="new password"
      subheading="Choose a password you'll remember"
      panelTitle="Almost there"
      panelBody="Set a new password and you'll be signed back in to your account."
      panelCtaLabel="Back to sign in"
      panelCtaHref="/login"
    >
      {/* useSearchParams needs a Suspense boundary during prerender. */}
      <Suspense fallback={<p className="muted mt-8 text-center text-sm">Loading…</p>}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
