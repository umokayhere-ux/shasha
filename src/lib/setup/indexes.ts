import { prisma } from "../db";

/**
 * Creates the unique indexes that `prisma db push` would normally create.
 *
 * The Prisma CLI is a devDependency and is not present in a serverless bundle,
 * so `db push` cannot run on the host. These indexes are not cosmetic — they
 * are the enforcement behind the duplicate-payment and duplicate-delivery
 * guarantees, so an install that skips them looks fine until it double-charges
 * or double-delivers under a webhook retry.
 *
 * Optional unique fields use `sparse`, because MongoDB otherwise treats every
 * document missing the field as a duplicate null and rejects the second insert.
 *
 * createIndexes is idempotent for identical specs, so this is safe to re-run.
 */

interface IndexSpec {
  collection: string;
  name: string;
  key: Record<string, 1 | -1>;
  unique?: boolean;
  sparse?: boolean;
}

const INDEXES: IndexSpec[] = [
  // --- Correctness-critical: these enforce idempotency ---
  { collection: "PaymentWebhookEvent", name: "uq_webhook_event", key: { provider: 1, eventSignature: 1 }, unique: true },
  { collection: "Fulfillment", name: "uq_fulfillment_order", key: { orderId: 1 }, unique: true },
  { collection: "Fulfillment", name: "uq_fulfillment_idem", key: { idempotencyKey: 1 }, unique: true },
  { collection: "Order", name: "uq_order_reference", key: { reference: 1 }, unique: true },
  { collection: "Payment", name: "uq_payment_reference", key: { providerReference: 1 }, unique: true },
  { collection: "Payment", name: "uq_payment_txn", key: { providerTransactionId: 1 }, unique: true, sparse: true },
  { collection: "WalletTransaction", name: "uq_wallet_txn_ref", key: { reference: 1 }, unique: true },
  { collection: "PromotionUsage", name: "uq_promo_usage", key: { promotionId: 1, orderId: 1 }, unique: true },

  // --- Identity and catalog ---
  { collection: "User", name: "uq_user_email", key: { email: 1 }, unique: true },
  { collection: "User", name: "uq_user_phone", key: { phone: 1 }, unique: true, sparse: true },
  { collection: "User", name: "uq_user_public", key: { publicId: 1 }, unique: true },
  { collection: "Session", name: "uq_session_token", key: { tokenHash: 1 }, unique: true },
  { collection: "PasswordResetToken", name: "uq_reset_token", key: { tokenHash: 1 }, unique: true },
  { collection: "Wallet", name: "uq_wallet_user", key: { userId: 1 }, unique: true },
  { collection: "Network", name: "uq_network_name", key: { name: 1 }, unique: true },
  { collection: "Network", name: "uq_network_slug", key: { slug: 1 }, unique: true },
  { collection: "Network", name: "uq_network_public", key: { publicId: 1 }, unique: true },
  { collection: "Bundle", name: "uq_bundle_network_name", key: { networkId: 1, name: 1 }, unique: true },
  { collection: "Bundle", name: "uq_bundle_public", key: { publicId: 1 }, unique: true },
  { collection: "Order", name: "uq_order_public", key: { publicId: 1 }, unique: true },
  { collection: "Payment", name: "uq_payment_public", key: { publicId: 1 }, unique: true },
  { collection: "Promotion", name: "uq_promotion_code", key: { code: 1 }, unique: true },
  { collection: "PaystackSubaccount", name: "uq_subaccount_code", key: { subaccountCode: 1 }, unique: true },
  { collection: "PaymentSplitConfiguration", name: "uq_split_name", key: { name: 1 }, unique: true },

  // --- Query performance ---
  { collection: "Order", name: "ix_order_customer", key: { customerId: 1, createdAt: -1 } },
  { collection: "Order", name: "ix_order_created", key: { createdAt: -1 } },
  { collection: "Bundle", name: "ix_bundle_network_active", key: { networkId: 1, isActive: 1, displayOrder: 1 } },
  { collection: "Fulfillment", name: "ix_fulfillment_status", key: { status: 1, createdAt: 1 } },
  { collection: "Session", name: "ix_session_expiry", key: { expiresAt: 1 } },
  { collection: "RateLimit", name: "ix_ratelimit_reset", key: { resetAt: 1 } },
];

export interface IndexResult {
  created: number;
  failed: Array<{ index: string; reason: string }>;
}

export async function createIndexes(): Promise<IndexResult> {
  const byCollection = new Map<string, IndexSpec[]>();
  for (const spec of INDEXES) {
    const list = byCollection.get(spec.collection) ?? [];
    list.push(spec);
    byCollection.set(spec.collection, list);
  }

  let created = 0;
  const failed: Array<{ index: string; reason: string }> = [];

  for (const [collection, specs] of byCollection) {
    try {
      await prisma.$runCommandRaw({
        createIndexes: collection,
        indexes: specs.map((s) => ({
          key: s.key,
          name: s.name,
          ...(s.unique ? { unique: true } : {}),
          ...(s.sparse ? { sparse: true } : {}),
        })),
      });
      created += specs.length;
    } catch (err) {
      // A pre-existing index with different options, or duplicate data already
      // violating a new unique constraint. Both need a human, so report per
      // collection instead of aborting the whole run.
      const reason = err instanceof Error ? err.message.slice(0, 200) : "unknown error";
      failed.push({ index: collection, reason });
      console.error("[setup] index creation failed for %s", collection, err);
    }
  }

  return { created, failed };
}
