"use client";

import { useState } from "react";

interface SetupResult {
  indexes: { created: number; failed: Array<{ index: string; reason: string }> };
  networks: number;
  bundles: number;
  adminEmail: string;
}

export default function SetupPage() {
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SetupResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: form.get("token"),
        email: form.get("email"),
        password: form.get("password"),
        name: form.get("name"),
      }),
    });
    const json = await res.json();
    setLoading(false);

    if (!json.ok) {
      const details = json.details as Record<string, string[]> | undefined;
      setError(details ? (Object.values(details)[0]?.[0] ?? json.error) : json.error);
      return;
    }
    setResult(json.data as SetupResult);
  }

  if (result) {
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <div className="card">
          <h1 className="text-xl font-bold">Setup complete</h1>
          <ul className="mt-4 space-y-1 text-sm">
            <li>Indexes created: {result.indexes.created}</li>
            <li>Networks: {result.networks}</li>
            <li>Bundles: {result.bundles}</li>
            <li>Admin: {result.adminEmail}</li>
          </ul>

          {result.indexes.failed.length > 0 && (
            <div className="mt-4 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
              <p className="font-semibold">Some indexes were not created:</p>
              <ul className="mt-1 list-disc pl-4">
                {result.indexes.failed.map((f) => (
                  <li key={f.index}>
                    {f.index}: {f.reason}
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                Duplicate protection is incomplete until these succeed. Resolve them before
                taking real payments.
              </p>
            </div>
          )}

          <a href="/login" className="btn-primary mt-6 w-full">
            Sign in as admin
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="card">
        <h1 className="text-xl font-bold">First-time setup</h1>
        <p className="muted mt-2 text-sm">
          Creates the database indexes, seeds test bundles, and creates your Super Admin
          account. This runs only once — it stops working as soon as an admin exists.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="token">
              Setup token
            </label>
            <input id="token" name="token" required className="input" autoComplete="off" />
            <p className="muted mt-1 text-xs">Your CRON_SECRET environment variable.</p>
          </div>
          <div>
            <label className="label" htmlFor="name">
              Your name
            </label>
            <input id="name" name="name" defaultValue="Super Admin" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Admin email
            </label>
            <input id="email" name="email" type="email" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Admin password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={10}
              className="input"
              autoComplete="new-password"
            />
            <p className="muted mt-1 text-xs">
              At least 10 characters, with a letter and a number.
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Running setup…" : "Run setup"}
          </button>
        </form>
      </div>
    </main>
  );
}
