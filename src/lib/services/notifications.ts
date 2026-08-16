import { prisma } from "../db";

export interface NotificationInput {
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

/**
 * Single fan-out point for customer notifications. In-app delivery is written
 * synchronously; email/SMS/WhatsApp channels plug in behind this function.
 */
export async function notify(userId: string, input: NotificationInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        metadata: (input.metadata ?? {}) as object,
      },
    });
  } catch (err) {
    console.error("[notify] failed", input.type, err);
    return;
  }

  await sendEmail(userId, input).catch((err) => console.error("[notify] email failed", err));
}

async function sendEmail(userId: string, input: NotificationInput): Promise<void> {
  if (process.env.EMAIL_ENABLED !== "true") return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return;
  // Wire an email transport here (Resend, SES, Postmark…).
  console.info("[email] would send %s to %s", input.type, user.email);
}
