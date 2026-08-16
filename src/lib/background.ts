import { after } from "next/server";

/**
 * Runs work after the response has been sent.
 *
 * On serverless (Vercel), a plain floating promise is NOT safe: the instance is
 * frozen once the response returns, so `void doWork()` can be killed mid-flight
 * — which for us would mean a paid order whose delivery never ran. `after()`
 * keeps the invocation alive until the task settles.
 *
 * Falls back to a floating promise outside a request scope (cron worker, tests),
 * where `after()` is unavailable.
 */
export function runInBackground(label: string, task: () => Promise<unknown>): void {
  const guarded = () =>
    Promise.resolve()
      .then(task)
      .catch((err) => console.error("[background] %s failed", label, err));

  try {
    after(guarded);
  } catch {
    void guarded();
  }
}
