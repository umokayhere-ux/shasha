import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handler, ok, parsePagination } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const GET = handler(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const { page, pageSize, skip, take } = parsePagination(url);
  const search = url.searchParams.get("q")?.trim();

  const where: Prisma.UserWhereInput = {
    role: Role.CUSTOMER,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
          ],
        }
      : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      // passwordHash is never selected.
      select: {
        publicId: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        wallet: { select: { balance: true } },
        _count: { select: { orders: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return ok({ customers, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
});
