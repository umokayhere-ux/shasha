import { cookies, headers } from "next/headers";
import { Role, UserStatus, type User } from "@prisma/client";
import { prisma } from "./db";
import { generateToken, hashToken, hashPassword, verifyPassword } from "./crypto";

export const SESSION_COOKIE = "shasha_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 1000 * 60 * 15;

export type SessionUser = Pick<User, "id" | "publicId" | "email" | "name" | "role" | "status">;

export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const hdrs = await headers();
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      userAgent: hdrs.get("user-agent")?.slice(0, 255) ?? null,
      ip: clientIp(hdrs),
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return token;
}

/**
 * Resolves the caller from the session cookie. The role always comes from the
 * database row — a role claim from the client is never trusted anywhere.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (session.user.status !== UserStatus.ACTIVE || session.user.deletedAt) return null;

  const { id, publicId, email, name, role, status } = session.user;
  return { id, publicId, email, name, role, status };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  store.delete(SESSION_COOKIE);
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export class AuthError extends Error {}

/**
 * Verifies credentials with lockout on repeated failures. The same generic
 * message is returned for unknown emails and wrong passwords so the endpoint
 * cannot be used to enumerate accounts.
 */
export async function authenticate(email: string, password: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.deletedAt) {
    // Equalize timing against the hash comparison on the success path.
    await hashPassword(password);
    throw new AuthError("Invalid email or password");
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AuthError("Account temporarily locked. Try again later.");
  }
  if (user.status !== UserStatus.ACTIVE) {
    throw new AuthError("This account is suspended. Contact support.");
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: failed,
        lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MS) : null,
      },
    });
    throw new AuthError("Invalid email or password");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  return user;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Authentication required");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== Role.SUPER_ADMIN && user.role !== Role.STAFF) {
    throw new AuthError("Forbidden");
  }
  return user;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== Role.SUPER_ADMIN) throw new AuthError("Forbidden");
  return user;
}

export function clientIp(hdrs: Headers): string | null {
  const fwd = hdrs.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return hdrs.get("x-real-ip");
}
