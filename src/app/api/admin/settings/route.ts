import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, ok, parseBody } from "@/lib/api";
import { requireSuperAdmin } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

const schema = z.object({
  settings: z.record(z.string().max(60), z.union([z.string(), z.number(), z.boolean()])),
});

export const GET = handler(async () => {
  await requireSuperAdmin();
  // Secret-flagged settings are excluded; secrets live in env vars, not here.
  const settings = await prisma.systemSetting.findMany({ where: { isSecret: false } });
  return ok({
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
    paystackConfigured: Boolean(process.env.PAYSTACK_SECRET_KEY),
  });
});

export const PUT = handler(async (req: Request) => {
  const admin = await requireSuperAdmin();
  const { settings } = await parseBody(req, schema);

  await prisma.$transaction(
    Object.entries(settings).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    ),
  );

  await recordAudit({
    actorId: admin.id,
    action: "SETTINGS_UPDATED",
    resourceType: "SystemSetting",
    newValues: settings,
  });

  return ok({ updated: Object.keys(settings).length });
});
