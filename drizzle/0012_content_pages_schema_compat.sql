-- Compatibility migration for existing Supabase projects created before the
-- bilingual content-page fields and updated_at timestamp were introduced.
ALTER TABLE public.content_pages
  ADD COLUMN IF NOT EXISTS eyebrow_ar text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS title_ar text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subtitle_ar text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sections_ar jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS faqs_ar jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

UPDATE public.content_pages
SET eyebrow_ar = eyebrow
WHERE eyebrow_ar = '' AND eyebrow <> '';

UPDATE public.content_pages
SET title_ar = title
WHERE title_ar = '' AND title <> '';

UPDATE public.content_pages
SET subtitle_ar = subtitle
WHERE subtitle_ar = '' AND subtitle <> '';

UPDATE public.content_pages
SET sections_ar = sections
WHERE sections_ar = '[]'::jsonb AND sections <> '[]'::jsonb;

UPDATE public.content_pages
SET faqs_ar = faqs
WHERE faqs_ar = '[]'::jsonb AND faqs <> '[]'::jsonb;
