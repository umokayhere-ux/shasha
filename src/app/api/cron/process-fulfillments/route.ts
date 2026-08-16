import { timingSafeEqual } from "node:crypto";
import { processQueue, recoverStalledFulfillments } from "@/lib/fulfillment";
import { pruneRateLimits } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Give the drain room to finish; raise on a paid Vercel plan if batches grow.
export const maxDuration = 60;

/**
 * Safety net for delivery.
 *
 * `after()` already runs the delivery attempt inline, so this is not the primary
 * path — it exists to catch jobs whose invocation died, deliveries that returned
 * PROCESSING, and retryable failures. Vercel Cron calls it on a schedule
 * (see vercel.json).
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without CRON_SECRET
 * set, the route refuses to run rather than exposing an open trigger.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron] CRON_SECRET is not set — refusing to run");
    return Response.json({ ok: false, error: "Not configured" }, { status: 503 });
  }

  const provided = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const recovered = await recoverStalledFulfillments();
    const processed = await processQueue(25);
    const pruned = await pruneRateLimits();
    return Response.json({ ok: true, recovered, processed, pruned });
  } catch (err) {
    console.error("[cron] run failed", err);
    return Response.json({ ok: false, error: "Run failed" }, { status: 500 });
  }
}
