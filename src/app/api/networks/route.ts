import { prisma } from "@/lib/db";
import { handler, ok } from "@/lib/api";
import { NOT_DELETED } from "@/lib/not-deleted";

// Public catalog: customers only ever see active, non-deleted networks.
export const GET = handler(async () => {
  const networks = await prisma.network.findMany({
    where: { isActive: true, ...NOT_DELETED },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { publicId: true, name: true, slug: true, logoUrl: true, description: true },
  });
  return ok({ networks });
});
