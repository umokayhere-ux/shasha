import { prisma } from "@/lib/db";
import { handler, ok, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { networkSchema } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";

export const GET = handler(async () => {
  await requireAdmin();
  const networks = await prisma.network.findMany({
    where: { deletedAt: null },
    orderBy: { displayOrder: "asc" },
    include: { _count: { select: { bundles: true } } },
  });
  return ok({ networks });
});

export const POST = handler(async (req: Request) => {
  const admin = await requireAdmin();
  const input = await parseBody(req, networkSchema);

  const network = await prisma.network.create({
    data: {
      name: input.name,
      slug: input.slug,
      logoUrl: input.logoUrl ?? null,
      description: input.description ?? null,
      isActive: input.isActive,
      displayOrder: input.displayOrder,
    },
  });

  await recordAudit({
    actorId: admin.id,
    action: "NETWORK_CREATED",
    resourceType: "Network",
    resourceId: network.id,
    newValues: { name: network.name, slug: network.slug },
  });

  return ok({ network }, 201);
});
