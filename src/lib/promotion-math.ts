/** Pure promotion maths, safe to use in the browser (the admin editor preview) and on the server. */
import { roundIqd } from './iraq';

export type PromotionShape = { active: boolean; startsAt: string; endsAt: string; scope: string; categoryIds: string[]; productIds: string[] };

export function isLive(promo: Pick<PromotionShape, 'active' | 'startsAt' | 'endsAt'>, now = Date.now()) {
  return promo.active && new Date(promo.startsAt).getTime() <= now && now < new Date(promo.endsAt).getTime();
}
export function appliesTo(promo: Pick<PromotionShape, 'scope' | 'categoryIds' | 'productIds'>, product: { id: string; category: string }) {
  if (promo.scope === 'all') return true;
  if (promo.scope === 'categories') return promo.categoryIds.includes(product.category);
  return promo.productIds.includes(product.id);
}
export function promotionalPrice(base: number, promo: { type: string; value: number }) {
  if (base <= 0) return base;
  if (promo.type === 'percent') return Math.min(base, roundIqd(base * (1 - Math.min(promo.value, 95) / 100)));
  if (promo.type === 'amount') return Math.max(0, base - promo.value);
  return promo.value < base ? promo.value : base;
}

