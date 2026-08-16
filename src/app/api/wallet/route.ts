import { prisma } from "@/lib/db";
import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const GET = handler(async () => {
  const user = await requireUser();
  const wallet = await prisma.wallet.findUnique({
    where: { userId: user.id },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 25 } },
  });
  return ok({
    balance: wallet?.balance ?? 0,
    currency: wallet?.currency ?? "GHS",
    transactions: wallet?.transactions ?? [],
  });
});
