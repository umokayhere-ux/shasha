import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handler, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

/**
 * All profit figures derive from the per-order snapshots captured at purchase
 * time. Current bundle prices are deliberately not consulted, so editing a
 * price today cannot rewrite last month's reported margin.
 */
export const GET = handler(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where = {
    paymentStatus: PaymentStatus.PAID,
    ...(from || to
      ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {}),
  };

  const [totals, byNetwork, byBundle, statusCounts] = await Promise.all([
    prisma.order.aggregate({
      where,
      _sum: { finalAmount: true, costPriceSnapshot: true, discountAmount: true },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ["networkNameSnapshot"],
      where,
      _sum: { finalAmount: true, costPriceSnapshot: true },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ["bundleNameSnapshot", "networkNameSnapshot"],
      where,
      _sum: { finalAmount: true, costPriceSnapshot: true },
      _count: true,
      orderBy: { _count: { bundleNameSnapshot: "desc" } },
      take: 20,
    }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
  ]);

  const sales = totals._sum.finalAmount ?? 0;
  const cost = totals._sum.costPriceSnapshot ?? 0;

  return ok({
    summary: {
      orders: totals._count,
      sales,
      cost,
      discounts: totals._sum.discountAmount ?? 0,
      grossProfit: sales - cost,
    },
    byNetwork: byNetwork.map((n) => ({
      network: n.networkNameSnapshot,
      orders: n._count,
      sales: n._sum.finalAmount ?? 0,
      cost: n._sum.costPriceSnapshot ?? 0,
      grossProfit: (n._sum.finalAmount ?? 0) - (n._sum.costPriceSnapshot ?? 0),
    })),
    topBundles: byBundle.map((b) => ({
      bundle: b.bundleNameSnapshot,
      network: b.networkNameSnapshot,
      orders: b._count,
      sales: b._sum.finalAmount ?? 0,
      grossProfit: (b._sum.finalAmount ?? 0) - (b._sum.costPriceSnapshot ?? 0),
    })),
    statusCounts,
  });
});
