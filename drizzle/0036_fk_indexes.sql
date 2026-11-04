-- Covering indexes for foreign keys the Supabase advisor flagged (additive; nothing dropped).
CREATE INDEX IF NOT EXISTS "cart_items_variant_idx" ON "cart_items" ("variant_id");
CREATE INDEX IF NOT EXISTS "cart_bundles_bundle_idx" ON "cart_bundles" ("bundle_id");
CREATE INDEX IF NOT EXISTS "reviews_order_idx" ON "reviews" ("order_id");
CREATE INDEX IF NOT EXISTS "purchase_items_batch_idx" ON "purchase_items" ("batch_id");
