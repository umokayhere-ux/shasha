/**
 * Creates the initial Super Admin. No credentials are hard-coded anywhere:
 * both values must be supplied through the environment.
 *
 *   SUPER_ADMIN_EMAIL=you@example.com SUPER_ADMIN_PASSWORD='…' npm run admin:create
 *
 * Re-running promotes an existing user to SUPER_ADMIN without touching their
 * password, so it is safe to use for recovery.
 */
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/lib/crypto";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME ?? "Super Admin";

  if (!email || !password) {
    throw new Error("SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must both be set.");
  }
  if (password.length < 12) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 12 characters.");
  }
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters before creating an admin.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: Role.SUPER_ADMIN, status: "ACTIVE" },
    });
    console.log(`Promoted existing user ${email} to SUPER_ADMIN.`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(password),
      role: Role.SUPER_ADMIN,
      emailVerified: new Date(),
      wallet: { create: {} },
    },
  });
  console.log(`Created Super Admin ${email}.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
