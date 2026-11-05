import { unstable_cache } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { SETTINGS_TAG, invalidateSettings } from './cache-tags';

/**
 * Homepage "ring": products turning slowly on a circle, set in Admin → Homepage.
 * Each item is a product plus an optional cut-out picture (transparent PNG); without one the
 * product's first photo is used.
 */
export type HeroRing = { enabled: boolean; secondsPerTurn: number; items: { productId: string; image: string }[] };
export const defaultHeroRing: HeroRing = { enabled: false, secondsPerTurn: 28, items: [] };
export const RING_LIMITS = { minSeconds: 10, maxSeconds: 90, maxItems: 10 };
const KEY = 'heroRing';

export function normalizeHeroRing(value: unknown): HeroRing {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<HeroRing>;
  const seconds = Math.round(Number(v.secondsPerTurn));
  return {
    enabled: v.enabled === true,
    secondsPerTurn: Number.isFinite(seconds) ? Math.min(RING_LIMITS.maxSeconds, Math.max(RING_LIMITS.minSeconds, seconds)) : defaultHeroRing.secondsPerTurn,
    items: (Array.isArray(v.items) ? v.items : [])
      .map(item => ({ productId: String(item?.productId ?? '').trim().slice(0, 120), image: String(item?.image ?? '').trim().slice(0, 500) }))
      .filter(item => item.productId && (!item.image || item.image.startsWith('/') || /^https:\/\//.test(item.image)))
      .slice(0, RING_LIMITS.maxItems),
  };
}

export const getHeroRing = unstable_cache(async (): Promise<HeroRing> => {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, KEY));
    return normalizeHeroRing(row?.value);
  } catch { return defaultHeroRing; }
}, ['hero-ring-v1'], { revalidate: 300, tags: [SETTINGS_TAG] });

export async function saveHeroRing(next: HeroRing) {
  const value = normalizeHeroRing(next);
  await db.insert(settings).values({ key: KEY, value, updatedAt: new Date() }).onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  invalidateSettings();
  return value;
}
