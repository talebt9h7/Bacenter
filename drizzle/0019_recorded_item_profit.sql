-- v92: item-level and order-level recorded profit snapshots.
-- Profit entered/calculated at sale time is the reporting source of truth.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS profit_iqd integer;

-- Backfill legacy orders only when possible from their historical purchase-cost snapshot.
-- New orders will always write profit_iqd explicitly.
UPDATE orders
SET profit_iqd = COALESCE(
  (
    SELECT SUM(
      GREATEST(
        0,
        COALESCE((item->>'unitPrice')::numeric, 0) - COALESCE((item->>'purchaseCostCents')::numeric, 0)
      ) * COALESCE((item->>'quantity')::numeric, 0)
    )::integer
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(items) = 'array' THEN items ELSE '[]'::jsonb END) item
  ),
  0
)
WHERE profit_iqd IS NULL;

CREATE INDEX IF NOT EXISTS orders_profit_created_idx ON orders (created_at DESC, profit_iqd);
