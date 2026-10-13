import { unstable_cache } from 'next/cache';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/db';
import { promotions } from '@/db/schema';
import { CATALOG_TAG } from './cache-tags';
import { appliesTo, isLive, promotionalPrice } from './promotion-math';
export { appliesTo, isLive, promotionalPrice } from './promotion-math';
import type { AppliedPromotion, Product } from './types';

/**
 * Promotions (time-limited sales).
 * - percent: X% off the regular price (rounded to 250 IQD)
 * - amount:  X IQD off each unit
 * - price:   fixed sale price of X IQD (ignored if it isn't below the regular price)
 * When several promotions cover a product, the lowest resulting price wins. A promotion is live
 * when it is active and startsAt ≤ now < endsAt; this is checked on every read, so a sale starts
 * and stops exactly on time even though the list of promotions itself is cached.
 */
export type PromotionRecord = { id: number; name: string; nameAr: string; type: string; value: number; scope: string; categoryIds: string[]; productIds: string[]; startsAt: string; endsAt: string; active: boolean; showCountdown: boolean; badge: string; badgeAr: string };

export function serializePromotion(row: typeof promotions.$inferSelect): PromotionRecord {
  return { id: row.id, name: row.name, nameAr: row.nameAr, type: row.type, value: row.value, scope: row.scope, categoryIds: row.categoryIds ?? [], productIds: row.productIds ?? [], startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(), active: row.active, showCountdown: row.showCountdown, badge: row.badge, badgeAr: row.badgeAr };
}

async function loadUpcoming() {
  // Live and scheduled promotions only; expired ones never affect prices.
  const rows = await db.select().from(promotions).where(and(eq(promotions.active, true), gt(promotions.endsAt, new Date())));
  return rows.map(serializePromotion);
}
const cachedUpcoming = unstable_cache(loadUpcoming, ['promotions-upcoming-v1'], { revalidate: 60, tags: [CATALOG_TAG] });
export async function getUpcomingPromotions() {
  // A promotions problem must never take the shop down: fall back to regular prices.
  try { return await cachedUpcoming(); } catch (error) { console.error('Loading promotions failed; showing regular prices', error); return []; }
}

/** Best live promotion for a product, or null when none lowers its price. */
export function bestPromotion(product: { id: string; category: string; salePriceIqd: number }, promos: PromotionRecord[], now = Date.now()) {
  let best: { price: number; promo: PromotionRecord } | null = null;
  for (const promo of promos) {
    if (!isLive(promo, now) || !appliesTo(promo, product)) continue;
    const price = promotionalPrice(product.salePriceIqd, promo);
    if (price > 0 && price < product.salePriceIqd && (!best || price < best.price)) best = { price, promo };
  }
  if (!best) return null;
  const applied: AppliedPromotion = { id: best.promo.id, name: best.promo.name, nameAr: best.promo.nameAr || best.promo.name, badge: best.promo.badge, badgeAr: best.promo.badgeAr || best.promo.badge, endsAt: best.promo.endsAt, showCountdown: best.promo.showCountdown, percentOff: Math.round((1 - best.price / product.salePriceIqd) * 100) };
  return { price: best.price, regular: product.salePriceIqd, promotion: applied };
}

export function applyPromotions(products: Product[], promos: PromotionRecord[], now = Date.now()): Product[] {
  if (!promos.length) return products;
  return products.map(product => {
    const best = bestPromotion(product, promos, now);
    return best ? { ...product, salePriceIqd: best.price, originalPriceIqd: best.regular, promotion: best.promotion } : product;
  });
}
