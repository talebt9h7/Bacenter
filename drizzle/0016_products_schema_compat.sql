-- Compatibility migration for older Supabase products/product_variants tables.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS name_ar text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subtitle text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subtitle_ar text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description_ar text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sale_price_iqd integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS capacity text,
  ADD COLUMN IF NOT EXISTS badge text,
  ADD COLUMN IF NOT EXISTS badge_ar text,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dimensions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS name_ar text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hex text NOT NULL DEFAULT '#333333',
  ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS primary_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
