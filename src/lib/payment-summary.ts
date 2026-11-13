import { and, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { orders } from '@/db/schema';

/** Face value of orders placed in the period, not receipts or recognized revenue. */
export async function paymentSummary(from: Date, to: Date) {
  const rows = await db.select({ status: orders.paymentStatus, count: sql<number>`count(*)`.mapWith(Number), total: sql<number>`coalesce(sum(${orders.totalCents}), 0)`.mapWith(Number) })
    .from(orders).where(and(gte(orders.createdAt, from), lte(orders.createdAt, to))).groupBy(orders.paymentStatus);
  const keys = [...new Set(['paid', 'unpaid', 'refunded', 'partial', ...rows.map(r => r.status)])];
  return keys.map(status => rows.find(r => r.status === status) ?? { status, count: 0, total: 0 });
}
