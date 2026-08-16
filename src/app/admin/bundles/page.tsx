import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { BundleManager } from "./BundleManager";
import { NOT_DELETED } from "@/lib/not-deleted";

export const dynamic = "force-dynamic";

export default async function AdminBundlesPage() {
  const [bundles, networks] = await Promise.all([
    prisma.bundle.findMany({
      where: NOT_DELETED,
      orderBy: [{ network: { displayOrder: "asc" } }, { displayOrder: "asc" }],
      include: { network: { select: { publicId: true, name: true } } },
    }),
    prisma.network.findMany({
      where: NOT_DELETED,
      orderBy: { displayOrder: "asc" },
      select: { publicId: true, name: true },
    }),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Data bundles</h1>
      <p className="muted mb-6 text-sm">
        Prices apply to new orders only. Existing orders keep the amount the customer actually paid.
      </p>
      <BundleManager
        networks={networks}
        bundles={bundles.map((b) => ({
          publicId: b.publicId,
          name: b.name,
          networkName: b.network.name,
          networkId: b.network.publicId,
          sellingPrice: b.sellingPrice,
          costPrice: b.costPrice,
          margin: b.sellingPrice - b.costPrice,
          sellingPriceLabel: formatMoney(b.sellingPrice),
          costPriceLabel: formatMoney(b.costPrice),
          marginLabel: formatMoney(b.sellingPrice - b.costPrice),
          validityDays: b.validityDays,
          isActive: b.isActive,
        }))}
      />
    </div>
  );
}
