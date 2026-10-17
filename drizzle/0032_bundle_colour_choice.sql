-- Customers can pick another colour of each bundle item. The choice is stored on the bag line;
-- the same bundle in two colour combinations is two lines.
ALTER TABLE "cart_bundles" ADD COLUMN IF NOT EXISTS "selection" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "cart_bundles" ADD COLUMN IF NOT EXISTS "selection_key" text NOT NULL DEFAULT '';
DROP INDEX IF EXISTS "cart_bundles_session_bundle";
CREATE UNIQUE INDEX IF NOT EXISTS "cart_bundles_session_bundle_sel" ON "cart_bundles" ("session_id", "bundle_id", "selection_key");
