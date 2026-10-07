ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name_ar text NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS subtitle_ar text NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description_ar text NOT NULL DEFAULT '';
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS name_ar text NOT NULL DEFAULT '';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS name_ar text NOT NULL DEFAULT '';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS description_ar text NOT NULL DEFAULT '';

UPDATE public.products SET name_ar = name WHERE name_ar = '';
UPDATE public.products SET subtitle_ar = subtitle WHERE subtitle_ar = '';
UPDATE public.products SET description_ar = description WHERE description_ar = '';
UPDATE public.product_variants SET name_ar = name WHERE name_ar = '';
UPDATE public.categories SET name_ar = name WHERE name_ar = '';
UPDATE public.categories SET description_ar = description WHERE description_ar = '';
