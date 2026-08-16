import { prisma } from "@/lib/db";
import { handler, ok } from "@/lib/api";

// Public catalog: customers only ever see active, non-deleted networks.
export const GET = handler(async () => {
  const networks = await prisma.network.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { publicId: true, name: true, slug: true, logoUrl: true, description: true },
  });
  return ok({ networks });
});
