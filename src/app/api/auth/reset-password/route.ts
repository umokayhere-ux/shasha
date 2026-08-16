import { prisma } from "@/lib/db";
import { handler, ok, ApiError, parseBody } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validation";
import { hashPassword, hashToken } from "@/lib/crypto";
import { revokeAllSessions } from "@/lib/auth";

export const POST = handler(async (req: Request) => {
  const { token, password } = await parseBody(req, resetPasswordSchema);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new ApiError("This reset link is invalid or has expired.", 422);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await hashPassword(password),
        failedLogins: 0,
        lockedUntil: null,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  // Any session opened with the old password is no longer trusted.
  await revokeAllSessions(record.userId);
  return ok({ message: "Your password has been reset. Please sign in." });
});
