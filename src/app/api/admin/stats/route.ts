import { FulfillmentStatus, OrderStatus, PaymentStatus, Role, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handler, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - n);
  return d;
}

export const GET = handler(async () => {
  await requireAdmin();
  const today = startOfToday();

  const paidOrder = { paymentStatus: PaymentStatus.PAID };

  const [
    totalCustomers,
    activeCustomers,
    suspendedCustomers,
    totalOrders,
    todayOrders,
    successfulOrders,
    pendingOrders,
    failedOrders,
    activeBundles,
    activeNetworks,
    pendingFulfillments,
    failedFulfillments,
    revenueAll,
    revenueToday,
    revenueWeek,
    revenueMonth,
    recentOrders,
  ] = await Promise.all([
    prisma.user.count({ where: { role: Role.CUSTOMER, deletedAt: null } }),
    prisma.user.count({ where: { role: Role.CUSTOMER, status: UserStatus.ACTIVE, deletedAt: null } }),
    prisma.user.count({ where: { role: Role.CUSTOMER, status: UserStatus.SUSPENDED } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: today } } }),
    prisma.order.count({ where: { status: OrderStatus.SUCCESSFUL } }),
    prisma.order.count({ where: { status: { in: [OrderStatus.PENDING, OrderStatus.PROCESSING] } } }),
    prisma.order.count({ where: { status: OrderStatus.FAILED } }),
    prisma.bundle.count({ where: { isActive: true, deletedAt: null } }),
    prisma.network.count({ where: { isActive: true, deletedAt: null } }),
    prisma.fulfillment.count({
      where: {
        status: { in: [FulfillmentStatus.QUEUED, FulfillmentStatus.PENDING, FulfillmentStatus.PROCESSING] },
      },
    }),
    prisma.fulfillment.count({ where: { status: FulfillmentStatus.FAILED } }),
    // Revenue and cost come from the order snapshots, never from live prices.
    prisma.order.aggregate({
      where: paidOrder,
      _sum: { finalAmount: true, costPriceSnapshot: true },
    }),
    prisma.order.aggregate({
      where: { ...paidOrder, createdAt: { gte: today } },
      _sum: { finalAmount: true },
    }),
    prisma.order.aggregate({
      where: { ...paidOrder, createdAt: { gte: daysAgo(7) } },
      _sum: { finalAmount: true },
    }),
    prisma.order.aggregate({
      where: { ...paidOrder, createdAt: { gte: daysAgo(30) } },
      _sum: { finalAmount: true },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        publicId: true,
        reference: true,
        bundleNameSnapshot: true,
        networkNameSnapshot: true,
        finalAmount: true,
        status: true,
        createdAt: true,
        customer: { select: { name: true, email: true } },
      },
    }),
  ]);

  const totalRevenue = revenueAll._sum.finalAmount ?? 0;
  const totalCost = revenueAll._sum.costPriceSnapshot ?? 0;

  return ok({
    customers: { total: totalCustomers, active: activeCustomers, suspended: suspendedCustomers },
    orders: {
      total: totalOrders,
      today: todayOrders,
      successful: successfulOrders,
      pending: pendingOrders,
      failed: failedOrders,
    },
    catalog: { activeBundles, activeNetworks },
    fulfillment: { pending: pendingFulfillments, failed: failedFulfillments },
    revenue: {
      total: totalRevenue,
      today: revenueToday._sum.finalAmount ?? 0,
      week: revenueWeek._sum.finalAmount ?? 0,
      month: revenueMonth._sum.finalAmount ?? 0,
      cost: totalCost,
      grossProfit: totalRevenue - totalCost,
    },
    recentOrders,
  });
});
