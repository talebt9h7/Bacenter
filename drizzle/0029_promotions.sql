CREATE TABLE IF NOT EXISTS "promotions" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "name_ar" text NOT NULL DEFAULT '',
  "type" text NOT NULL DEFAULT 'percent',
  "value" integer NOT NULL,
  "scope" text NOT NULL DEFAULT 'all',
  "category_ids" text[] NOT NULL DEFAULT '{}',
  "product_ids" text[] NOT NULL DEFAULT '{}',
  "starts_at" timestamp NOT NULL,
  "ends_at" timestamp NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "show_countdown" boolean NOT NULL DEFAULT true,
  "badge" text NOT NULL DEFAULT '',
  "badge_ar" text NOT NULL DEFAULT '',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "promotions_type_check" CHECK ("type" IN ('percent','amount','price')),
  CONSTRAINT "promotions_scope_check" CHECK ("scope" IN ('all','categories','products')),
  CONSTRAINT "promotions_value_check" CHECK ("value" > 0),
  CONSTRAINT "promotions_window_check" CHECK ("ends_at" > "starts_at")
);
CREATE INDEX IF NOT EXISTS "promotions_window_idx" ON "promotions" ("active", "ends_at");
-- Like the other tables: no direct access through the Supabase API; the app connects as the owner.
ALTER TABLE "promotions" ENABLE ROW LEVEL SECURITY;
