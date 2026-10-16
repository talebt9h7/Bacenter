/**
 * What a product needs before it can go live on the storefront. Shared by the product editor
 * (shown as a checklist) and the save API (enforced when a product is published for the first time).
 */
export type ChecklistInput = { name: string; nameAr?: string; salePriceIqd: number; description?: string; descriptionAr?: string; featuresAr?: string[]; features?: string[]; colors: { name: string; images: string[]; stock: number }[] };
export type ChecklistItem = { key: 'names' | 'price' | 'colors' | 'images' | 'stock' | 'details'; ok: boolean; en: string; ar: string };

const hasArabic = (v?: string) => !!v && /[؀-ۿ]/.test(v);

export function publishChecklist(p: ChecklistInput): ChecklistItem[] {
  const noPhoto = p.colors.filter(c => !c.images.length).map(c => c.name);
  const stock = p.colors.reduce((s, c) => s + (Number(c.stock) || 0), 0);
  const hasDetails = !!(p.descriptionAr?.trim() || p.description?.trim() || p.featuresAr?.some(f => f.trim()) || p.features?.some(f => f.trim()));
  return [
    { key: 'names', ok: !!p.name.trim() && hasArabic(p.nameAr), en: 'Name in English and Arabic', ar: 'الاسم بالعربي والإنجليزي' },
    { key: 'price', ok: Number(p.salePriceIqd) > 0, en: 'Sale price', ar: 'سعر البيع' },
    { key: 'colors', ok: p.colors.length > 0 && p.colors.every(c => c.name.trim()), en: 'At least one named colour', ar: 'لون واحد على الأقل باسمه' },
    { key: 'images', ok: p.colors.length > 0 && !noPhoto.length, en: noPhoto.length ? `Photos for every colour (missing: ${noPhoto.join(', ')})` : 'Photos for every colour', ar: noPhoto.length ? `صور لكل لون (ناقص: ${noPhoto.join('، ')})` : 'صور لكل لون' },
    { key: 'stock', ok: stock > 0, en: 'Stock above zero', ar: 'مخزون أكثر من صفر' },
    { key: 'details', ok: hasDetails, en: 'Description or features', ar: 'وصف أو مميزات المنتج' },
  ];
}

export class NotReadyError extends Error {
  constructor(public missing: ChecklistItem[]) { super('NOT_READY'); }
}
