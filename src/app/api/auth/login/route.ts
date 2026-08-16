import { headers } from "next/headers";
import { handler, ok, parseBody } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { authenticate, createSession, clientIp } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import { Role } from "@prisma/client";

export const POST = handler(async (req: Request) => {
  const ip = clientIp(await headers()) ?? "unknown";
  rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);

  const { email, password } = await parseBody(req, loginSchema);
  const user = await authenticate(email, password);
  await createSession(user.id);

  if (user.role !== Role.CUSTOMER) {
    await recordAudit({
      actorId: user.id,
      action: "ADMIN_LOGIN",
      resourceType: "User",
      resourceId: user.id,
    });
  }

  return ok({ id: user.publicId, name: user.name, email: user.email, role: user.role });
});
