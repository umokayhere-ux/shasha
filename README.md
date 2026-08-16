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
| Hosting | Vercel (serverless) | Background work uses `after()` and rate limiting is DB-backed, since instances are frozen after responding and not shared. |
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
| `CRON_SECRET` | Required on Vercel. Authorizes the cron route; without it the route refuses to run. |

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

Delivery runs immediately after the response via `after()`, with the cron route
in `/api/cron/process-fulfillments` as the safety net for jobs whose invocation
died, deliveries still `PROCESSING`, and retryable failures. See the Vercel
section below.

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

1. **The MongoDB data layer and the Vercel-specific paths have not been
   exercised against a live database or a real deployment.**
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

## Deploying to Vercel

The app targets Vercel's serverless model. Three things are load-bearing:

- **Background delivery uses `after()`**, not a floating promise. A serverless
  instance is frozen once the response returns, so `void doWork()` would be
  killed mid-flight — meaning a paid order whose delivery silently never ran.
  See `src/lib/background.ts`.
- **Rate limiting is stored in MongoDB.** Each invocation may be a fresh
  instance, so an in-memory counter never accumulates and brute-force protection
  would quietly disappear.
- **A cron route is the safety net.** There is no long-running worker, so
  `/api/cron/process-fulfillments` recovers stalled jobs, drains the queue, and
  prunes expired rate-limit windows. `vercel.json` schedules it daily at 03:00
  UTC, because **Vercel Hobby rejects any cron more frequent than once per day**
  — the deploy fails outright rather than downgrading. On Pro, tighten it to
  `*/5 * * * *`.

### Steps

1. **MongoDB Atlas** — create the cluster (a replica set by default). Under
   Network Access, Vercel's egress IPs are dynamic, so either allow `0.0.0.0/0`
   with a strong database password or use an Atlas private endpoint.

2. **Provision the database.** Two options.

   **From a browser (no terminal needed):** deploy first, then visit `/setup` on
   the deployment. It asks for your `CRON_SECRET`, creates the unique indexes,
   seeds the catalog, and creates the Super Admin. It is one-shot — once an
   admin exists the endpoint returns 409 permanently, so a leaked token cannot
   mint a second owner. Prefer `db push` when you have a terminal: it derives
   indexes from the schema, whereas `/setup` applies a hand-maintained list in
   `src/lib/setup/indexes.ts` that must be updated if the schema gains a new
   unique constraint.

   **From a terminal**, pointed at Atlas — neither command can run on Vercel:
   ```bash
   DATABASE_URL="<atlas-url>" npm run db:push
   DATABASE_URL="<atlas-url>" npm run db:seed        # optional, test data only
   DATABASE_URL="<atlas-url>" AUTH_SECRET="<secret>" \
     SUPER_ADMIN_EMAIL=you@example.com \
     SUPER_ADMIN_PASSWORD='...' npm run admin:create
   ```
   `db:push` is what creates the unique indexes the duplicate protections rely
   on. Run it before any real traffic.

3. **Environment variables** (Vercel → Settings → Environment Variables). Set
   `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` (your real domain), `CRON_SECRET`,
   `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, and the business/data-provider
   values. Only `PAYSTACK_PUBLIC_KEY` is safe to expose; never add a
   `NEXT_PUBLIC_` prefix to any secret. Without `CRON_SECRET` the cron route
   refuses to run rather than sitting open.

4. **Deploy.** The build runs `prisma generate && next build`. `vercel.json`
   registers the cron schedule automatically.

5. **Paystack webhook** — point it at
   `https://<your-domain>/api/webhooks/paystack` and confirm `APP_URL` matches
   your domain, since the payment callback URL is built from it.

6. **Verify** a test-mode purchase end to end, then check the cron route under
   Vercel → Settings → Cron Jobs (it can be triggered manually there rather than
   waiting for 03:00).

### Vercel-specific notes

- `maxDuration` on the cron route is 60s; Hobby caps lower, so reduce the batch
  size if the queue grows.
- **Hobby allows only daily crons.** Delivery still happens immediately via
  `after()`, so the practical cost is that a *failed* delivery may wait up to a
  day for its retry. If that is too slow before upgrading to Pro, hit the route
  from an external scheduler (GitHub Actions, cron-job.org) with
  `Authorization: Bearer $CRON_SECRET` — it is a plain authenticated GET.
- Prisma requires the Node.js runtime; do not move these routes to Edge.

Security headers (HSTS, `X-Frame-Options`, `nosniff`, Referrer-Policy) are set in
`next.config.ts`. Secure cookies require HTTPS, which Vercel provides.

### Deploying elsewhere

On a normal long-running host, run `npm run build && npm start` behind HTTPS and
drain the queue from a worker instead of cron:

```ts
import { processQueue, recoverStalledFulfillments } from "@/lib/fulfillment";
setInterval(async () => {
  await recoverStalledFulfillments();
  await processQueue();
}, 30_000);
```

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
