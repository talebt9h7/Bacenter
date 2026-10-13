# BA Center store

Bilingual (Arabic / English) online store for Iraq with cash on delivery, plus an admin panel for
orders, customers, inventory batches, purchases, expenses, revenue/profit reports, content and team
permissions.

Stack: Next.js 16 (App Router) · React 19 · Drizzle ORM · PostgreSQL (Supabase) · deployed on Vercel.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000, admin at /admin
```

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `ADMIN_PASSWORD` | Owner password for `/admin` (until a password is saved from Settings) |
| `ADMIN_SESSION_SECRET` | Long random string used to sign admin sessions |

Set the same three variables in the Vercel project for production.

## Database migrations

SQL migrations live in `drizzle/` and are applied in file-name order (Supabase SQL editor or `psql`).
Each file is written to be safe to run more than once. The app no longer alters tables while serving
requests, so a new migration must be applied before deploying code that needs it.

## Deployment

`vercel.json` pins server functions to `icn1` (Seoul), the same region as the Supabase database.
A product page needs several database round trips; with the functions in Washington each trip
crossed the Pacific. Keep the two regions together if either one moves.

## How the main pieces work

**Storefront caching.** Product, stock and store-settings reads are cached across requests
(`src/lib/products.ts`, `src/lib/settings.ts`). Every write that changes them calls
`invalidateCatalog()` or `invalidateSettings()` from `src/lib/cache-tags.ts`; add the call to any
new code that writes products, stock, orders or settings. The cache also expires on its own
(60 s for the catalog, 5 min for settings).

**Images.** Uploaded images are stored in the `media` table and served by `/api/media/[id]`.
Add `?w=` to get a resized WebP (snapped to the widths in `MEDIA_WIDTHS`); `mediaSrc()` and
`mediaSrcSet()` in `src/lib/types.ts` build those URLs. Responses are cached for a year on the CDN.
New uploads larger than 400 KB or 2000 px are stored as a 2000 px WebP.

**Inventory.** Stock is tracked per colour (`product_variants.stock`) and per purchase batch
(`inventory_batches`, which carry the purchase cost). Rule: batches never hold more units than
stock. Units beyond the batches are "unbatched" (cost unknown); they can be sold, and such a sale
records its cost as unknown. Sales consume batches oldest first. Every stock change goes through
`adjustStock`, `receiveInventoryBatch` or `consumeInventoryBatches` in `src/lib/orders.ts` so the
movement ledger and batches stay consistent — never update `stock` directly.

**Pending orders reserve, confirmed orders deduct.** `stock` is the physical stock on hand. A
pending order only reserves its units (nothing is deducted, no batch is consumed). What the store
can sell is `on hand − reserved` (`src/lib/reservations.ts`); storefront, cart, checkout and
manual orders all use it. Moving an order to confirmed/processing/shipped/delivered deducts the
units FIFO and snapshots their purchase cost; moving it back to pending, cancelled or returned puts
them back. Any status can be chosen from the order page (jumps are confirmed and reversible).

**Money.** Amounts are integer IQD. Revenue and profit are recognised when an order is delivered
and are reported on its delivery date (`orders.delivered_at`), in Baghdad calendar days
(`src/lib/report-period.ts`). Product profit = product revenue after the order discount
(split across lines by value) − purchase cost; delivery and COD fees are excluded. Every admin
page computes these through `src/lib/finance.ts`; lines with an unknown purchase cost are reported
separately and left out of COGS, profit and margin.

**Offers (time-limited sales).** `promotions` (admin → Offers & Sales) lower prices for the whole
store, categories or chosen products between a start and an end time: percent off, an amount off
each unit, or a fixed sale price. They are applied when products are read (`src/lib/promotions.ts`),
after the catalog cache, so a sale starts and stops on time; the lowest price wins when several
apply. Cart and checkout charge the offer price and each order line keeps `listPrice`,
`promotionId` and `promotionName`. Coupons apply on top of offer prices.

**Coupons.** A coupon use is claimed atomically at checkout (so a limited coupon can't be
over-used) and given back if the order is cancelled, returned or deleted.

## Checks

```bash
npm run typecheck
npm run lint
# End-to-end checks for stock, money and permissions. They create data: local database only.
TEST_BASE_URL=http://localhost:3000 DATABASE_URL=postgresql://...local... ADMIN_PASSWORD=... node scripts/e2e-audit.cjs
# Unit checks for the money formulas
node --experimental-strip-types scripts/financial-calculation-test.mjs
```

Notes from earlier versions are kept in `docs/history/`.
