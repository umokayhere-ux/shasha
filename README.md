# Shasha — Data Bundle Sales Platform

A production-oriented platform for selling mobile data bundles, with a Super
Admin-controlled catalog, Paystack payments (including subaccount split
settlement), and a queued data-fulfillment pipeline.

**Stack:** Next.js 15 (App Router) · TypeScript · Prisma · MongoDB · Tailwind CSS

---

## Why these choices

| Area | Choice | Reason |
|---|---|---|
| Framework | Next.js App Router | One codebase for the storefront, admin, and API. Server Components keep prices, secrets, and role checks on the server. |
| Data layer | Prisma + MongoDB | Typed access with unique indexes, which is what enforces the idempotency guarantees below. |
| Money | `Int` minor units (pesewas) | Integer arithmetic only — no floating-point currency drift. |
| Auth | Opaque session cookie + scrypt | `node:crypto` only, so there is no native build step and no plaintext password anywhere. |
| Payments | `PaymentProvider` interface | Paystack lives behind an interface, so a second provider can be added without touching order logic. |
| Fulfillment | `DataProvider` interface + mock | The whole app is testable before a real reseller API exists. |

---

## Requirements

- Node.js 20+
- **MongoDB running as a replica set**

> ### ⚠️ The replica set is not optional
> Wallet debits and order+promotion writes run inside `prisma.$transaction`, and
> MongoDB only supports multi-document transactions on a replica set.
> **MongoDB Atlas provides this by default.** A standalone local `mongod` does
> not — start it with `mongod --replSet rs0` and run `rs.initiate()` once, or use
> Atlas / `docker run -d -p 27017:27017 mongo:7 --replSet rs0`.

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    Set DATABASE_URL and generate a secret:
#    openssl rand -base64 48   ->   AUTH_SECRET

# 3. Push the schema (MongoDB has no migrations; this creates the indexes)
npm run db:push

# 4. Seed development data — FICTIONAL test bundles, not a real telecom API
npm run db:seed

# 5. Create the first Super Admin (credentials come from the environment)
SUPER_ADMIN_EMAIL=you@example.com \
SUPER_ADMIN_PASSWORD='a-long-strong-password' \
npm run admin:create

# 6. Run
npm run dev
```

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm test` | Vitest suite |
| `npm run typecheck` | TypeScript, no emit |
| `npm run db:push` | Apply schema + indexes to MongoDB |
| `npm run db:seed` | Development seed data |
| `npm run admin:create` | Create/promote the Super Admin |

`npm run db:push` is what creates the unique indexes. **Run it before accepting
real traffic** — without those indexes the duplicate protections below do not
hold.

---

## Environment variables

| Variable | Notes |
|---|---|
| `DATABASE_URL` | MongoDB connection string (replica set). |
| `AUTH_SECRET` | ≥32 chars. Keys session/reset token hashing. Rotating it logs everyone out. |
| `APP_URL` | Public base URL; used to build the Paystack callback. |
| `PAYSTACK_SECRET_KEY` | **Server-side only.** Never prefix with `NEXT_PUBLIC_`. |
| `PAYSTACK_PUBLIC_KEY` | Safe for the browser. |
| `DATA_PROVIDER_API_URL` / `_KEY` | Reseller credentials. Server-side only. |
| `BUSINESS_NAME`, `SUPPORT_EMAIL`, `CURRENCY` | Branding and currency display. |
| `EMAIL_ENABLED` | `true` once an email transport is wired in. |

No secret is ever read from the database or sent to the client.

---

## Payment flow

```
Customer picks a bundle
  -> server re-reads the price from the DB (the client never sends an amount)
  -> PENDING order created with a full price/bundle snapshot
  -> Paystack transaction initialized server-side, with split config if configured
  -> customer pays
  -> redirect back  ──┐
  -> webhook arrives ─┴─> both land in verifyAndSettle(), which re-verifies
                          with Paystack before anything is marked PAID
  -> exactly one fulfillment is queued
  -> data provider called -> order updated -> customer notified
```

### How each guarantee is enforced

| Rule | Mechanism |
|---|---|
| Frontend price is never trusted | `createOrder()` reads `sellingPrice` from the DB; the request schema has no amount field. |
| Redirect is never proof of payment | The callback page and `/api/payments/verify` both call `verifyTransaction()` against Paystack. |
| No data before verified payment | `enqueueFulfillment()` refuses any order not in `PAID`. |
| No duplicate fulfillment | Unique index on `Fulfillment.orderId` + `idempotencyKey`, plus a conditional claim in `runFulfillment()`. |
| No duplicate webhook processing | Unique index on `(provider, eventSignature)`; a redelivery hits it and returns `200 {duplicate:true}`. |
| Payment ≠ fulfillment | Separate `paymentStatus` / `fulfillmentStatus` fields. A delivery failure never un-pays a payment. |
| Historical prices never move | Orders store a price snapshot; reports aggregate the snapshots, never live bundle prices. |
| Underpayment rejected | `verifyAndSettle()` compares the captured amount and currency to the order. |

### Webhook setup

Point Paystack at `https://<your-domain>/api/webhooks/paystack`.

Authenticity is verified as HMAC-SHA512 of the **raw** request body keyed by the
secret key, compared in constant time. Do not add any body-parsing middleware in
front of that route — re-serializing the body invalidates the digest.

### Paystack subaccounts and splits

Subaccounts are **settlement destinations owned by the platform — never customer
accounts**, and are not linked to any `User`. Split configuration is resolved
server-side in `resolveSplitConfiguration()`; subaccount codes and percentages
are never accepted from the browser. A split config pointing at an inactive
subaccount falls back to platform-only settlement rather than failing the sale.
Only the last 4 digits of a bank account number are ever stored.

---

## Data provider integration

`MockDataProvider` ships as the default and **delivers nothing real**. Its
behavior is driven by the recipient number so every branch is reproducible:

| Number ends in | Result |
|---|---|
| `0000` | Permanent failure |
| `1111` | Delayed (`PROCESSING`) |
| `2222` | Transient failure (retryable) |
| anything else | Success |

To connect a real provider, implement the `DataProvider` interface in
`src/lib/fulfillment/provider.ts` and register it via `setDataProvider()`. Your
`purchaseBundle()` **must honor `idempotencyKey`** — it is the last line of
defense against double-delivery. Only report `retryable: true` when you are
certain no delivery occurred; `scheduleRetry()` re-checks provider status before
retrying anything that has a reference.

Queued jobs run in-process. For production, drain the queue from a worker:

```ts
import { processQueue } from "@/lib/fulfillment";
setInterval(() => processQueue(), 30_000);
```

---

## Verification status

Verified live against a running server and database:

- Registration, login, session cookies, lockout
- Authorization: unauthenticated → 401, customer hitting admin API → 403
- Cost prices absent from all customer-facing responses
- **A forged price in the request body was ignored** — the server charged the real amount
- Wallet purchase settled and fulfilled end to end
- **Admin price change 6.00 → 9.50 left the existing order at 6.00**, new order at 9.50, with price history recorded
- Webhook: unsigned, forged-signature, and tampered-body requests all rejected 401
- 30 unit tests, typecheck, and production build all pass

**Not verified live, and needing a check before production:**

1. **The MongoDB data layer has not been exercised against a live database.**
   The end-to-end runs above were done on PostgreSQL before the switch to
   MongoDB; since then the schema and build are validated but no query has hit a
   real MongoDB. Run `db:push`, `db:seed`, and one end-to-end purchase against
   your Atlas cluster before trusting it.
2. **The Paystack adapter was written without access to the live docs** —
   `paystack.com` is blocked from the build network. Endpoints, field names, and
   the signature scheme follow the documented API shape but were not diffed
   against current documentation. Verify `src/lib/payments/paystack.ts` against
   <https://paystack.com/docs/api/> before going live. Every shape-sensitive
   detail is confined to that one file.
3. Real payment and settlement behavior needs a test-mode transaction.

---

## Deployment

1. Provision MongoDB Atlas (replica set) and allowlist the app's egress IPs.
2. Set all environment variables on the host; never commit `.env`.
3. `npm run db:push` against production.
4. `npm run admin:create` once, then unset the admin env vars.
5. `npm run build && npm start` behind HTTPS (secure cookies require it).
6. Register the webhook URL in the Paystack dashboard.
7. Run a worker process calling `processQueue()`.

Security headers (HSTS, `X-Frame-Options`, `nosniff`, Referrer-Policy) are set in
`next.config.ts`. Rate limiting is in-memory and per-process — move it to Redis
before running more than one instance.

---

## Project layout

```
prisma/schema.prisma        Data model, unique indexes, seed
src/lib/payments/           PaymentProvider interface + Paystack adapter
src/lib/fulfillment/        DataProvider interface + mock + queue/retry logic
src/lib/services/orders.ts  Pricing, snapshots, verification, wallet debit
src/app/api/                REST endpoints (customer, admin, webhook)
src/app/admin/              Admin console (role-gated in layout.tsx)
tests/                      Vitest suites
```
