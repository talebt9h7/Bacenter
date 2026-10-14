-- Bundles: several product colours sold together at one price; stock is taken from each component.
CREATE TABLE IF NOT EXISTS "bundles" (
  "id" serial PRIMARY KEY,
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "name_ar" text NOT NULL DEFAULT '',
  "description" text NOT NULL DEFAULT '',
  "description_ar" text NOT NULL DEFAULT '',
  "image" text,
  "price_iqd" integer NOT NULL,
  "items" jsonb NOT NULL DEFAULT '[]',
  "active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "bundles_price_check" CHECK ("price_iqd" > 0)
);
CREATE TABLE IF NOT EXISTS "cart_bundles" (
  "id" serial PRIMARY KEY,
  "session_id" text NOT NULL,
  "bundle_id" integer NOT NULL REFERENCES "bundles"("id") ON DELETE CASCADE,
  "quantity" integer NOT NULL DEFAULT 1,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "cart_bundles_session_bundle" ON "cart_bundles" ("session_id", "bundle_id");

-- Wholesale: a wholesale price per product, and payments received against credit (آجل) invoices.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "wholesale_price_iqd" integer NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paid_cents" integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS "wholesale_payments" (
  "id" serial PRIMARY KEY,
  "order_id" integer NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "amount_iqd" integer NOT NULL,
  "note" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "wholesale_payments_amount_check" CHECK ("amount_iqd" > 0)
);
CREATE INDEX IF NOT EXISTS "wholesale_payments_order_idx" ON "wholesale_payments" ("order_id");

-- Customer reviews, shown only after approval.
CREATE TABLE IF NOT EXISTS "reviews" (
  "id" serial PRIMARY KEY,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "order_id" integer REFERENCES "orders"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "city" text NOT NULL DEFAULT '',
  "phone" text NOT NULL DEFAULT '',
  "rating" integer NOT NULL,
  "title" text NOT NULL DEFAULT '',
  "body" text NOT NULL DEFAULT '',
  "image" text,
  "verified" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'pending',
  "reply" text NOT NULL DEFAULT '',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "reviews_status_check" CHECK ("status" IN ('pending','approved','hidden'))
);
CREATE INDEX IF NOT EXISTS "reviews_product_idx" ON "reviews" ("product_id", "status");

ALTER TABLE "bundles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cart_bundles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wholesale_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;
