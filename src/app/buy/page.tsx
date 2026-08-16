import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BuyFlow } from "./BuyFlow";
import { NOT_DELETED } from "@/lib/not-deleted";

export const dynamic = "force-dynamic";

export default async function BuyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const networks = await prisma.network.findMany({
    where: { isActive: true, ...NOT_DELETED },
    orderBy: { displayOrder: "asc" },
    select: {
      publicId: true,
      name: true,
      slug: true,
      logoUrl: true,
      bundles: {
        where: { isActive: true, ...NOT_DELETED },
        orderBy: [{ displayOrder: "asc" }, { sellingPrice: "asc" }],
        // Cost price is intentionally excluded from anything customer-facing.
        select: {
          publicId: true,
          name: true,
          sellingPrice: true,
          dataAmount: true,
        },
      },
    },
  });

  return <BuyFlow networks={networks} />;
}
