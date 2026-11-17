/**
 * Wholesale price list (Admin → Wholesale → Price list): the printable list handed to traders.
 * Everything on it is editable and saved in settings; product rows come from the catalogue
 * (products with a wholesale price). Safe to import in the browser.
 */

export type PriceTier = { title: string; subtitle: string; note: string };
export type PriceTerm = { label: string; text: string };
/** A row's name or prices changed on the list only (the product itself is not touched). */
export type PriceOverride = { nameAr?: string; nameEn?: string; wholesale?: number; retail?: number };
export type PriceListSettings = {
  englishName: string; brand: string; tagline: string; title: string; accent: string;
  rowMode: 'variant' | 'product';
  showImages: boolean; showEnglish: boolean; showRetail: boolean; showFixedNote: boolean; fixedNote: string;
  showProfit: boolean; showMargin: boolean; showQuantity: boolean; showStock: boolean;
  showTiers: boolean; tiersTitle: string; tiers: PriceTier[];
  showTerms: boolean; termsTitle: string; terms: PriceTerm[];
  showPolicy: boolean; policyTitle: string; policyText: string;
  footerLine: string; validityNote: string;
  /** Rows left off the list: "p:<productId>" or "v:<variantId>". */
  hidden: string[];
  /** Category titles shown on the list, by category id (empty = the category's Arabic name). */
  categoryTitles: Record<string, string>;
  overrides: Record<string, PriceOverride>;
};

export const defaultPriceList: PriceListSettings = {
  englishName: 'UR LEATHER', brand: 'أور للجلود', tagline: 'جلد طبيعي عراقي — إرث سومري بروح معاصرة', title: `قائمة أسعار الجملة — ${new Date().getFullYear()}`, accent: '#7a5a2b',
  rowMode: 'variant',
  showImages: true, showEnglish: true, showRetail: true, showFixedNote: true, fixedNote: 'سعر ثابت — غير قابل للتخفيض',
  showProfit: true, showMargin: true, showQuantity: false, showStock: true,
  showTiers: true, tiersTitle: 'شرائح الكميات',
  tiers: [
    { title: '10 — 24 قطعة', subtitle: 'سعر الجملة الأساسي', note: 'الحد الأدنى للطلب: 10 قطع' },
    { title: '25 — 49 قطعة', subtitle: 'خصم إضافي 5%', note: 'على إجمالي الفاتورة' },
    { title: '50 قطعة فأكثر', subtitle: 'خصم إضافي 10%', note: '+ أولوية بالموديلات الجديدة' },
  ],
  showTerms: true, termsTitle: 'شروط التعامل بالجملة',
  terms: [
    { label: 'الحد الأدنى للطلب', text: '10 قطع بالطلبية الواحدة (يمكن التنويع بين المنتجات).' },
    { label: 'الدفع', text: '50% مقدم عند تأكيد الطلب، و50% عند الاستلام.' },
    { label: 'التجهيز والتسليم', text: 'من 3 إلى 7 أيام عمل حسب الكمية، والتوصيل داخل العراق متوفر.' },
    { label: 'الاستبدال', text: 'أي قطعة فيها عيب مصنعي تُستبدل خلال 7 أيام من الاستلام.' },
    { label: 'العلامة التجارية', text: 'يُمنع إزالة شعار أور للجلود أو إعادة بيع المنتجات تحت اسم آخر.' },
  ],
  showPolicy: true, policyTitle: 'سياسة السعر الموحد — التزام إجباري',
  policyText: 'يلتزم التاجر بالبيع للمستهلك النهائي بسعر البيع الملزم المذكور بالجدول أعلاه، سواء بالمحل أو أونلاين. يُمنع البيع بأقل من السعر الملزم منعاً باتاً حفاظاً على قيمة البراند وحماية لأرباح جميع الموزعين. أي مخالفة لهذه السياسة تؤدي إلى إيقاف التزويد نهائياً.',
  footerLine: 'العراق، كركوك • ur-leather.shop',
  validityNote: 'هذه القائمة سارية حتى إشعار آخر — الأسعار بالدينار العراقي',
  hidden: [], categoryTitles: {}, overrides: {},
};

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max: number, fallback: string) => (typeof v === 'string' ? v.trim().slice(0, max) : fallback);

export function normalizePriceList(value: unknown, defaults = defaultPriceList): PriceListSettings {
  const r = isRecord(value) ? value : {};
  const out: PriceListSettings = { ...defaults, tiers: [...defaults.tiers], terms: [...defaults.terms], hidden: [...defaults.hidden], categoryTitles: { ...defaults.categoryTitles }, overrides: { ...defaults.overrides } };
  for (const k of ['englishName', 'brand', 'tagline', 'title', 'fixedNote', 'tiersTitle', 'termsTitle', 'policyTitle', 'footerLine', 'validityNote'] as const) out[k] = str(r[k], 200, defaults[k]);
  out.policyText = str(r.policyText, 1500, defaults.policyText);
  if (typeof r.accent === 'string' && /^#[0-9a-f]{6}$/i.test(r.accent)) out.accent = r.accent;
  if (r.rowMode === 'variant' || r.rowMode === 'product') out.rowMode = r.rowMode;
  for (const k of ['showImages', 'showEnglish', 'showRetail', 'showFixedNote', 'showProfit', 'showMargin', 'showQuantity', 'showStock', 'showTiers', 'showTerms', 'showPolicy'] as const) if (typeof r[k] === 'boolean') out[k] = r[k];
  if (Array.isArray(r.tiers)) out.tiers = r.tiers.filter(isRecord).slice(0, 6).map(t => ({ title: str(t.title, 60, ''), subtitle: str(t.subtitle, 80, ''), note: str(t.note, 120, '') }));
  if (Array.isArray(r.terms)) out.terms = r.terms.filter(isRecord).slice(0, 15).map(t => ({ label: str(t.label, 60, ''), text: str(t.text, 400, '') }));
  if (Array.isArray(r.hidden)) out.hidden = r.hidden.filter((h): h is string => typeof h === 'string' && /^[pv]:[\w-]{1,120}$/.test(h)).slice(0, 2000);
  if (isRecord(r.categoryTitles)) out.categoryTitles = Object.fromEntries(Object.entries(r.categoryTitles).filter(([k, v]) => /^[\w-]{1,80}$/.test(k) && typeof v === 'string').map(([k, v]) => [k, (v as string).trim().slice(0, 60)]).filter(([, v]) => v));
  if (isRecord(r.overrides)) {
    const price = (v: unknown) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x >= 0 && x <= 100_000_000 ? x : undefined; };
    out.overrides = Object.fromEntries(Object.entries(r.overrides).filter(([k, v]) => /^[pv]:[\w-]{1,120}$/.test(k) && isRecord(v)).slice(0, 2000).map(([k, v]) => {
      const o = v as Record<string, unknown>, next: PriceOverride = {};
      if (typeof o.nameAr === 'string' && o.nameAr.trim()) next.nameAr = o.nameAr.trim().slice(0, 120);
      if (typeof o.nameEn === 'string' && o.nameEn.trim()) next.nameEn = o.nameEn.trim().slice(0, 120);
      if (price(o.wholesale) !== undefined) next.wholesale = price(o.wholesale);
      if (price(o.retail) !== undefined) next.retail = price(o.retail);
      return [k, next];
    }).filter(([, v]) => Object.keys(v as object).length));
  }
  return out;
}

/** One line on the list: a colour of a product (or the product itself in "product" mode). */
export type PriceListRow = { key: string; productKey: string; categoryId: string; nameAr: string; nameEn: string; image: string | null; wholesale: number; retail: number; stock: number };
/** The row as shown on the list: the catalogue values with this list's own edits on top. */
export const applyOverride = (r: PriceListRow, o?: PriceOverride): PriceListRow => (o ? { ...r, ...o } : r);
export type PriceListCategory = { id: string; title: string };
export type PriceListData = { categories: PriceListCategory[]; rows: PriceListRow[]; productRows: PriceListRow[] };
