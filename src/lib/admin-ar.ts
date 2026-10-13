/**
 * Arabic for admin interface text that is still written in English in components, status values
 * stored in the database (order status, payment status, activity actions) and system messages.
 * Applied by <AdminArabic/> only when the admin language is Arabic. Exact (trimmed) matches only,
 * so product names, customer data and codes are never touched.
 */
export const ADMIN_AR: Record<string, string> = {
  'Full-width slideshow at the top of the homepage. Use a 1920×800 desktop image and a 714×936 mobile image. Line breaks in the title create separate lines.': 'عرض شرائح بعرض الشاشة أعلى الرئيسية. استخدم صورة 1920×800 للكمبيوتر و714×936 للموبايل. كل سطر جديد بالعنوان يظهر كسطر منفصل.',
  'Tip: the storefront switches colors while keeping the same photo position, so keep each color’s photos in the same order (front, detail, side…).': 'ملاحظة: المتجر يبدّل الألوان ويحافظ على نفس ترتيب الصور، فخلي صور كل لون بنفس الترتيب (أمام، تفاصيل، جانب…).',
  'Use /images/... or an HTTPS image URL. This controls the header, footer and favicon when configured.': 'استخدم /images/... أو رابط صورة HTTPS. هذا يتحكم بشعار الرأس والتذييل وأيقونة المتصفح.',
  'Used to calculate USD equivalents and to convert new USD purchase costs into IQD. Existing IQD sale prices do not change when this rate changes.': 'يستخدم لحساب ما يعادل الدولار وتحويل تكلفة الشراء الجديدة للدينار. أسعار البيع الحالية بالدينار ما تتغير لما يتغير السعر.',
  // statuses
  pending: 'قيد الانتظار', confirmed: 'مؤكد', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي', returned: 'مرتجع', created: 'تم الإنشاء',
  unpaid: 'غير مدفوع', paid: 'مدفوع', refunded: 'مسترجع', partial: 'مدفوع جزئياً', Website: 'الموقع', website: 'الموقع', manual: 'يدوي', Manual: 'يدوي', Instagram: 'إنستغرام', WhatsApp: 'واتساب', Phone: 'هاتف', Facebook: 'فيسبوك',
  Active: 'فعال', Inactive: 'غير فعال', Hidden: 'مخفي', Visible: 'ظاهر', Scheduled: 'مجدول', Expired: 'منتهي', Draft: 'مسودة', Published: 'منشور', Never: 'أبداً', open: 'مفتوحة', closed: 'مغلقة', received: 'مستلمة',
  'Order placed': 'تم استلام الطلب', 'Order confirmed': 'تم تأكيد الطلب', 'Order cancelled': 'تم إلغاء الطلب', 'Order delivered': 'تم توصيل الطلب', 'Order pending': 'رجع قيد الانتظار', 'Order shipped': 'تم شحن الطلب', 'Order processing': 'قيد التجهيز', 'Order returned': 'تم إرجاع الطلب', 'Order details updated': 'تم تعديل تفاصيل الطلب',
  // activity actions/entities
  create: 'إنشاء', update: 'تعديل', delete: 'حذف', backup: 'نسخ احتياطي', 'inventory.purchase': 'استلام مخزون', 'inventory.adjust': 'تعديل مخزون', 'inventory.batch_delete': 'حذف دفعة', 'settings.update': 'تعديل الإعدادات',
  order: 'طلب', product: 'منتج', variant: 'لون', coupon: 'كوبون', promotion: 'عرض', content: 'محتوى', integrations: 'الإشعارات والتتبع', admin_user: 'عضو فريق', database: 'قاعدة البيانات', settings: 'الإعدادات', customer: 'عميل', inventory_batch: 'دفعة مخزون', category: 'تصنيف', banner: 'بانر', media: 'وسائط', supplier: 'مورد', purchase: 'شراء', expense: 'مصروف', redirect: 'تحويل',
  // roles
  System: 'النظام', Owner: 'المالك', Accountant: 'محاسب', Sales: 'مبيعات', Manager: 'مدير', Inventory: 'مخزون', Content: 'محتوى', Viewer: 'مشاهد',
  // orders
  'All (': 'الكل (', 'Search reference, name, phone, city…': 'ابحث برقم الطلب أو الاسم أو الهاتف أو المدينة…', 'Previous': 'السابق', 'Next': 'التالي', 'Page': 'صفحة', 'of': 'من',
  // products
  'Tip: the storefront switches colors while keeping the same photo position, so keep each angle in the same slot for every color.': 'ملاحظة: المتجر يبدّل الألوان ويحافظ على نفس ترتيب الصور، فخلي كل زاوية تصوير بنفس المكان لكل لون.',
  'Open storefront': 'فتح المتجر', 'color': 'لون', 'colors': 'ألوان', 'photo': 'صورة', 'photos': 'صور', 'units in stock ·': 'قطعة بالمخزون ·', 'units': 'قطعة', 'products': 'منتجات', 'orders': 'طلبات',
  'English storefront content': 'محتوى المتجر بالإنكليزي', 'English content': 'المحتوى الإنكليزي', 'English': 'الإنكليزية', 'Product name': 'اسم المنتج', 'Subtitle': 'العنوان الفرعي', 'Description': 'الوصف', '(comma separated)': '(افصل بفاصلة)',
  'Photo position stays the same when switching colors, exactly like the storefront.': 'ترتيب الصور يبقى نفسه عند تبديل اللون، مثل المتجر بالضبط.',
  'Example: Classic Leather Wallet': 'مثال: Classic Leather Wallet', 'Example: Crafted from genuine leather': 'مثال: Crafted from genuine leather', 'Write the product description in English...': 'اكتب وصف المنتج بالإنكليزي...',
  // inventory
  'Recent stock movements': 'آخر حركات المخزون', When: 'الوقت', Product: 'المنتج', Color: 'اللون', Change: 'التغيير', After: 'بعد', Reason: 'السبب',
  'Purchase received': 'استلام شراء', 'Manual adjustment': 'تعديل يدوي', 'Stock count': 'جرد', 'Damaged': 'تالف', 'Returned to stock': 'رجع للمخزون', 'Order confirmed (stock out)': 'تأكيد طلب (خروج مخزون)',
  Optional: 'اختياري',
  // customers
  'All customers': 'كل العملاء', 'CRM · Customer profile': 'العملاء · ملف العميل', 'CRM': 'العملاء', Orders: 'الطلبات', 'Product spend': 'إنفاق المنتجات', Products: 'المنتجات', Segments: 'الشرائح', 'Customer profile': 'ملف العميل', Name: 'الاسم', Email: 'البريد الإلكتروني', 'Internal note': 'ملاحظة داخلية', Tags: 'الوسوم', Add: 'إضافة', 'Preferred contact': 'وسيلة التواصل المفضلة', 'Marketing messages allowed': 'يسمح برسائل تسويقية', 'Save customer': 'حفظ العميل', 'WhatsApp follow-up': 'متابعة واتساب', 'Message template': 'قالب الرسالة', 'Open WhatsApp': 'فتح واتساب', 'Call customer': 'اتصال بالعميل', 'What they bought': 'شنو اشترى', 'Purchase history': 'سجل المشتريات', Order: 'الطلب', Total: 'الإجمالي', Status: 'الحالة', 'Preferences, sizing, gift occasions, follow-up notes…': 'تفضيلات، مناسبات هدايا، ملاحظات متابعة…', wallets: 'محافظ', bags: 'حقائب', accessories: 'إكسسوارات',
  // coupons
  'Discount codes': 'أكواد الخصم', 'New coupon': 'كوبون جديد', Code: 'الكود', Discount: 'الخصم', Conditions: 'الشروط', Used: 'مستخدم', Expires: 'ينتهي', 'No minimum': 'بدون حد أدنى', 'Free delivery': 'توصيل مجاني', 'Edit coupon': 'تعديل الكوبون', 'Type': 'النوع', 'Value': 'القيمة', 'Minimum order (IQD)': 'الحد الأدنى للطلب (د.ع)', 'Max uses': 'أقصى عدد استخدامات', 'Expiry date': 'تاريخ الانتهاء', 'Percent': 'نسبة', 'Fixed amount': 'مبلغ ثابت', Save: 'حفظ', Cancel: 'إلغاء', Delete: 'حذف', Edit: 'تعديل', Close: 'إغلاق',
  // homepage
  'Trending eyebrow — English': 'عنوان صغير للأكثر مبيعاً — إنكليزي', 'Trending title — English': 'عنوان الأكثر مبيعاً — إنكليزي', 'Trending link — English': 'رابط الأكثر مبيعاً — إنكليزي', 'Trending URL': 'رابط الأكثر مبيعاً', 'Category heading — English': 'عنوان التصنيفات — إنكليزي', 'Category card line 1 — English': 'بطاقة التصنيف سطر 1 — إنكليزي', 'Category card line 2 — English': 'بطاقة التصنيف سطر 2 — إنكليزي', 'Category card link — English': 'رابط بطاقة التصنيف — إنكليزي', 'Category button — English': 'زر التصنيف — إنكليزي', 'Collections heading — English': 'عنوان المجموعات — إنكليزي', 'Collections link — English': 'رابط المجموعات — إنكليزي', 'Collections URL': 'رابط المجموعات', 'Social eyebrow — English': 'عنوان صغير للسوشيال — إنكليزي', 'Social title — English': 'عنوان السوشيال — إنكليزي', 'Social handle — English': 'حساب السوشيال — إنكليزي', 'Save all homepage changes': 'حفظ كل تعديلات الرئيسية',
  // banners / sections / videos / stores
  'Homepage hero slides': 'شرائح أعلى الصفحة الرئيسية', 'Full-width slideshow at the top of the homepage. Use a 1920×800 desktop image and an optional 900×1100 mobile image.': 'عرض شرائح بعرض الشاشة أعلى الرئيسية. استخدم صورة 1920×800 للكمبيوتر وصورة 900×1100 للموبايل (اختياري).', 'Highlight cards': 'بطاقات مميزة', 'The row of cards below the hero (240×160 images).': 'صف البطاقات تحت الشرائح (صور 240×160).', 'Promo banners': 'بانرات ترويجية', 'Extra promotional slots you can link from campaigns.': 'أماكن ترويجية إضافية تربطها بالحملات.', 'promo banners': 'بانرات ترويجية', 'yet.': 'بعد.', 'No': 'لا يوجد', 'Add slide': 'إضافة شريحة', 'Add card': 'إضافة بطاقة', 'Add banner': 'إضافة بانر', 'Edit banner': 'تعديل البانر',
  'Video Stories': 'قصص الفيديو', 'Video stories': 'قصص الفيديو', 'Manage homepage video stories, YouTube IDs, Arabic and English copy, calls to action and visibility.': 'إدارة فيديوهات الصفحة الرئيسية: روابط يوتيوب، النصوص بالعربي والإنكليزي، الأزرار والظهور.', 'Manage homepage video stories directly in the database.': 'أضف وعدّل فيديوهات الصفحة الرئيسية.', 'Add video': 'إضافة فيديو',
  'Stores & stockists': 'المتاجر ونقاط البيع', 'Manage the points of sale shown on the storefront. Changes are saved to the database.': 'إدارة نقاط البيع الظاهرة بالمتجر.', 'Points of sale': 'نقاط البيع', 'Add, edit, hide or reorder the locations shown on the public Stores & stockists page.': 'أضف أو عدّل أو اخفِ أو رتّب المواقع الظاهرة بصفحة المتاجر.', 'Add point of sale': 'إضافة نقطة بيع', Store: 'المتجر', Arabic: 'العربي', Address: 'العنوان', Actions: 'الإجراءات',
  'Media Library': 'مكتبة الوسائط', 'Manage every uploaded image used by products, banners, pages and storefront content.': 'كل الصور المرفوعة المستخدمة بالمنتجات والبانرات والصفحات.',
  // content / seo / footer / navigation
  Upload: 'رفع', Clear: 'مسح', 'Upload the logo here. The same logo is used in the storefront header and footer.': 'ارفع الشعار هنا. نفس الشعار يظهر برأس وتذييل المتجر.', 'Footer tagline': 'عبارة التذييل', 'Search & social defaults': 'إعدادات البحث والمشاركة', 'Example: https://example.com': 'مثال: https://example.com',
  Footer: 'التذييل', 'Control footer columns, links, trust messages and newsletter content without editing code.': 'تحكم بأعمدة التذييل وروابطه ورسائل الثقة وصندوق الاشتراك.', Help: 'مساعدة', 'Shop products': 'تسوق المنتجات', 'Explore the range': 'استكشف التشكيلة', 'About us': 'من نحن', 'The four service/value messages above the footer.': 'رسائل الخدمة الأربع فوق التذييل.', 'Save footer': 'حفظ التذييل',
  Refresh: 'تحديث',
  // shipping / settings
  'Delivery · Iraq': 'التوصيل · العراق', 'Cash-on-delivery courier rates and lead times for each of the 18 governorates.': 'أجور التوصيل ومدته لكل محافظة من الـ18 مع الدفع عند الاستلام.',
  'Use /images/... or an HTTPS image URL. This controls the header, footer and admin logo.': 'استخدم /images/... أو رابط صورة HTTPS. هذا يتحكم بشعار الرأس والتذييل ولوحة الإدارة.', 'Shown at the very top of every storefront page.': 'يظهر أعلى كل صفحة بالمتجر.', 'International format without +, e.g. 9647701234567': 'الصيغة الدولية بدون +، مثلاً 9647701234567', 'Used to calculate USD equivalents and to convert new USD purchase costs to IQD.': 'يستخدم لحساب ما يعادل الدولار وتحويل تكلفة الشراء الجديدة للدينار.', 'Colors at or below this count are flagged.': 'الألوان اللي مخزونها بهذا العدد أو أقل تتعلّم كمنخفضة.', 'Save settings': 'حفظ الإعدادات', 'Admin password': 'كلمة سر الإدارة', 'At least 8 characters.': '8 أحرف على الأقل.', 'Update password': 'تحديث كلمة السر',
  // integrations / team / activity / backup
  'Pixel ID': 'معرّف البكسل', 'Measurement ID': 'معرّف القياس', 'Project ID': 'معرّف المشروع',
  'Team & Permissions': 'الفريق والصلاحيات', 'Manage who can access the admin panel and exactly which sections they can view or manage.': 'حدد منو يدخل لوحة الإدارة وشنو الأقسام اللي يشوفها أو يعدلها.',
  'Activity Log': 'سجل النشاط', 'Track important actions performed in the administration panel.': 'تابع الإجراءات المهمة اللي صارت بلوحة الإدارة.', 'Audit trail': 'سجل التدقيق',
  'Create backup': 'إنشاء نسخة احتياطية', 'Restore backup': 'استعادة نسخة احتياطية', 'Backup policy': 'سياسة النسخ الاحتياطي',
};

/** Patterns for messages that contain data (place names, numbers). */
export const ADMIN_AR_PATTERNS: [RegExp, string][] = [
  [/^Order placed · cash on delivery · (.+)$/, 'تم استلام الطلب · الدفع عند الاستلام · $1'],
  [/^Manual order · (.+)$/, 'طلب يدوي · $1'],
  [/^Backup created \((\d+) tables\)$/, 'تم إنشاء نسخة احتياطية ($1 جدول)'],
  [/^(\d+) open$/, '$1 مفتوحة'],
  [/^Telegram (on|off) · WhatsApp (on|off) · Pixel (set|—) · GA4 (set|—) · Clarity (set|—)$/, 'تلكرام $1 · واتساب $2 · بكسل $3 · GA4 $4 · كلاريتي $5'],
    [/^No minimum · max (\d+) uses$/, 'بدون حد أدنى · أقصى $1 استخدام'],
  [/^Min order IQD ([\d,]+) · max (\d+) uses$/, 'حد أدنى IQD $1 · أقصى $2 استخدام'],
  [/^(\d+%) off$/, 'خصم $1'],
  [/^Min order IQD\s([\d,]+)$/, 'حد أدنى IQD $1'],
  [/^· max (\d+) uses$/, '· أقصى $1 استخدام'],
  [/^IQD\s([\d,]+) off$/, 'خصم IQD $1'],
];
