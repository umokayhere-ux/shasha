import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handler, ok, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ publicId: string }> }) => {
    const user = await requireUser();
    const { publicId } = await ctx.params;

    const order = await prisma.order.findUnique({
      where: { publicId },
      include: {
        fulfillment: { select: { status: true, retryCount: true, completedAt: true } },
        payments: {
          select: { status: true, channel: true, providerReference: true, verifiedAt: true },
        },
      },
    });
    if (!order) throw new ApiError("Order not found", 404);

    // Ownership check happens server-side on every read.
    const isAdmin = user.role === Role.SUPER_ADMIN || user.role === Role.STAFF;
    if (order.customerId !== user.id && !isAdmin) throw new ApiError("Order not found", 404);

    return ok({ order });
  },
);
