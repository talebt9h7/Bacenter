import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { reviews } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { findPurchase } from '@/lib/reviews';
import { normalizeIraqPhone } from '@/lib/iraq';
import { invalidateCatalog } from '@/lib/cache-tags';
import { logActivity } from '@/lib/orders';

export const dynamic = 'force-dynamic';
/** Adds a review the customer sent another way (WhatsApp, Instagram). Verified only if the phone bought the product. */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('sales', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const str = (v: unknown, max: number) => typeof v === 'string' ? v.trim().slice(0, max) : '';
  const productId = str(body.productId, 80), name = str(body.name, 60), text = str(body.body, 1500), phone = normalizeIraqPhone(str(body.phone, 30));
  const rating = Number(body.rating);
  if (!productId || name.length < 2 || text.length < 3 || !Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: 'Choose the product, the rating, the customer name and the review text.' }, { status: 400 });
  const orderId = phone ? await findPurchase(phone, productId) : null;
  const [row] = await db.insert(reviews).values({ productId, name, city: str(body.city, 60), phone, rating, title: str(body.title, 100), body: text, orderId, verified: Boolean(orderId), status: body.approve === false ? 'pending' : 'approved' }).returning({ id: reviews.id });
  invalidateCatalog();
  await logActivity('create', 'review', row.id, `${name} · ${rating}★`);
  return NextResponse.json({ ok: true, id: row.id, verified: Boolean(orderId) }, { status: 201 });
}
