/**
 * Soft-delete filter that works on MongoDB.
 *
 * Prisma omits optional fields that were never set, so a freshly seeded row has
 * no `deletedAt` key at all — which is not the same as an explicit null. Match
 * both, otherwise live records can silently disappear from listings.
 */
export const NOT_DELETED = {
  OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
};
