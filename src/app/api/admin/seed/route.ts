import { handler, ok } from "@/lib/api";
import { requireSuperAdmin } from "@/lib/auth";
import { seedCatalog } from "@/lib/setup";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Re-runnable catalog seed for an already-provisioned install, where /setup is
 * permanently inert. Every write is an upsert, so this tops up what is missing
 * without duplicating networks or resetting edited prices.
 */
export const POST = handler(async () => {
  const admin = await requireSuperAdmin();
  const result = await seedCatalog();

  await recordAudit({
    actorId: admin.id,
    action: "CATALOG_SEEDED",
    resourceType: "System",
    newValues: { networks: result.networks, bundles: result.bundles },
  });

  return ok(result);
});
