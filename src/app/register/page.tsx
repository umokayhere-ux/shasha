"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BUSINESS_NAME } from "@/lib/branding";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">{BUSINESS_NAME}</h1>
        <p className="muted mt-1 text-sm">Create an account to start buying data.</p>
      </div>
      <div className="card">
        <h2 className="text-xl font-bold">Create your account</h2>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input id="name" name="name" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="phone">Phone number</label>
            <input id="phone" name="phone" inputMode="tel" required placeholder="0XXXXXXXXX" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required minLength={10} className="input" />
            <p className="muted mt-1 text-xs">At least 10 characters, with a letter and a number.</p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="muted mt-4 text-center text-sm">
          Already registered?{" "}
          <Link href="/login" className="font-semibold" style={{ color: "var(--brand)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
