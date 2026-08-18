"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone"),
        password: form.get("password"),
      }),
    });
    const json = await res.json();
    setLoading(false);

    if (!json.ok) {
      const details = json.details as Record<string, string[]> | undefined;
      const first = details ? Object.values(details)[0]?.[0] : undefined;
      setError(first ?? json.error ?? "Could not create your account.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell
      heading="join us"
      subheading="Create an account to start buying data"
      panelTitle="Hello there!"
      panelBody="Already registered? Sign in and pick up right where you left off."
      panelCtaLabel="Sign in"
      panelCtaHref="/login"
    >
      <form onSubmit={onSubmit} className="mt-8 space-y-3.5">
        <label className="sr-only" htmlFor="name">
          Full name
        </label>
        <input id="name" name="name" required placeholder="Full name" className="input-mint" />

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

        <label className="sr-only" htmlFor="phone">
          Phone number
        </label>
        <input
          id="phone"
          name="phone"
          inputMode="tel"
          required
          placeholder="Phone number (0XXXXXXXXX)"
          className="input-mint"
        />

        <label className="sr-only" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          placeholder="Password"
          className="input-mint"
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
          disabled={loading}
          className="btn-pill"
          style={{ background: "var(--cust-deep)", color: "#ffffff" }}
        >
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>

      <p className="muted mt-6 text-center text-sm">
        Already registered?{" "}
        <Link href="/login" className="font-bold" style={{ color: "var(--cust-deep)" }}>
          log in
        </Link>
      </p>
    </AuthShell>
  );
}
