import { cleanBundleItems } from './bundles';

const slugify = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
/** Validates the bundle editor payload. */
export function parseBundle(raw: Record<string, unknown>) {
  const str = (v: unknown, max: number) => typeof v === 'string' ? v.trim().slice(0, max) : '';
  const name = str(raw.name, 120), nameAr = str(raw.nameAr, 120);
  if (!name && !nameAr) return { error: 'Give the bundle a name.' };
  const items = cleanBundleItems(raw.items);
  if (items.length < 2 && !(items.length === 1 && items[0].quantity > 1)) return { error: 'A bundle needs at least two items.' };
  const priceIqd = Math.round(Number(raw.priceIqd));
  if (!Number.isFinite(priceIqd) || priceIqd <= 0) return { error: 'Set the bundle price in IQD.' };
  const slug = slugify(str(raw.slug, 80) || name || nameAr) || `bundle-${Date.now()}`;
  const image = str(raw.image, 500);
  return { data: { slug, name: name || nameAr, nameAr: nameAr || name, description: str(raw.description, 600), descriptionAr: str(raw.descriptionAr, 600), image: /^(\/|https:\/\/)/.test(image) ? image : null, priceIqd, items, active: raw.active !== false, sortOrder: Number.isInteger(raw.sortOrder) ? Number(raw.sortOrder) : 0 } };
}
