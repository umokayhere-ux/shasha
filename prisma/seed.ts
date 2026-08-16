/**
 * Development seed data. These are FICTIONAL test bundles and prices — they are
 * not connected to any real telecom or reseller API. Do not run against a
 * production database.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NETWORKS = [
  { name: "MTN", slug: "mtn", displayOrder: 1 },
  { name: "Telecel", slug: "telecel", displayOrder: 2 },
  { name: "AirtelTigo", slug: "airteltigo", displayOrder: 3 },
];

// [label, megabytes, selling (pesewas), cost (pesewas)]
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

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
    throw new Error("Refusing to seed a production database. Set ALLOW_PROD_SEED=true to override.");
  }

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
      update: { name: network.name, displayOrder: network.displayOrder },
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

  const networks = await prisma.network.count();
  const bundles = await prisma.bundle.count();
  console.log(`Seeded ${networks} networks and ${bundles} bundles (test data).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
