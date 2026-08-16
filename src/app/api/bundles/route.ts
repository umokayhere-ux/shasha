import { prisma } from "@/lib/db";
import { handler, ok } from "@/lib/api";

export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const network = url.searchParams.get("network");
  const featured = url.searchParams.get("featured") === "true";

  const bundles = await prisma.bundle.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      ...(featured ? { isFeatured: true } : {}),
      network: {
        isActive: true,
        deletedAt: null,
        ...(network ? { slug: network } : {}),
      },
    },
    orderBy: [{ displayOrder: "asc" }, { sellingPrice: "asc" }],
    select: {
      publicId: true,
      name: true,
      dataAmount: true,
      dataUnit: true,
      sellingPrice: true,
      validityDays: true,
      description: true,
      isFeatured: true,
      network: { select: { publicId: true, name: true, slug: true } },
    },
  });

  // costPrice and margins are admin-only and are never selected here.
  return ok({ bundles });
});
