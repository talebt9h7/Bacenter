-- V97 performance indexes. Schema compatibility belongs to migrations,
-- never to storefront/admin request-time DDL.
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_customer_created_idx ON public.orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_created_idx ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS product_variants_product_sort_idx ON public.product_variants (product_id, sort_order, id);
CREATE INDEX IF NOT EXISTS banners_kind_active_sort_idx ON public.banners (kind, active, sort_order, id);
