import { NextResponse } from 'next/server';
import { and, eq, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { orders, productVariants, products, reviews, supportMessages } from '@/db/schema';
import { getAdminActor } from '@/lib/admin-auth';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
/** Counts for the sidebar badges: what needs the shop's attention right now. */
export async function GET() {
  if (!(await getAdminActor())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { lowStockThreshold } = await getSettings();
  const count = sql<number>`count(*)::int`;
  const [[pending], [messages], [pendingReviews], [lowStock]] = await Promise.all([
    db.select({ n: count }).from(orders).where(eq(orders.status, 'pending')),
    db.select({ n: count }).from(supportMessages).where(eq(supportMessages.status, 'open')),
    db.select({ n: count }).from(reviews).where(eq(reviews.status, 'pending')),
    db.select({ n: count }).from(productVariants).innerJoin(products, eq(products.id, productVariants.productId)).where(and(eq(products.published, true), lte(productVariants.stock, lowStockThreshold))),
  ]);
  return NextResponse.json({ pendingOrders: pending?.n ?? 0, openMessages: messages?.n ?? 0, pendingReviews: pendingReviews?.n ?? 0, lowStock: lowStock?.n ?? 0 }, { headers: { 'Cache-Control': 'no-store' } });
}
