-- Procurement rebuild: multi-line purchases in IQD or USD, landed cost (shipping/customs spread over
-- the lines), ordered → received → cancelled lifecycle, supplier payments and running balances.

ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "contact_person" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "opening_balance_iqd" integer NOT NULL DEFAULT 0;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "payment_terms_days" integer NOT NULL DEFAULT 0;

ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "supplier_invoice" text;
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'IQD';
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "exchange_rate" integer NOT NULL DEFAULT 0;
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "subtotal_iqd" integer NOT NULL DEFAULT 0;
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "extra_costs_iqd" integer NOT NULL DEFAULT 0;
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "discount_iqd" integer NOT NULL DEFAULT 0;
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "due_date" timestamp;
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "received_at" timestamp;
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp;
ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "created_by" text;
CREATE INDEX IF NOT EXISTS "purchases_status_idx" ON "purchases" ("status");
UPDATE "purchases" SET "subtotal_iqd" = "total_cost_iqd", "received_at" = COALESCE("received_at", "purchase_date") WHERE "subtotal_iqd" = 0 AND "status" = 'received';

ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "unit_cost" integer NOT NULL DEFAULT 0;
ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "landed_cost_iqd" integer NOT NULL DEFAULT 0;
UPDATE "purchase_items" SET "unit_cost" = "purchase_cost_iqd", "landed_cost_iqd" = "purchase_cost_iqd" WHERE "landed_cost_iqd" = 0;

CREATE TABLE IF NOT EXISTS "supplier_payments" (
  "id" serial PRIMARY KEY,
  "supplier_id" integer NOT NULL REFERENCES "suppliers"("id") ON DELETE CASCADE,
  "purchase_id" integer REFERENCES "purchases"("id") ON DELETE SET NULL,
  "amount_iqd" integer NOT NULL,
  "method" text NOT NULL DEFAULT 'cash',
  "paid_at" timestamp NOT NULL DEFAULT now(),
  "note" text,
  "created_by" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "supplier_payments_supplier_idx" ON "supplier_payments" ("supplier_id");
CREATE INDEX IF NOT EXISTS "supplier_payments_purchase_idx" ON "supplier_payments" ("purchase_id");
ALTER TABLE "supplier_payments" ENABLE ROW LEVEL SECURITY;
