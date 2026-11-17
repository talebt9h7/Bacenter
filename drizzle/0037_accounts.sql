-- Accounts: delivery companies, courier settlements, manual money movements,
-- and where each order's money is (additive only).
CREATE TABLE IF NOT EXISTS "couriers" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "phone" text,
  "default_fee_iqd" integer NOT NULL DEFAULT 0,
  "return_fee_iqd" integer NOT NULL DEFAULT 0,
  "rates" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "courier_settlements" (
  "id" serial PRIMARY KEY,
  "courier_id" integer NOT NULL REFERENCES "couriers"("id"),
  "expected_iqd" integer NOT NULL,
  "received_iqd" integer NOT NULL,
  "account" text NOT NULL,
  "settled_at" timestamp NOT NULL DEFAULT now(),
  "note" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "courier_settlements_courier_idx" ON "courier_settlements" ("courier_id");

CREATE TABLE IF NOT EXISTS "money_movements" (
  "id" serial PRIMARY KEY,
  "kind" text NOT NULL,
  "from_account" text,
  "to_account" text,
  "amount_iqd" integer NOT NULL,
  "moved_at" timestamp NOT NULL DEFAULT now(),
  "note" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fulfillment" text NOT NULL DEFAULT 'courier';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courier_id" integer;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courier_fee_iqd" integer;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "settlement_id" integer;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paid_to" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paid_at" timestamp;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "gateway_fee_iqd" integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "orders_courier_idx" ON "orders" ("courier_id");
CREATE INDEX IF NOT EXISTS "orders_settlement_idx" ON "orders" ("settlement_id");

ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "account" text;
ALTER TABLE "wholesale_payments" ADD COLUMN IF NOT EXISTS "account" text NOT NULL DEFAULT 'cash';

-- Orders already marked paid by transfer, cash or card: record the account the money went to.
-- Cash-on-delivery orders are left for the owner to settle with the delivery company.
UPDATE "orders" SET "paid_to" = CASE "payment_method" WHEN 'cash' THEN 'cash' WHEN 'bank_transfer' THEN 'master' WHEN 'electronic' THEN 'qaseh' END,
  "paid_at" = COALESCE("delivered_at", "updated_at")
WHERE "payment_status" = 'paid' AND "paid_to" IS NULL AND "payment_method" IN ('cash', 'bank_transfer', 'electronic') AND "source" <> 'wholesale';
-- Shop sales paid in cash were handed over in the shop.
UPDATE "orders" SET "fulfillment" = 'pickup' WHERE "payment_method" = 'cash' AND "source" = 'store';

-- Same as every other table: no access through the public API, only the app's own connection.
ALTER TABLE "couriers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "courier_settlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "money_movements" ENABLE ROW LEVEL SECURITY;
