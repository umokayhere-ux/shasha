import { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handler, ok, parsePagination, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createOrderSchema } from "@/lib/validation";
import { createOrder, initializePayment, payFromWallet } from "@/lib/services/orders";
import { rateLimit } from "@/lib/rate-limit";

export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const { page, pageSize, skip, take } = parsePagination(url);

  // Scoped to the caller — a customer can never read another customer's orders.
  const where = { customerId: user.id };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        publicId: true,
        reference: true,
        networkNameSnapshot: true,
        bundleNameSnapshot: true,
        recipientPhone: true,
        finalAmount: true,
        currency: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.order.count({ where }),
  ]);

  return ok({ orders, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
});

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  rateLimit(`order:${user.id}`, 20, 10 * 60 * 1000);

  const input = await parseBody(req, createOrderSchema);

  const order = await createOrder({
    customerId: user.id,
    bundlePublicId: input.bundleId,
    recipientPhone: input.recipientPhone,
    promoCode: input.promoCode,
    paymentMethod: input.paymentMethod as PaymentMethod,
  });

  if (input.paymentMethod === "WALLET") {
    await payFromWallet(order);
    return ok({ order: { publicId: order.publicId, reference: order.reference }, paid: true }, 201);
  }

  const checkout = await initializePayment(order, user.email);
  return ok(
    {
      order: {
        publicId: order.publicId,
        reference: order.reference,
        finalAmount: order.finalAmount,
        currency: order.currency,
      },
      authorizationUrl: checkout.authorizationUrl,
    },
    201,
  );
});
