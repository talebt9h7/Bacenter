// Storefront taxonomy plus the seed catalog that populates the database on first run.
export const categories = [
  { id: 'all', name: 'Shop all', nameAr: 'تسوق الكل' }, { id: 'backpacks', name: 'Backpacks', nameAr: 'حقائب الظهر' },
  { id: 'crossbody-bags', name: 'Slings & Crossbody Bags', nameAr: 'حقائب الكتف والكروس' }, { id: 'wallets', name: 'Wallets', nameAr: 'محافظ' },
  { id: 'phone-cases', name: 'Phone Cases', nameAr: 'أغطية الهواتف' }, { id: 'luggage', name: 'Luggage', nameAr: 'حقائب السفر' },
  { id: 'work-bags', name: 'Work Bags', nameAr: 'حقائب العمل' }, { id: 'tote-bags', name: 'Tote & Shoulder Bags', nameAr: 'حقائب اليد والكتف' },
  { id: 'accessories', name: 'Accessories', nameAr: 'إكسسوارات' },
];
export const bagCategories = ['backpacks', 'crossbody-bags', 'tote-bags', 'work-bags', 'luggage'];
export const collectionNames: Record<string, string> = { bestsellers: 'The crowd favorites', 'new-releases': 'Fresh perspectives. New possibilities.', travel: 'Made for the journey', work: 'A better way to work', outdoor: 'Go a little further', campus: 'Ready for what’s next', tech: 'For all the ways you move.', 'for-tech-lovers': 'For all the ways you move.', transit: 'Meet the Transit Collection', venture: 'Adventure is calling', tokyo: 'City life, considered', classic: 'Classic for a reason', lite: 'Carry less. Do more.', cinch: 'An easy kind of everyday', laneway: 'Find your own way', 'value-sets': 'Better together', outlet: 'Good things. Better prices.' };
export const collectionNamesAr: Record<string, string> = { bestsellers: 'الأكثر طلباً', 'new-releases': 'إصدارات جديدة', travel: 'مصممة للرحلة', work: 'طريقة أفضل للعمل', outdoor: 'انطلق أبعد', campus: 'جاهز لما هو قادم', tech: 'لكل طرق تنقلك', 'for-tech-lovers': 'لكل طرق تنقلك', transit: 'مجموعة Transit', venture: 'المغامرة تنادي', tokyo: 'حياة المدينة بأسلوب مدروس', classic: 'كلاسيكية لسبب', lite: 'احمل أقل. افعل أكثر.', cinch: 'سهولة لكل يوم', laneway: 'اصنع طريقك الخاص', 'value-sets': 'أفضل معاً', outlet: 'أشياء جميلة بأسعار أفضل.' };

