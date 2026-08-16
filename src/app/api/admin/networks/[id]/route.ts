import { prisma } from "@/lib/db";
import { handler, ok, parseBody, ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { networkLogoSchema } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const PATCH = handler(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const { logoUrl } = await parseBody(req, networkLogoSchema);

    const network = await prisma.network.findUnique({ where: { publicId: id } });
    if (!network) throw new ApiError("Network not found", 404);

    const updated = await prisma.network.update({
      where: { id: network.id },
      data: { logoUrl: logoUrl === "" ? null : logoUrl },
    });

    await recordAudit({
      actorId: admin.id,
      action: logoUrl === "" ? "NETWORK_LOGO_REMOVED" : "NETWORK_LOGO_UPDATED",
      resourceType: "Network",
      resourceId: network.id,
      // The image itself is large and not useful in an audit trail.
      newValues: { name: network.name, hasLogo: logoUrl !== "" },
    });

    return ok({ logoUrl: updated.logoUrl });
  },
);
