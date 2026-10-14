import { and, desc, eq, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db';
import { orders, reviews } from '@/db/schema';
import { CATALOG_TAG } from './cache-tags';
import { normalizeIraqPhone } from './iraq';

/** Customer reviews: shown only after approval in Admin → Reviews; "verified" means the phone bought this product. */
export type PublicReview = { id: number; name: string; city: string; rating: number; title: string; body: string; verified: boolean; reply: string; createdAt: string };
export type ReviewSummary = { count: number; average: number; distribution: number[]; reviews: PublicReview[] };
const EMPTY: ReviewSummary = { count: 0, average: 0, distribution: [0, 0, 0, 0, 0], reviews: [] };

async function load(productId: string): Promise<ReviewSummary> {
  const rows = await db.select().from(reviews).where(and(eq(reviews.productId, productId), eq(reviews.status, 'approved'))).orderBy(desc(reviews.verified), desc(reviews.createdAt)).limit(200);
  if (!rows.length) return EMPTY;
  const distribution = [0, 0, 0, 0, 0];
  for (const r of rows) distribution[r.rating - 1]++;
  return { count: rows.length, average: Math.round(rows.reduce((s, r) => s + r.rating, 0) / rows.length * 10) / 10, distribution, reviews: rows.map(r => ({ id: r.id, name: r.name, city: r.city, rating: r.rating, title: r.title, body: r.body, verified: r.verified, reply: r.reply, createdAt: r.createdAt.toISOString() })) };
}
const cached = unstable_cache(load, ['product-reviews-v1'], { revalidate: 300, tags: [CATALOG_TAG] });
export async function getProductReviews(productId: string): Promise<ReviewSummary> {
  try { return await cached(productId); } catch (error) { console.error('Loading reviews failed', error); return EMPTY; }
}

/** The delivered order (if any) in which this phone bought this product. */
export async function findPurchase(phone: string, productId: string) {
  const p = normalizeIraqPhone(phone);
  if (!p) return null;
  const [row] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.phone, p), eq(orders.status, 'delivered'), sql`exists (select 1 from jsonb_array_elements(${orders.items}) i where i->>'productId' = ${productId})`)).orderBy(desc(orders.createdAt)).limit(1);
  return row?.id ?? null;
}
