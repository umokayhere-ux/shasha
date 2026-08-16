"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BUSINESS_NAME, BUSINESS_TAGLINE } from "@/lib/branding";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">{BUSINESS_NAME}</h1>
        <p className="muted mt-1 text-sm">{BUSINESS_TAGLINE}</p>
      </div>
      <div className="card">
        <h2 className="text-xl font-bold">Welcome back</h2>
        <p className="muted mt-1 text-sm">Sign in to buy data and track your orders.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="muted mt-5 text-center text-sm">
          No account?{" "}
          <Link href="/register" className="font-semibold" style={{ color: "var(--brand)" }}>
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
