import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BuyFlow } from "./BuyFlow";

export const dynamic = "force-dynamic";

export default async function BuyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const networks = await prisma.network.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { displayOrder: "asc" },
    select: {
      publicId: true,
      name: true,
      slug: true,
      bundles: {
        where: { isActive: true, deletedAt: null },
        orderBy: [{ displayOrder: "asc" }, { sellingPrice: "asc" }],
        // Cost price is intentionally excluded from anything customer-facing.
        select: {
          publicId: true,
          name: true,
          sellingPrice: true,
          validityDays: true,
          dataAmount: true,
        },
      },
    },
  });

  return <BuyFlow networks={networks} />;
}
