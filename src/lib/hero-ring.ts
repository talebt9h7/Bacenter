import { unstable_cache } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { SETTINGS_TAG, invalidateSettings } from './cache-tags';

/**
 * Homepage "ring": products turning slowly on a tilted circle, set in Admin → Homepage.
 * Each item is a product plus its ring picture: a cut-out made in the admin (transparent WebP),
 * or, while it has none, the product's first photo shown as a card.
 */
export type HeroRingItem = { productId: string; image: string; cut?: boolean };
export type HeroRingHeading = { show: boolean; eyebrow: string; eyebrowAr: string; title: string; titleAr: string; subtitle: string; subtitleAr: string; cta: string; ctaAr: string; href: string };
export type HeroRing = { enabled: boolean; secondsPerTurn: number; items: HeroRingItem[]; heading: HeroRingHeading; caption: boolean };

export const defaultRingHeading: HeroRingHeading = {
  show: true,
  eyebrow: 'Handmade · 100% natural leather',
  eyebrowAr: 'صناعة يدوية · جلد طبيعي 100%',
  title: 'UR Leather',
  titleAr: 'أور للجلود',
  subtitle: 'Sumerian heritage, made for today',
  subtitleAr: 'إرث سومري بروح معاصرة',
  cta: 'Shop all',
  ctaAr: 'تسوق الكل',
  href: '/products/category/all',
};
export const defaultHeroRing: HeroRing = { enabled: false, secondsPerTurn: 28, items: [], heading: defaultRingHeading, caption: false };
export const RING_LIMITS = { minSeconds: 10, maxSeconds: 90, maxItems: 10 };
const KEY = 'heroRing';

const text = (value: unknown, max: number, fallback: string) => (typeof value === 'string' ? value.trim().slice(0, max) : fallback);
const safeUrl = (value: string) => !value || value.startsWith('/') || /^https:\/\//.test(value);

export function normalizeHeroRing(value: unknown): HeroRing {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<HeroRing>;
  const seconds = Math.round(Number(v.secondsPerTurn));
  const h = (v.heading && typeof v.heading === 'object' ? v.heading : {}) as Partial<HeroRingHeading>;
  const d = defaultRingHeading;
  const href = text(h.href, 300, d.href);
  return {
    enabled: v.enabled === true,
    secondsPerTurn: Number.isFinite(seconds) ? Math.min(RING_LIMITS.maxSeconds, Math.max(RING_LIMITS.minSeconds, seconds)) : defaultHeroRing.secondsPerTurn,
    items: (Array.isArray(v.items) ? v.items : [])
      .map(item => {
        const next: HeroRingItem = { productId: String(item?.productId ?? '').trim().slice(0, 120), image: String(item?.image ?? '').trim().slice(0, 500) };
        if (next.image && typeof item?.cut === 'boolean') next.cut = item.cut;
        return next;
      })
      .filter(item => item.productId && safeUrl(item.image))
      .slice(0, RING_LIMITS.maxItems),
    heading: {
      show: typeof h.show === 'boolean' ? h.show : d.show,
      eyebrow: text(h.eyebrow, 80, d.eyebrow), eyebrowAr: text(h.eyebrowAr, 80, d.eyebrowAr),
      title: text(h.title, 80, d.title), titleAr: text(h.titleAr, 80, d.titleAr),
      subtitle: text(h.subtitle, 160, d.subtitle), subtitleAr: text(h.subtitleAr, 160, d.subtitleAr),
      cta: text(h.cta, 40, d.cta), ctaAr: text(h.ctaAr, 40, d.ctaAr),
      href: href && safeUrl(href) ? href : d.href,
    },
    caption: v.caption === true,
  };
}

export const getHeroRing = unstable_cache(async (): Promise<HeroRing> => {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, KEY));
    return normalizeHeroRing(row?.value);
  } catch { return defaultHeroRing; }
}, ['hero-ring-v2'], { revalidate: 300, tags: [SETTINGS_TAG] });

export async function saveHeroRing(next: HeroRing) {
  const value = normalizeHeroRing(next);
  await db.insert(settings).values({ key: KEY, value, updatedAt: new Date() }).onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  invalidateSettings();
  return value;
}

/** What the storefront ring shows for one item (built on the server from the settings above). */
export type RingItem = { id: string; name: string; nameAr: string; priceIqd: number; priceVaries: boolean; href: string; image: string; cutout: boolean };
export type RingView = { items: RingItem[]; secondsPerTurn: number; heading: HeroRingHeading; caption: boolean };
