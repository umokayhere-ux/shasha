import { prisma } from "@/lib/db";
import { cleanUrl } from "@/lib/env";
import { smsConfigured } from "@/lib/sms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Deployment diagnostics.
 *
 * Reports only booleans and coarse status strings — never a secret's value, and
 * never a raw driver error, since those can carry credentials from the
 * connection string.
 */
export async function GET() {
  const paystackBaseUrl = cleanUrl(process.env.PAYSTACK_BASE_URL, "https://api.paystack.co");

  const config = {
    databaseUrl: Boolean(process.env.DATABASE_URL),
    authSecret: (process.env.AUTH_SECRET?.length ?? 0) >= 32,
    // Resolved values, so a pasted "<url>\n" is visible as the cleaned result.
    appUrl: cleanUrl(process.env.APP_URL, ""),
    paystackSecretKey: Boolean(process.env.PAYSTACK_SECRET_KEY),
    paystackKeyMode: process.env.PAYSTACK_SECRET_KEY?.trim().startsWith("sk_live")
      ? "live"
      : process.env.PAYSTACK_SECRET_KEY?.trim().startsWith("sk_test")
        ? "test"
        : null,
    paystackBaseUrl,
    cronSecret: Boolean(process.env.CRON_SECRET),
    sms: smsConfigured(),
  };

  // Live reachability probe: this is the exact failure customers hit at
  // checkout, so surface it here rather than only in the server logs.
  let paystack: { reachable: boolean; reason?: string } = { reachable: false };
  if (!config.paystackSecretKey) {
    paystack = { reachable: false, reason: "PAYSTACK_SECRET_KEY is not set" };
  } else {
    try {
      const res = await fetch(`${paystackBaseUrl}/bank?country=ghana`, {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY?.trim()}` },
        cache: "no-store",
      });
      paystack = res.ok
        ? { reachable: true }
        : { reachable: false, reason: `Paystack replied ${res.status} — check the secret key` };
    } catch (err) {
      console.error("[health] paystack probe failed", err);
      paystack = {
        reachable: false,
        reason: `Could not reach ${paystackBaseUrl} — check PAYSTACK_BASE_URL`,
      };
    }
  }

  let database: {
    reachable: boolean;
    reason?: string;
    networks?: number;
    bundles?: number;
    admins?: number;
  } = { reachable: false };

  if (!config.databaseUrl) {
    database = { reachable: false, reason: "DATABASE_URL is not set" };
  } else {
    try {
      const [networks, bundles, admins] = await Promise.all([
        prisma.network.count(),
        prisma.bundle.count(),
        prisma.user.count({ where: { role: "SUPER_ADMIN" } }),
      ]);
      database = { reachable: true, networks, bundles, admins };
    } catch (err) {
      // Classify without echoing the driver message.
      const raw = err instanceof Error ? err.message : "";
      const reason = /Server selection|Connection refused|timeout/i.test(raw)
        ? "Cannot reach MongoDB — check the connection string and Atlas Network Access allowlist"
        : /Authentication failed|auth/i.test(raw)
          ? "MongoDB rejected the credentials"
          : "Database query failed — check the server logs";
      database = { reachable: false, reason };
      console.error("[health] database check failed", err);
    }
  }

  const setupComplete =
    config.databaseUrl &&
    config.authSecret &&
    database.reachable &&
    (database.networks ?? 0) > 0 &&
    (database.admins ?? 0) > 0;

  const nextSteps: string[] = [];
  if (!config.databaseUrl) nextSteps.push("Set DATABASE_URL in your host's environment variables");
  if (!config.authSecret) nextSteps.push("Set AUTH_SECRET to at least 32 characters");
  if (config.databaseUrl && !database.reachable) nextSteps.push("Fix the database connection");
  if (database.reachable && (database.networks ?? 0) === 0) {
    nextSteps.push("Run `npm run db:push` then `npm run db:seed` against this database");
  }
  if (database.reachable && (database.admins ?? 0) === 0) {
    nextSteps.push("Run `npm run admin:create` to create the Super Admin");
  }
  if (!config.appUrl) nextSteps.push("Set APP_URL to this deployment's URL (Paystack callbacks use it)");
  if (!config.paystackSecretKey) nextSteps.push("Set PAYSTACK_SECRET_KEY to accept payments");
  if (!config.cronSecret) nextSteps.push("Set CRON_SECRET so the retry job can run");

  return Response.json(
    { ok: setupComplete, config, database, paystack, nextSteps },
    { status: setupComplete ? 200 : 503 },
  );
}
