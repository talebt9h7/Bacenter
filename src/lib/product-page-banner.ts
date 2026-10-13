import { eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { invalidateSettings, SETTINGS_TAG } from './cache-tags';

/**
 * One image shown at the end of every product page (e.g. "Day 1 / Day 1000" leather ageing),
 * set in Admin → Content. A separate mobile image is optional.
 */
export type ProductPageBanner = { enabled: boolean; image: string; mobileImage: string; alt: string; altAr: string; href: string };
export const defaultProductPageBanner: ProductPageBanner = { enabled: false, image: '', mobileImage: '', alt: '', altAr: '', href: '' };
const KEY = 'productPageBanner';
const isImage = (v: unknown): v is string => typeof v === 'string' && v.length < 2000 && (/^\/(images|api\/media)\//.test(v) || /^https:\/\//.test(v));

export function cleanProductPageBanner(raw: unknown): ProductPageBanner {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const text = (x: unknown, max = 160) => typeof x === 'string' ? x.trim().slice(0, max) : '';
  const href = text(v.href, 300);
  return { enabled: v.enabled === true, image: isImage(v.image) ? v.image : '', mobileImage: isImage(v.mobileImage) ? v.mobileImage : '', alt: text(v.alt), altAr: text(v.altAr), href: /^(\/|https:\/\/)/.test(href) ? href : '' };
}
async function load() {
  const [row] = await db.select().from(settings).where(eq(settings.key, KEY));
  return cleanProductPageBanner(row?.value);
}
const cached = unstable_cache(load, ['product-page-banner-v1'], { revalidate: 300, tags: [SETTINGS_TAG] });
export async function getProductPageBanner() {
  try { return await cached(); } catch { return defaultProductPageBanner; }
}
export async function saveProductPageBanner(value: ProductPageBanner) {
  await db.insert(settings).values({ key: KEY, value, updatedAt: new Date() }).onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  invalidateSettings();
}
