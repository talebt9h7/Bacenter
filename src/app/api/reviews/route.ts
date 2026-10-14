import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { products, reviews } from '@/db/schema';
import { findPurchase } from '@/lib/reviews';
import { iraqPhonePattern, normalizeIraqPhone } from '@/lib/iraq';

export const dynamic = 'force-dynamic';
/** A customer submits a review. It waits for approval in the admin before it is shown. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const str = (v: unknown, max: number) => typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '';
  const productId = str(body.productId, 80), name = str(body.name, 60), city = str(body.city, 60), title = str(body.title, 100);
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 1500) : '';
  const phone = normalizeIraqPhone(str(body.phone, 30));
  const rating = Number(body.rating);
  if (typeof body.website === 'string' && body.website) return NextResponse.json({ ok: true }); // honeypot
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: 'Choose a rating from 1 to 5 stars.' }, { status: 400 });
  if (name.length < 2) return NextResponse.json({ error: 'Please write your name.' }, { status: 400 });
  if (text.length < 5) return NextResponse.json({ error: 'Please write a few words about the product.' }, { status: 400 });
  if (phone && !iraqPhonePattern.test(phone)) return NextResponse.json({ error: 'The phone number should be an Iraqi mobile (07…).' }, { status: 400 });
  const [product] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.published, true)));
  if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  // Light flood protection: at most 20 pending reviews per product per day, one per phone per product.
  const [{ recent }] = await db.select({ recent: sql<number>`count(*)::int` }).from(reviews).where(and(eq(reviews.productId, productId), eq(reviews.status, 'pending'), gte(reviews.createdAt, sql`now() - interval '1 day'`)));
  if (recent >= 20) return NextResponse.json({ error: 'Too many reviews right now. Please try again later.' }, { status: 429 });
  if (phone) {
    const [dup] = await db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.productId, productId), eq(reviews.phone, phone)));
    if (dup) return NextResponse.json({ error: 'You have already reviewed this product. Thank you!' }, { status: 409 });
  }
  const orderId = phone ? await findPurchase(phone, productId) : null;
  await db.insert(reviews).values({ productId, name, city, phone, rating, title, body: text, orderId, verified: Boolean(orderId), status: 'pending' });
  return NextResponse.json({ ok: true, verified: Boolean(orderId) }, { status: 201 });
}
