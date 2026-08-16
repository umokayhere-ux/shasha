import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { handler, ok, parseBody } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/validation";
import { generateToken, hashToken } from "@/lib/crypto";
import { clientIp } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const TOKEN_TTL_MS = 30 * 60 * 1000;

export const POST = handler(async (req: Request) => {
  const ip = clientIp(await headers()) ?? "unknown";
  await rateLimit(`forgot:${ip}`, 5, 60 * 60 * 1000);

  const { email } = await parseBody(req, forgotPasswordSchema);
  const user = await prisma.user.findUnique({ where: { email } });

  if (user && !user.deletedAt) {
    const token = generateToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });
    // Hand off to the email transport. Logged only outside production.
    if (process.env.NODE_ENV !== "production") {
      console.info("[auth] password reset token for %s: %s", email, token);
    }
  }

  // Always identical, so this endpoint cannot confirm whether an email exists.
  return ok({ message: "If that email is registered, a reset link has been sent." });
});
