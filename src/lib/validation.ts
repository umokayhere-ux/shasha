import { z } from "zod";

/** Ghana MSISDN: 0XXXXXXXXX or +233XXXXXXXXX, normalized to local 0-format. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/[\s-]/g, ""))
  .refine((val) => /^(?:\+?233|0)\d{9}$/.test(val), "Enter a valid phone number")
  .transform((val) => (val.startsWith("0") ? val : `0${val.replace(/^\+?233/, "")}`));

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");

/**
 * Customer password policy: 6+ characters containing a number and a symbol.
 *
 * Short by usual standards — the symbol requirement and the login lockout after
 * repeated failures are what carry the weight here. Admin accounts use the
 * stricter rule below, since one of those controls prices and settlement.
 */
export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(128, "Password is too long")
  .refine((v) => /\d/.test(v), "Include at least one number")
  .refine((v) => /[^A-Za-z0-9]/.test(v), "Include at least one symbol, like ! or @");

/** Admin credentials stay long: this account can change prices and payouts. */
export const adminPasswordSchema = z
  .string()
  .min(10, "Admin password must be at least 10 characters")
  .max(128, "Password is too long")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Include at least one letter and one number");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const createOrderSchema = z.object({
  bundleId: z.string().uuid("Select a bundle"),
  recipientPhone: phoneSchema,
  promoCode: z.string().trim().max(32).optional(),
  paymentMethod: z.enum(["PAYSTACK", "WALLET"]).default("PAYSTACK"),
});

const moneyMajor = z
  .number()
  .nonnegative("Amount cannot be negative")
  .max(1_000_000, "Amount is too large");

export const networkSchema = z.object({
  name: z.string().trim().min(2).max(50),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens"),
  logoUrl: z.string().url().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
});

export const bundleSchema = z.object({
  networkId: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  dataAmount: z.number().int().positive("Data amount must be greater than zero"),
  dataUnit: z.enum(["MB", "GB"]).default("MB"),
  sellingPrice: moneyMajor,
  costPrice: moneyMajor,
  validityDays: z.number().int().positive().max(3650).default(30),
  description: z.string().max(500).optional().nullable(),
  providerCode: z.string().max(80).optional().nullable(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  displayOrder: z.number().int().min(0).default(0),
});

export const bundleUpdateSchema = bundleSchema.partial().extend({
  priceChangeReason: z.string().max(200).optional(),
});

export const subaccountSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  businessName: z.string().trim().min(2).max(120),
  settlementBank: z.string().trim().min(2).max(20),
  accountNumber: z.string().trim().regex(/^\d{8,20}$/, "Enter a valid account number"),
  percentageCharge: z.number().min(0).max(100),
});

export const linkSubaccountSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  subaccountCode: z.string().trim().regex(/^ACCT_[A-Za-z0-9]+$/, "Enter a valid subaccount code"),
  businessName: z.string().trim().max(120).optional(),
});

export const splitConfigSchema = z.object({
  name: z.string().trim().min(2).max(60),
  subaccountId: z.string().uuid().optional().nullable(),
  mode: z.enum(["PLATFORM_ONLY", "SUBACCOUNT_SPLIT"]),
  bearer: z.enum(["account", "subaccount"]).default("account"),
  percentageCharge: z.number().min(0).max(100).optional().nullable(),
  transactionCharge: moneyMajor.optional().nullable(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const promotionSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().toUpperCase().min(3).max(32),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.number().positive(),
  minPurchase: moneyMajor.default(0),
  usageLimit: z.number().int().positive().optional().nullable(),
  perCustomerLimit: z.number().int().positive().optional().nullable(),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const walletAdjustmentSchema = z.object({
  userId: z.string().uuid(),
  direction: z.enum(["CREDIT", "DEBIT"]),
  amount: moneyMajor.refine((v) => v > 0, "Amount must be greater than zero"),
  description: z.string().trim().min(3).max(200),
});

/**
 * Network logo: either an https URL or an inline data URI.
 *
 * SVG is deliberately excluded — it can carry script, and these are rendered
 * straight back into pages. The size cap keeps a base64 image from bloating the
 * documents that every catalogue query loads.
 */
export const networkLogoSchema = z.object({
  logoUrl: z
    .string()
    .trim()
    .max(400_000, "That image is too large — use one under about 250KB")
    .refine(
      (v) =>
        v === "" ||
        /^https:\/\/\S+$/i.test(v) ||
        /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
      "Logo must be a PNG, JPEG or WebP image, or an https URL",
    ),
});
