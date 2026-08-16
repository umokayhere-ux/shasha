import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handler, ok, ApiError, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { verifyAndSettle } from "@/lib/services/orders";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ reference: z.string().min(6).max(64) });

/**
 * Called after the customer returns from Paystack. The redirect itself proves
 * nothing — this always re-asks the provider before anything is marked paid.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  rateLimit(`verify:${user.id}`, 30, 5 * 60 * 1000);

  const { reference } = await parseBody(req, schema);

  const order = await prisma.order.findUnique({
    where: { reference },
    select: { customerId: true },
  });
  if (!order) throw new ApiError("Order not found", 404);

  const isAdmin = user.role === Role.SUPER_ADMIN || user.role === Role.STAFF;
  if (order.customerId !== user.id && !isAdmin) throw new ApiError("Order not found", 404);

  const result = await verifyAndSettle(reference);

  return ok({
    paid: result.paid,
    paymentStatus: result.order?.paymentStatus ?? null,
    fulfillmentStatus: result.order?.fulfillmentStatus ?? null,
    orderId: result.order?.publicId ?? null,
  });
});
