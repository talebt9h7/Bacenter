ALTER TABLE banners ADD COLUMN IF NOT EXISTS title_ar text;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS subtitle_ar text;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS cta_label_ar text;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS badge_ar text;

UPDATE banners
SET title_ar = COALESCE(title_ar, CASE title
  WHEN 'For all the ways you move.' THEN 'لكل خطوة تخطوها.'
  WHEN 'Carry smart.\nMove free.\nGo far.' THEN 'احمل بذكاء.\nتحرك بحرية.\nاذهب بعيداً.'
  WHEN 'We’ve got\nyour back.' THEN 'رفيقك في كل طريق.'
  ELSE title END),
    cta_label_ar = COALESCE(cta_label_ar, CASE cta_label
  WHEN 'Shop now' THEN 'تسوق الآن'
  WHEN 'Shop tech' THEN 'تسوق المنتجات التقنية'
  WHEN 'Shop bestsellers' THEN 'تسوق الأكثر مبيعاً'
  WHEN 'Shop backpacks' THEN 'تسوق الحقائب'
  ELSE cta_label END),
    badge_ar = COALESCE(badge_ar, CASE badge WHEN 'NEW' THEN 'جديد' WHEN 'SAVE' THEN 'وفر' ELSE badge END);
