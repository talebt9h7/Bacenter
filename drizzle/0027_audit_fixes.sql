-- Audit fixes (October 2026)

-- 1. Revenue/profit are recognised on delivery, so record when each order was delivered.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at timestamp;
UPDATE public.orders o
SET delivered_at = COALESCE(
  (SELECT max(e.created_at) FROM public.order_events e WHERE e.order_id = o.id AND e.type = 'delivered'),
  o.updated_at
)
WHERE o.status = 'delivered' AND o.delivered_at IS NULL;
CREATE INDEX IF NOT EXISTS orders_delivered_at_idx ON public.orders (delivered_at) WHERE status = 'delivered';
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at);

-- 2. Column used by the product page; it was only ever added by a runtime ALTER TABLE
--    that has now been removed from the request path.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS dimensions_image text NOT NULL DEFAULT '';

-- 3. Keep inventory batches consistent with stock. Batches may never hold more units
--    than the variant has in stock (stock that was reduced in the product editor
--    without touching batches). Trim the oldest batches first (FIFO) until they match.
DO $$
DECLARE
  v record;
  b record;
  excess integer;
  take integer;
BEGIN
  FOR v IN
    SELECT pv.id, pv.stock, COALESCE(sum(ib.quantity_remaining), 0)::integer AS batched
    FROM public.product_variants pv
    JOIN public.inventory_batches ib ON ib.variant_id = pv.id
    GROUP BY pv.id, pv.stock
    HAVING COALESCE(sum(ib.quantity_remaining), 0) > pv.stock
  LOOP
    excess := v.batched - v.stock;
    FOR b IN
      SELECT id, quantity_remaining FROM public.inventory_batches
      WHERE variant_id = v.id AND quantity_remaining > 0
      ORDER BY received_at, id
    LOOP
      EXIT WHEN excess <= 0;
      take := LEAST(excess, b.quantity_remaining);
      UPDATE public.inventory_batches SET quantity_remaining = quantity_remaining - take WHERE id = b.id;
      excess := excess - take;
    END LOOP;
  END LOOP;
END $$;

-- 4. Admin sign-in rate limit shared by all serverless instances.
CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  locked_until timestamp NOT NULL
);

-- 5. Structured bilingual product-page content (headline, highlights, specs, warranty…).
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;
