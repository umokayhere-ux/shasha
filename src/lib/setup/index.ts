import { Role } from "@prisma/client";
import { prisma } from "../db";
import { hashPassword } from "../crypto";
import { createIndexes, type IndexResult } from "./indexes";

/**
 * One-time provisioning, callable from the browser because the Prisma CLI is
 * not available on a serverless host. Guarded by CRON_SECRET and refuses to run
 * once a Super Admin exists, so it cannot be replayed to mint a second owner.
 */

const NETWORKS = [
  { name: "MTN", slug: "mtn", displayOrder: 1 },
  { name: "Telecel", slug: "telecel", displayOrder: 2 },
  { name: "AirtelTigo", slug: "airteltigo", displayOrder: 3 },
];

// [label, megabytes, selling (pesewas), cost (pesewas)] — placeholder pricing.
const BUNDLES: Array<[string, number, number, number]> = [
  ["500MB", 500, 400, 320],
  ["1GB", 1024, 600, 480],
  ["2GB", 2048, 1100, 900],
  ["3GB", 3072, 1600, 1320],
  ["5GB", 5120, 2500, 2100],
  ["10GB", 10240, 4800, 4100],
];

const SETTINGS: Array<[string, unknown]> = [
  ["business_name", process.env.BUSINESS_NAME ?? "Shasha"],
  ["currency", process.env.CURRENCY ?? "GHS"],
  ["registration_enabled", true],
  ["maintenance_mode", false],
  ["min_purchase", 100],
  ["max_purchase", 100_000],
];

export interface SetupResult {
  indexes: IndexResult;
  networks: number;
  bundles: number;
  adminCreated: boolean;
  adminEmail: string;
}

export async function alreadyProvisioned(): Promise<boolean> {
  const admins = await prisma.user.count({ where: { role: Role.SUPER_ADMIN } });
  return admins > 0;
}

export async function runSetup(admin: {
  email: string;
  password: string;
  name: string;
}): Promise<SetupResult> {
  // Indexes first: seeding before the unique constraints exist could write the
  // very duplicates those constraints are meant to reject.
  const indexes = await createIndexes();

  for (const [key, value] of SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: value as object },
      update: {},
    });
  }

  for (const network of NETWORKS) {
    const record = await prisma.network.upsert({
      where: { slug: network.slug },
      create: network,
      update: {},
    });

    for (const [index, [name, mb, selling, cost]] of BUNDLES.entries()) {
      await prisma.bundle.upsert({
        where: { networkId_name: { networkId: record.id, name } },
        create: {
          networkId: record.id,
          name,
          dataAmount: mb,
          dataUnit: "MB",
          sellingPrice: selling,
          costPrice: cost,
          validityDays: 30,
          providerCode: `MOCK-${network.slug.toUpperCase()}-${name}`,
          isFeatured: name === "1GB" || name === "5GB",
          displayOrder: index,
        },
        update: {},
      });
    }
  }

  const email = admin.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: Role.SUPER_ADMIN, status: "ACTIVE" },
    });
  } else {
    await prisma.user.create({
      data: {
        email,
        name: admin.name,
        passwordHash: await hashPassword(admin.password),
        role: Role.SUPER_ADMIN,
        emailVerified: new Date(),
        wallet: { create: {} },
      },
    });
  }

  const [networks, bundles] = await Promise.all([
    prisma.network.count(),
    prisma.bundle.count(),
  ]);

  return { indexes, networks, bundles, adminCreated: !existing, adminEmail: email };
}
