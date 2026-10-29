-- Electronic payments (ZainCash / FIB). One row per payment attempt; an order can have several
-- attempts (a failed or expired one, then a retry). The public token is what the pay page URL uses.
CREATE TABLE IF NOT EXISTS "payments" (
  "id" serial PRIMARY KEY,
  "order_id" integer NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "provider" text NOT NULL,
  "mode" text NOT NULL DEFAULT 'test',
  "status" text NOT NULL DEFAULT 'pending',
  "amount_iqd" integer NOT NULL,
  "external_ref" text NOT NULL,
  "provider_ref" text,
  "redirect_url" text,
  "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "error" text,
  "paid_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "payments_order_idx" ON "payments" ("order_id");
CREATE INDEX IF NOT EXISTS "payments_provider_ref_idx" ON "payments" ("provider_ref");
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
