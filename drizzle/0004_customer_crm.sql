ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS preferred_channel text NOT NULL DEFAULT 'whatsapp';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_contact_at timestamp;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

UPDATE public.customers c
SET
  orders_count = COALESCE(x.orders_count, 0),
  total_spent = COALESCE(x.total_spent, 0),
  last_order_at = x.last_order_at,
  updated_at = now()
FROM (
  SELECT customer_id,
         count(*) FILTER (WHERE status NOT IN ('cancelled','returned'))::int AS orders_count,
         COALESCE(sum(GREATEST(subtotal_cents - discount_cents, 0)) FILTER (WHERE status NOT IN ('cancelled','returned')), 0)::int AS total_spent,
         max(created_at) FILTER (WHERE status NOT IN ('cancelled','returned')) AS last_order_at
  FROM public.orders
  WHERE customer_id IS NOT NULL
  GROUP BY customer_id
) x
WHERE c.id = x.customer_id;

UPDATE public.customers
SET orders_count = 0, total_spent = 0, last_order_at = NULL, updated_at = now()
WHERE id NOT IN (SELECT DISTINCT customer_id FROM public.orders WHERE customer_id IS NOT NULL AND status NOT IN ('cancelled','returned'));
