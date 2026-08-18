"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    const json = await res.json();
    setLoading(false);

    if (!json.ok) {
      setError(json.error ?? "Could not sign you in.");
      return;
    }
    // The server decides the role; we only route on what it returns.
    router.push(json.data.role === "CUSTOMER" ? "/dashboard" : "/admin");
    router.refresh();
  }

  return (
    <AuthShell
      heading="welcome"
      subheading="Log in to your account to continue"
      panelTitle="Welcome Back!"
      panelBody="To stay connected with us, please log in with your personal info."
      panelCtaLabel="Create account"
      panelCtaHref="/register"
    >
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="sr-only" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            className="input-mint"
          />
        </div>

        <div>
          <label className="sr-only" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Password"
            className="input-mint"
          />
        </div>

        <p className="text-center">
          <Link href="/forgot-password" className="muted text-xs hover:underline">
            Forgot your password?
          </Link>
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
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>

      <p className="muted mt-6 text-center text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-bold" style={{ color: "var(--cust-deep)" }}>
          sign up
        </Link>
      </p>
    </AuthShell>
  );
}
