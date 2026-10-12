/**
 * Structured, bilingual content for the product page (headline, highlights with icons,
 * features, specifications, dimensions, warranty, materials, lifestyle photos).
 *
 * Stored in products.details (jsonb). Products saved before this existed are read from
 * the older single-language columns (features, specifications, warranty, materials,
 * story_images, dimensions, dimensions_image) so nothing disappears from the storefront.
 * This file has no server imports: the admin editor and the storefront both use it.
 */

/** Icons a highlight can use. Keys are stored in the database; keep them stable. */
export const HIGHLIGHT_ICONS = {
  cards: { en: 'Cards', ar: 'بطاقات' },
  cash: { en: 'Notes / bills', ar: 'نقود ورقية' },
  coins: { en: 'Coins', ar: 'عملات معدنية' },
  rfid: { en: 'RFID protection', ar: 'حماية RFID' },
  slim: { en: 'Slim profile', ar: 'تصميم نحيف' },
  size: { en: 'Size', ar: 'المقاس' },
  leather: { en: 'Leather', ar: 'جلد' },
  handmade: { en: 'Handmade', ar: 'صناعة يدوية' },
  magnet: { en: 'Magnetic closure', ar: 'إغلاق مغناطيسي' },
  lock: { en: 'Secure', ar: 'أمان' },
  key: { en: 'Keys', ar: 'مفاتيح' },
  phone: { en: 'Phone', ar: 'هاتف' },
  laptop: { en: 'Laptop', ar: 'لابتوب' },
  water: { en: 'Water resistant', ar: 'مقاوم للماء' },
  weight: { en: 'Lightweight', ar: 'خفيف الوزن' },
  warranty: { en: 'Warranty', ar: 'ضمان' },
  gift: { en: 'Gift ready', ar: 'جاهز كهدية' },
  quick: { en: 'Quick access', ar: 'وصول سريع' },
} as const;
export type HighlightIcon = keyof typeof HIGHLIGHT_ICONS;
export const isHighlightIcon = (value: unknown): value is HighlightIcon => typeof value === 'string' && value in HIGHLIGHT_ICONS;

export type Highlight = { icon: HighlightIcon; text: string; textAr: string };
export type SpecRow = { label: string; labelAr: string; value: string; valueAr: string };
export type StoryItem = { image: string; caption: string; captionAr: string };
export type ProductDetails = {
  headline: string; headlineAr: string;
  highlights: Highlight[];
  features: string[]; featuresAr: string[];
  /** External size in centimetres; null when not entered. */
  lengthCm: number | null; widthCm: number | null; depthCm: number | null;
  weightG: number | null;
  dimensionsImage: string;
  specs: SpecRow[];
  warrantyMonths: number | null; warranty: string; warrantyAr: string;
  materials: string; materialsAr: string;
  story: StoryItem[];
};

export const LIMITS = { highlights: 10, features: 20, featureLength: 300, specs: 30, story: 20, text: 2000, headline: 160 } as const;

const str = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const list = (value: unknown, max: number, length: number) => Array.isArray(value) ? value.map(item => str(item, length)).filter(Boolean).slice(0, max) : [];
const positive = (value: unknown, max: number) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 10) / 10 : null;
};
const isImageUrl = (value: unknown): value is string => typeof value === 'string' && value.length < 2000 && (/^\/(images|api\/media)\//.test(value) || /^https?:\/\//.test(value));

/** Turns any stored or submitted value into a clean ProductDetails (also used to validate admin input). */
export function cleanDetails(raw: unknown): ProductDetails {
  const d = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const highlights = Array.isArray(d.highlights) ? d.highlights.flatMap(item => {
    const h = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const text = str(h.text, 120), textAr = str(h.textAr, 120);
    return text || textAr ? [{ icon: isHighlightIcon(h.icon) ? h.icon : 'quick', text, textAr }] : [];
  }).slice(0, LIMITS.highlights) : [];
  const specs = Array.isArray(d.specs) ? d.specs.flatMap(item => {
    const s = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const row = { label: str(s.label, 80), labelAr: str(s.labelAr, 80), value: str(s.value, 300), valueAr: str(s.valueAr, 300) };
    return (row.label || row.labelAr) && (row.value || row.valueAr) ? [row] : [];
  }).slice(0, LIMITS.specs) : [];
  const story = Array.isArray(d.story) ? d.story.flatMap(item => {
    const s = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return isImageUrl(s.image) ? [{ image: s.image, caption: str(s.caption, 60), captionAr: str(s.captionAr, 60) }] : [];
  }).slice(0, LIMITS.story) : [];
  return {
    headline: str(d.headline, LIMITS.headline), headlineAr: str(d.headlineAr, LIMITS.headline),
    highlights,
    features: list(d.features, LIMITS.features, LIMITS.featureLength), featuresAr: list(d.featuresAr, LIMITS.features, LIMITS.featureLength),
    lengthCm: positive(d.lengthCm, 500), widthCm: positive(d.widthCm, 500), depthCm: positive(d.depthCm, 500), weightG: positive(d.weightG, 100000),
    dimensionsImage: isImageUrl(d.dimensionsImage) ? d.dimensionsImage : '',
    specs,
    warrantyMonths: positive(d.warrantyMonths, 600) === null ? null : Math.round(Number(d.warrantyMonths)),
    warranty: str(d.warranty, LIMITS.text), warrantyAr: str(d.warrantyAr, LIMITS.text),
    materials: str(d.materials, LIMITS.text), materialsAr: str(d.materialsAr, LIMITS.text),
    story,
  };
}

const hasArabic = (text: string) => /[؀-ۿ]/.test(text);

/**
 * Builds the details for a product row. Uses products.details when it has been saved by the
 * new editor (it carries `v: 1`); otherwise maps the older columns, putting Arabic text in the
 * Arabic fields and English text in the English ones.
 */
export function detailsFromRow(row: { details?: unknown; features?: string[] | null; specifications?: string[] | null; warranty?: string | null; materials?: string | null; storyImages?: string[] | null; dimensions?: string | null; dimensionsImage?: string | null }): ProductDetails {
  const stored = row.details && typeof row.details === 'object' ? row.details as Record<string, unknown> : null;
  if (stored && stored.v === 1) return cleanDetails(stored);
  const features = row.features ?? [];
  const specs: SpecRow[] = (row.specifications ?? []).map(spec => {
    const at = spec.indexOf(':');
    const label = at >= 0 ? spec.slice(0, at).trim() : '';
    const value = at >= 0 ? spec.slice(at + 1).trim() : spec.trim();
    return hasArabic(spec) ? { label: '', labelAr: label || 'تفاصيل', value: '', valueAr: value } : { label: label || 'Detail', labelAr: '', value, valueAr: '' };
  });
  if (row.dimensions) specs.unshift(hasArabic(row.dimensions) ? { label: '', labelAr: 'الأبعاد', value: '', valueAr: row.dimensions } : { label: 'Dimensions', labelAr: 'الأبعاد', value: row.dimensions, valueAr: row.dimensions });
  const warranty = row.warranty ?? '', materials = row.materials ?? '';
  return cleanDetails({
    features: features.filter(f => !hasArabic(f)), featuresAr: features.filter(hasArabic),
    specs,
    // A bare number in the old warranty field was meant as months.
    warrantyMonths: /^\d+$/.test(warranty.trim()) ? Number(warranty.trim()) : null,
    warranty: /^\d+$/.test(warranty.trim()) || hasArabic(warranty) ? '' : warranty,
    warrantyAr: hasArabic(warranty) ? warranty : '',
    materials: hasArabic(materials) ? '' : materials, materialsAr: hasArabic(materials) ? materials : '',
    dimensionsImage: row.dimensionsImage ?? '',
    story: (row.storyImages ?? []).map(image => ({ image, caption: '', captionAr: '' })),
  });
}

/** Picks the text for the current language, falling back to the other language. */
export function pick(language: 'ar' | 'en' | string, en: string, ar: string) {
  return language === 'ar' ? (ar || en) : (en || ar);
}
export function pickList(language: 'ar' | 'en' | string, en: string[], ar: string[]) {
  return language === 'ar' ? (ar.length ? ar : en) : (en.length ? en : ar);
}

const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1);
/** "11.5 × 8 × 1.5 cm" — only the measurements that were entered. */
export function formatDimensions(d: ProductDetails, language: string) {
  const parts = [d.lengthCm, d.widthCm, d.depthCm].filter((n): n is number => n !== null).map(fmt);
  if (!parts.length) return '';
  return `${parts.join(' × ')} ${language === 'ar' ? 'سم' : 'cm'}`;
}
export function formatWeight(d: ProductDetails, language: string) {
  if (d.weightG === null) return '';
  return d.weightG >= 1000 ? `${fmt(d.weightG / 1000)} ${language === 'ar' ? 'كغم' : 'kg'}` : `${fmt(d.weightG)} ${language === 'ar' ? 'غم' : 'g'}`;
}
export function formatWarranty(months: number | null, language: string) {
  if (!months) return '';
  if (months % 12 === 0) { const y = months / 12; return language === 'ar' ? (y === 1 ? 'سنة واحدة' : y === 2 ? 'سنتان' : `${y} سنوات`) : `${y}-year`; }
  return language === 'ar' ? `${months} ${months <= 10 ? 'أشهر' : 'شهراً'}` : `${months}-month`;
}
