CREATE TABLE IF NOT EXISTS inventory_batches (
  id serial PRIMARY KEY,
  variant_id integer NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  batch_number text NOT NULL,
  quantity_received integer NOT NULL CHECK (quantity_received > 0),
  quantity_remaining integer NOT NULL CHECK (quantity_remaining >= 0),
  purchase_cost_iqd integer CHECK (purchase_cost_iqd >= 0),
  sale_price_cents integer CHECK (sale_price_cents >= 0),
  received_at timestamp NOT NULL DEFAULT now(),
  notes text
);
CREATE INDEX IF NOT EXISTS batches_variant_idx ON inventory_batches(variant_id);
CREATE INDEX IF NOT EXISTS batches_received_idx ON inventory_batches(received_at);

-- Preserve the stock that already exists before batch tracking. Its purchase cost is intentionally NULL because the old system did not store it.
INSERT INTO inventory_batches (variant_id, batch_number, quantity_received, quantity_remaining, purchase_cost_iqd, sale_price_cents)
SELECT v.id, 'LEGACY-' || v.id::text, v.stock, v.stock, NULL, p.price_cents
FROM product_variants v
JOIN products p ON p.id = v.product_id
WHERE v.stock > 0
  AND NOT EXISTS (SELECT 1 FROM inventory_batches b WHERE b.variant_id = v.id);
