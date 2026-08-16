import { prisma } from "@/lib/db";

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
  const config = {
    databaseUrl: Boolean(process.env.DATABASE_URL),
    authSecret: (process.env.AUTH_SECRET?.length ?? 0) >= 32,
    appUrl: process.env.APP_URL ?? null,
    paystackSecretKey: Boolean(process.env.PAYSTACK_SECRET_KEY),
    cronSecret: Boolean(process.env.CRON_SECRET),
  };

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
    { ok: setupComplete, config, database, nextSteps },
    { status: setupComplete ? 200 : 503 },
  );
}
