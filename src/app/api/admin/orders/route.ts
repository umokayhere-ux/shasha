import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handler, ok, parsePagination } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const GET = handler(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const { page, pageSize, skip, take } = parsePagination(url);

  const search = url.searchParams.get("q")?.trim();
  const paymentStatus = url.searchParams.get("paymentStatus");
  const fulfillmentStatus = url.searchParams.get("fulfillmentStatus");
  const networkId = url.searchParams.get("networkId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: Prisma.OrderWhereInput = {
    ...(paymentStatus ? { paymentStatus: paymentStatus as never } : {}),
    ...(fulfillmentStatus ? { fulfillmentStatus: fulfillmentStatus as never } : {}),
    ...(networkId ? { network: { publicId: networkId } } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { reference: { contains: search, mode: "insensitive" } },
            { recipientPhone: { contains: search } },
            { customer: { email: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        customer: { select: { publicId: true, name: true, email: true } },
        fulfillment: { select: { status: true, retryCount: true, lastError: true } },
        payments: { select: { providerReference: true, channel: true, subaccountCode: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return ok({ orders, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
});
