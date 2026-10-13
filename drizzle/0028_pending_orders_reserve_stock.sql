-- New stock rule: a pending order only reserves units; stock is deducted when the order is confirmed.
-- Pending orders placed under the old rule already took stock. This gives those units back.
-- What an order took is read from the inventory ledger (movements carry the order reference), so the
-- script is exact and safe to run more than once: after it runs, each order's ledger nets to zero.
DO $$
DECLARE
  rec record;
  new_stock integer;
BEGIN
  FOR rec IN
    SELECT o.id AS order_id, o.reference, m.variant_id, -SUM(m.delta)::int AS taken
    FROM orders o
    JOIN inventory_movements m ON m.reference = o.reference
    WHERE o.status = 'pending'
    GROUP BY o.id, o.reference, m.variant_id
    HAVING -SUM(m.delta) > 0
  LOOP
    UPDATE product_variants SET stock = stock + rec.taken WHERE id = rec.variant_id RETURNING stock INTO new_stock;
    IF new_stock IS NOT NULL THEN
      INSERT INTO inventory_movements (variant_id, delta, stock_after, reason, reference)
      VALUES (rec.variant_id, rec.taken, new_stock, 'Pending order: stock released (reserved until confirmed)', rec.reference);
    END IF;
    -- Put the units back into the purchase batches they were taken from.
    UPDATE inventory_batches b
    SET quantity_remaining = b.quantity_remaining + a.qty
    FROM (
      SELECT (alloc->>'batchId')::int AS batch_id, SUM((alloc->>'quantity')::int) AS qty
      FROM orders o, jsonb_array_elements(o.items) AS item, jsonb_array_elements(COALESCE(item->'batchAllocations', '[]'::jsonb)) AS alloc
      WHERE o.id = rec.order_id AND (item->>'variantId')::int = rec.variant_id
      GROUP BY 1
    ) a
    WHERE b.id = a.batch_id;
  END LOOP;

  -- Pending items carry no batch allocation or purchase cost; both are set when the order is confirmed.
  UPDATE orders o
  SET items = (
    SELECT jsonb_agg(item || '{"batchAllocations": [], "purchaseCostCents": null, "profitIqd": 0}'::jsonb ORDER BY ord)
    FROM jsonb_array_elements(o.items) WITH ORDINALITY AS t(item, ord)
  )
  WHERE o.status = 'pending' AND jsonb_typeof(o.items) = 'array' AND jsonb_array_length(o.items) > 0;
END $$;

-- Batches must never hold more units than the stock on hand.
UPDATE inventory_batches b SET quantity_remaining = GREATEST(0, b.quantity_remaining - excess.over)
FROM (
  SELECT x.id, LEAST(x.quantity_remaining, GREATEST(0, x.running - v.stock)) AS over
  FROM (
    SELECT id, variant_id, quantity_remaining,
           SUM(quantity_remaining) OVER (PARTITION BY variant_id ORDER BY received_at DESC, id DESC) AS running
    FROM inventory_batches WHERE quantity_remaining > 0
  ) x JOIN product_variants v ON v.id = x.variant_id
) excess
WHERE b.id = excess.id AND excess.over > 0;
