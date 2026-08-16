import { headers } from "next/headers";
import { prisma } from "./db";
import { clientIp } from "./auth";
import type { Prisma } from "@prisma/client";

const SENSITIVE_KEYS = [
  "password",
  "passwordHash",
  "secret",
  "secretKey",
  "apiKey",
  "token",
  "accountNumber",
];

/** Redacts credential-like fields before anything reaches the audit table. */
export function maskSensitive(value: unknown): Prisma.InputJsonValue {
  if (value === null || value === undefined) return {};
  if (Array.isArray(value)) return value.map(maskSensitive) as Prisma.InputJsonValue;
  if (typeof value !== "object") return value as Prisma.InputJsonValue;

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const isSensitive = SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s.toLowerCase()));
    out[key] = isSensitive ? "***redacted***" : maskSensitive(val);
  }
  return out as Prisma.InputJsonValue;
}

export async function recordAudit(params: {
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
}): Promise<void> {
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    const hdrs = await headers();
    ip = clientIp(hdrs);
    userAgent = hdrs.get("user-agent")?.slice(0, 255) ?? null;
  } catch {
    // Outside a request context (jobs, CLI) — header capture is best-effort.
  }

  // Auditing must never break the operation it is describing.
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        oldValues: params.oldValues ? maskSensitive(params.oldValues) : undefined,
        newValues: params.newValues ? maskSensitive(params.newValues) : undefined,
        ip,
        userAgent,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record", params.action, err);
  }
}
