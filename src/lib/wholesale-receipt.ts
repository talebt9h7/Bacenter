/** Shared, serializable receipt configuration. This module is safe to import in the browser. */
export const receiptLabelDefaults = {
  reference: 'رقم الفاتورة', date: 'التاريخ', trader: 'التاجر', phone: 'الهاتف', shop: 'المحل', city: 'المدينة', payment: 'طريقة الدفع',
  image: 'الصورة', product: 'المنتج', sku: 'رمز المنتج', quantity: 'الكمية', wholesale: 'سعر الجملة', retail: 'سعر المفرد', profit: 'ربح التاجر', margin: 'النسبة', lineTotal: 'الإجمالي',
  subtotal: 'المجموع قبل الخصم', discount: 'الخصم', total: 'إجمالي الفاتورة', paid: 'المقبوض', remaining: 'المتبقي', units: 'عدد القطع', note: 'ملاحظات',
  cash: 'نقد', credit: 'آجل', receiver: 'توقيع المستلم', issuer: 'توقيع وختم المتجر',
};
export type ReceiptLabel = keyof typeof receiptLabelDefaults;
export type WholesaleReceiptSettings = {
  brand: string; englishName: string; tagline: string; title: string; logoUrl: string; phone: string; address: string;
  footer: string; terms: string; currency: string; accent: string; paper: 'a4' | 'thermal'; density: 'comfortable' | 'compact';
  showLogo: boolean; showImages: boolean; showSku: boolean; showRetail: boolean; showProfit: boolean; showMargin: boolean;
  showPayments: boolean; showNote: boolean; showSignatures: boolean; showTraderPhone: boolean; showShop: boolean; showCity: boolean;
  labels: Record<ReceiptLabel, string>;
};
export const defaultWholesaleReceipt: WholesaleReceiptSettings = {
  brand: 'أور للجلود', englishName: 'UR LEATHER', tagline: 'جلد طبيعي · صناعة يدوية', title: 'فاتورة بيع بالجملة', logoUrl: '/images/UR-logo.svg', phone: '', address: '',
  footer: 'شكراً لثقتكم بأور للجلود.', terms: 'أسعار البيع للمستهلك كما هو موضح في الفاتورة.', currency: 'د.ع', accent: '#76533b', paper: 'a4', density: 'comfortable',
  showLogo: true, showImages: true, showSku: false, showRetail: true, showProfit: false, showMargin: false, showPayments: true, showNote: true, showSignatures: true, showTraderPhone: true, showShop: true, showCity: true,
  labels: receiptLabelDefaults,
};
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function normalizeReceiptSettings(value: unknown, defaults = defaultWholesaleReceipt): WholesaleReceiptSettings {
  const raw = isRecord(value) ? value : {}, next = { ...defaults, labels: { ...defaults.labels } };
  const short = ['brand', 'englishName', 'tagline', 'title', 'phone', 'address', 'currency'] as const;
  for (const key of short) if (typeof raw[key] === 'string') next[key] = raw[key].trim().slice(0, key === 'address' ? 300 : key === 'currency' ? 12 : 160);
  for (const key of ['footer', 'terms'] as const) if (typeof raw[key] === 'string') next[key] = raw[key].trim().slice(0, 1000);
  if (typeof raw.logoUrl === 'string') { const url = raw.logoUrl.trim().slice(0, 2000); next.logoUrl = !url || /^\/(?:api\/media|images)\//.test(url) || /^https:\/\//i.test(url) ? url : defaults.logoUrl; }
  if (typeof raw.accent === 'string' && /^#[0-9a-f]{6}$/i.test(raw.accent)) next.accent = raw.accent;
  if (raw.paper === 'a4' || raw.paper === 'thermal') next.paper = raw.paper;
  if (raw.density === 'comfortable' || raw.density === 'compact') next.density = raw.density;
  for (const key of ['showLogo','showImages','showSku','showRetail','showProfit','showMargin','showPayments','showNote','showSignatures','showTraderPhone','showShop','showCity'] as const) if (typeof raw[key] === 'boolean') next[key] = raw[key];
  if (isRecord(raw.labels)) for (const key of Object.keys(receiptLabelDefaults) as ReceiptLabel[]) if (typeof raw.labels[key] === 'string' && raw.labels[key].trim()) next.labels[key] = raw.labels[key].trim().slice(0, 80);
  return next;
}
export const receiptPreviewInvoice = {
  id: 0, reference: 'UR-W-PREVIEW', name: 'اسم التاجر', phone: '07XXXXXXXXX', city: 'بغداد', shop: 'اسم المحل', payment: 'credit' as const, status: 'delivered', paymentStatus: 'partial',
  subtotal: 90000, discount: 5000, total: 85000, paid: 30000, remaining: 55000, profit: 0, createdAt: '2026-01-01T09:00:00.000Z', updatedAt: '2026-01-01T09:00:00.000Z', note: 'ملاحظة توضيحية تظهر على الوصل.',
  items: [{ productId: 'craft', variantId: 0, name: 'Craft wallet', nameAr: 'محفظة كرافت', color: 'Brown', colorAr: 'بني', quantity: 3, unitPrice: 30000, listPrice: 35000, image: null }], payments: [],
};
