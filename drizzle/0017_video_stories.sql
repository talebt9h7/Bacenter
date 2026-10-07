CREATE TABLE IF NOT EXISTS public.video_stories (id serial PRIMARY KEY,youtube_id text NOT NULL,title text NOT NULL DEFAULT '',title_ar text NOT NULL DEFAULT '',cta text NOT NULL DEFAULT 'Watch now',cta_ar text NOT NULL DEFAULT 'شاهد الآن',href text NOT NULL DEFAULT '/',active boolean NOT NULL DEFAULT true,sort_order integer NOT NULL DEFAULT 0,created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now());
ALTER TABLE public.video_stories ADD COLUMN IF NOT EXISTS title_ar text NOT NULL DEFAULT '';
ALTER TABLE public.video_stories ADD COLUMN IF NOT EXISTS cta_ar text NOT NULL DEFAULT 'شاهد الآن';
ALTER TABLE public.video_stories ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS video_stories_sort_idx ON public.video_stories(sort_order);
CREATE INDEX IF NOT EXISTS video_stories_active_idx ON public.video_stories(active);
