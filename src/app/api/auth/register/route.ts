import { headers } from "next/headers";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handler, ok, fail, parseBody, ApiError } from "@/lib/api";
import { registerSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/crypto";
import { createSession, clientIp } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const POST = handler(async (req: Request) => {
  const ip = clientIp(await headers()) ?? "unknown";
  rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);

  const setting = await prisma.systemSetting.findUnique({ where: { key: "registration_enabled" } });
  if (setting?.value === false) {
    throw new ApiError("Registration is currently closed.", 403);
  }

  const input = await parseBody(req, registerSchema);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { phone: input.phone }] },
    select: { id: true },
  });
  if (existing) {
    return fail("An account with those details already exists.", 409);
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      // Role is fixed server-side; a client cannot request elevated access.
      role: Role.CUSTOMER,
      wallet: { create: {} },
    },
  });

  await createSession(user.id);
  return ok({ id: user.publicId, name: user.name, email: user.email, role: user.role }, 201);
});
