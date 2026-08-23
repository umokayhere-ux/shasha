import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handler, ok, parsePagination } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { NOT_DELETED } from "@/lib/not-deleted";

export const GET = handler(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const { page, pageSize, skip, take } = parsePagination(url);
  const search = url.searchParams.get("q")?.trim();

  // NOT_DELETED and the search filter both use OR, so they are combined under
  // AND rather than spread into the same object, where one would overwrite the
  // other and quietly widen the result set.
  const where: Prisma.UserWhereInput = {
    role: Role.CUSTOMER,
    AND: [
      NOT_DELETED,
      ...(search
        ? [
            {
              OR: [
                { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
                { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
                { phone: { contains: search } },
              ],
            },
          ]
        : []),
    ],
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
