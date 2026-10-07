ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS category_id text;
CREATE INDEX IF NOT EXISTS banners_category_idx ON public.banners(category_id, sort_order, id);
