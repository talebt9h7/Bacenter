-- v93: product profit formula is always sale price minus purchase price, per unit.
-- Order discounts and delivery fees are separate and do not change product profit.

UPDATE orders
SET items = (
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN jsonb_typeof(item) = 'object' THEN
        jsonb_set(
          item,
          '{profitIqd}',
          to_jsonb(
            COALESCE((item->>'unitPrice')::numeric, 0)
            - COALESCE((item->>'purchaseCostCents')::numeric, 0)
          ),
          true
        )
      ELSE item
    END
  ), '[]'::jsonb)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(items) = 'array' THEN items ELSE '[]'::jsonb END) item
),
profit_iqd = (
  SELECT COALESCE(SUM(
    (COALESCE((item->>'unitPrice')::numeric, 0)
      - COALESCE((item->>'purchaseCostCents')::numeric, 0))
    * COALESCE((item->>'quantity')::numeric, 0)
  ), 0)::integer
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(items) = 'array' THEN items ELSE '[]'::jsonb END) item
);
