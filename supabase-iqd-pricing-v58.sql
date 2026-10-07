-- IQD selling prices + USD purchase costs with historical exchange rates
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_price_iqd integer NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS purchase_cost_usd_cents integer;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS purchase_exchange_rate integer;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS sale_price_iqd integer;
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS purchase_cost_usd_cents integer;
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS purchase_exchange_rate integer;
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS sale_price_iqd integer;

-- Backfill existing product selling prices once, using the current configured exchange rate.
UPDATE public.products
SET sale_price_iqd = ROUND((price_cents / 100.0) * COALESCE((SELECT (value #>> '{}')::numeric FROM public.settings WHERE key = 'exchangeRate' LIMIT 1), 1320))
WHERE sale_price_iqd = 0;

-- Preserve legacy IQD purchase costs; do not invent historical USD costs or historical exchange rates.
-- New inventory/purchase entries will store purchase_cost_usd_cents + purchase_exchange_rate + derived purchase_cost_iqd.

UPDATE public.inventory_batches b
SET sale_price_iqd = ROUND((b.sale_price_cents / 100.0) * COALESCE((SELECT (value #>> '{}')::numeric FROM public.settings WHERE key = 'exchangeRate' LIMIT 1), 1320))
WHERE b.sale_price_iqd IS NULL AND b.sale_price_cents IS NOT NULL;
