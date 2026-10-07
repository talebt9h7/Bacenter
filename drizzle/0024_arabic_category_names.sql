UPDATE public.categories SET name_ar = CASE id
  WHEN 'backpacks' THEN 'حقائب الظهر'
  WHEN 'crossbody-bags' THEN 'حقائب الكتف والكروس'
  WHEN 'tote-bags' THEN 'حقائب اليد والكتف'
  WHEN 'work-bags' THEN 'حقائب العمل'
  WHEN 'luggage' THEN 'حقائب السفر'
  WHEN 'wallets' THEN 'المحافظ'
  WHEN 'phone-cases' THEN 'أغطية الهواتف'
  WHEN 'accessories' THEN 'إكسسوارات'
  ELSE name_ar
END
WHERE id IN ('backpacks','crossbody-bags','tote-bags','work-bags','luggage','wallets','phone-cases','accessories');
