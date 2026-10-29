-- Optional sizes. A product with sizes has one variant per colour × size; each size may carry
-- its own price (price_iqd, NULL = the product price). Products without sizes keep size = ''.
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "size" text NOT NULL DEFAULT '';
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "size_ar" text NOT NULL DEFAULT '';
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "price_iqd" integer;
