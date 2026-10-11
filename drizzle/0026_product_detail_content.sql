ALTER TABLE products
  ADD COLUMN IF NOT EXISTS specifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS warranty text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS materials text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS story_images jsonb NOT NULL DEFAULT '[]'::jsonb;
