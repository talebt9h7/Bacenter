-- Category pages managed from Admin → Categories: the heading above the products (eyebrow,
-- headline, description already existed) and an optional banner per category.
-- The row id 'all' holds the "Shop all" page and pill; it is never a product category.
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "eyebrow" text NOT NULL DEFAULT '';
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "eyebrow_ar" text NOT NULL DEFAULT '';
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "headline" text NOT NULL DEFAULT '';
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "headline_ar" text NOT NULL DEFAULT '';
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "banner_active" boolean NOT NULL DEFAULT false;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "banner_image" text NOT NULL DEFAULT '';
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "banner_mobile_image" text NOT NULL DEFAULT '';
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "banner_title" text NOT NULL DEFAULT '';
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "banner_title_ar" text NOT NULL DEFAULT '';
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "banner_subtitle" text NOT NULL DEFAULT '';
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "banner_subtitle_ar" text NOT NULL DEFAULT '';
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "banner_cta" text NOT NULL DEFAULT '';
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "banner_cta_ar" text NOT NULL DEFAULT '';
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "banner_href" text NOT NULL DEFAULT '';
INSERT INTO "categories" ("id", "name", "name_ar", "description", "description_ar", "eyebrow", "eyebrow_ar", "headline", "headline_ar", "active", "sort_order")
VALUES ('all', 'Shop all', 'تسوق الكل',
  'Considered carry goods for all the ways you move. Find your everyday companion, and take it somewhere good.',
  'منتجات جلدية مدروسة لكل تنقلاتك. اختار رفيقك اليومي وخذه وياك لكل مكان.',
  'Thoughtfully designed. Made for you.', 'تصميم مدروس. صُنع لأجلك.',
  'Considered carry. Endless possibility.', 'اختيارات مدروسة لكل تنقلاتك', true, -1000)
ON CONFLICT ("id") DO NOTHING;
