import { prisma } from "@/lib/db";
import { handler, ok, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;

  const bundle = await prisma.bundle.findUnique({ where: { publicId: id } });
  if (!bundle) throw new ApiError("Bundle not found", 404);

  const history = await prisma.bundlePriceHistory.findMany({
    where: { bundleId: bundle.id },
    orderBy: { createdAt: "desc" },
    include: { changedBy: { select: { name: true, email: true } } },
  });
  return ok({ history });
});
