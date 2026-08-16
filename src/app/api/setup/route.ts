import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { handler, ok, ApiError, parseBody } from "@/lib/api";
import { emailSchema, passwordSchema } from "@/lib/validation";
import { alreadyProvisioned, runSetup } from "@/lib/setup";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  token: z.string().min(8),
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(2).max(80).default("Super Admin"),
});

export const POST = handler(async (req: Request) => {
  const input = await parseBody(req, schema);

  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ApiError("Setup is not available.", 503);

  // Constant-time compare so the token cannot be guessed byte by byte.
  const a = Buffer.from(input.token);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ApiError("Invalid setup token.", 401);
  }

  // One-shot: once an owner exists this endpoint is permanently inert, so a
  // leaked token cannot be replayed to mint a second Super Admin.
  if (await alreadyProvisioned()) {
    throw new ApiError(
      "Setup has already been completed. Use the password reset flow if you are locked out.",
      409,
    );
  }

  const result = await runSetup({
    email: input.email,
    password: input.password,
    name: input.name,
  });

  await recordAudit({
    action: "SETUP_COMPLETED",
    resourceType: "System",
    newValues: {
      adminEmail: result.adminEmail,
      networks: result.networks,
      bundles: result.bundles,
      indexesCreated: result.indexes.created,
    },
  });

  return ok(result);
});
