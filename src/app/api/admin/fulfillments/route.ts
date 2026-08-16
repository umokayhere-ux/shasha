import { z } from "zod";
import { FulfillmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handler, ok, parseBody, parsePagination, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { scheduleRetry, runFulfillment } from "@/lib/fulfillment";
import { recordAudit } from "@/lib/audit";
import { runInBackground } from "@/lib/background";

export const GET = handler(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const { page, pageSize, skip, take } = parsePagination(url);
  const status = url.searchParams.get("status");

  const where = status ? { status: status as FulfillmentStatus } : {};
  const [fulfillments, total] = await Promise.all([
    prisma.fulfillment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        order: {
          select: {
            publicId: true,
            reference: true,
            recipientPhone: true,
            bundleNameSnapshot: true,
            paymentStatus: true,
          },
        },
      },
    }),
    prisma.fulfillment.count({ where }),
  ]);

  return ok({ fulfillments, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
});

const retrySchema = z.object({ fulfillmentId: z.string().uuid() });

// Manual retry. Still goes through scheduleRetry, which checks provider state
// first so an already-delivered bundle is never sent twice.
export const POST = handler(async (req: Request) => {
  const admin = await requireAdmin();
  const { fulfillmentId } = await parseBody(req, retrySchema);

  const fulfillment = await prisma.fulfillment.findUnique({ where: { publicId: fulfillmentId } });
  if (!fulfillment) throw new ApiError("Fulfillment not found", 404);

  const queued = await scheduleRetry(fulfillment.id);
  if (!queued) {
    throw new ApiError(
      "This delivery cannot be retried — it is not in a failed state, has exhausted retries, or may already have been delivered.",
      409,
    );
  }

  await recordAudit({
    actorId: admin.id,
    action: "FULFILLMENT_RETRIED",
    resourceType: "Fulfillment",
    resourceId: fulfillment.id,
  });

  runInBackground("fulfillment-retry", () => runFulfillment(fulfillment.id));
  return ok({ queued: true });
});
