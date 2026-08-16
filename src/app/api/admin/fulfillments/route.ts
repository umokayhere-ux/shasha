import { z } from "zod";
import { FulfillmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handler, ok, parseBody, parsePagination, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { markDelivered, markFailed, requeue } from "@/lib/fulfillment";
import { recordAudit } from "@/lib/audit";

export const GET = handler(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const { page, pageSize, skip, take } = parsePagination(url);
  const status = url.searchParams.get("status");

  const where = status ? { status: status as FulfillmentStatus } : {};
  const [fulfillments, total] = await Promise.all([
    prisma.fulfillment.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip,
      take,
      include: {
        order: {
          select: {
            publicId: true,
            reference: true,
            recipientPhone: true,
            bundleNameSnapshot: true,
            networkNameSnapshot: true,
            finalAmount: true,
            paymentStatus: true,
          },
        },
      },
    }),
    prisma.fulfillment.count({ where }),
  ]);

  return ok({
    fulfillments,
    pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
  });
});

const actionSchema = z.object({
  fulfillmentId: z.string().uuid(),
  action: z.enum(["delivered", "failed", "requeue"]),
  reason: z.string().trim().max(300).optional(),
});

/**
 * Records the outcome of a delivery the operator performed by hand.
 * Marking delivered is idempotent, so a double tap cannot corrupt the record.
 */
export const POST = handler(async (req: Request) => {
  const admin = await requireAdmin();
  const input = await parseBody(req, actionSchema);

  let done = false;
  if (input.action === "delivered") {
    done = await markDelivered(input.fulfillmentId, admin.id);
  } else if (input.action === "failed") {
    done = await markFailed(
      input.fulfillmentId,
      admin.id,
      input.reason || "Could not deliver the bundle",
    );
  } else {
    done = await requeue(input.fulfillmentId);
  }

  if (!done) throw new ApiError("That delivery could not be updated.", 409);

  await recordAudit({
    actorId: admin.id,
    action: `FULFILLMENT_${input.action.toUpperCase()}`,
    resourceType: "Fulfillment",
    resourceId: input.fulfillmentId,
    newValues: { action: input.action, reason: input.reason ?? null },
  });

  return ok({ updated: true });
});
