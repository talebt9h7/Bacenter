ALTER TABLE public.content_pages ADD COLUMN IF NOT EXISTS eyebrow_ar text NOT NULL DEFAULT '';
ALTER TABLE public.content_pages ADD COLUMN IF NOT EXISTS title_ar text NOT NULL DEFAULT '';
ALTER TABLE public.content_pages ADD COLUMN IF NOT EXISTS subtitle_ar text NOT NULL DEFAULT '';
ALTER TABLE public.content_pages ADD COLUMN IF NOT EXISTS sections_ar jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.content_pages ADD COLUMN IF NOT EXISTS faqs_ar jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.content_pages
SET eyebrow_ar = eyebrow WHERE eyebrow_ar = '';
UPDATE public.content_pages
SET title_ar = title WHERE title_ar = '';
UPDATE public.content_pages
SET subtitle_ar = subtitle WHERE subtitle_ar = '';
UPDATE public.content_pages
SET sections_ar = sections WHERE sections_ar = '[]'::jsonb;
UPDATE public.content_pages
SET faqs_ar = faqs WHERE faqs_ar = '[]'::jsonb;
