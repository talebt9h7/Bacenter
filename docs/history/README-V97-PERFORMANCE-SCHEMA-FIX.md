# UR V97 — Performance + Schema Alignment

## Runtime fixes
- Removed request-time `ALTER TABLE` / `CREATE TABLE IF NOT EXISTS` work from normal storefront reads.
- `getSettings()` is request-memoized with React `cache()` so the header/layout and homepage do not fetch the same settings twice in one render.
- Homepage and storefront layout use 60-second revalidation instead of `force-dynamic`.
- Removed redundant full `router.refresh()` calls from several admin settings/content managers that already update their local state.
- Orders table now updates changed/deleted orders locally after API success instead of refreshing the entire admin route.
- Product variant attachment uses a keyed lookup rather than repeatedly filtering all variants for every product.

## Database
- The intended Bellroy/UR Next.js schema is the `bellroy` Supabase project. Its `public.orders` table was verified to contain every column required by `src/db/schema.ts`.
- V97 adds indexes for order date/status/customer, activity log date, product variants, and banners.
- These indexes were also applied to the verified `bellroy` project during validation.

## Validation
- Direct `public.orders` query with the exact columns used by Admin Orders was executed successfully against the intended database.
- `EXPLAIN ANALYZE` was run for the orders/products/banners queries; current database execution times were sub-millisecond.
- TypeScript syntax/transpilation checks passed for all modified TypeScript/TSX files.
- Full `npm run typecheck` / `next build` could not be completed in this environment because the supplied `node_modules` is incomplete and package installation timed out.

## Important deployment note
If the deployed app still reports `column "reference" does not exist` (or a similar orders-schema error), its `DATABASE_URL` is pointing at a different PostgreSQL database than the intended Bellroy schema. Do not add Bellroy columns blindly to another database; point the app at the correct database or perform an explicit schema migration after verifying the target.
