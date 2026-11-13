import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { orders } from '@/db/schema';

/** Face value of orders placed in the period, not receipts or recognized revenue. */
export async function paymentSummary(from: Date, to: Date) {
  const rows = await db.select({ status: orders.paymentStatus, count: sql<number>`count(*)`.mapWith(Number), total: sql<number>`coalesce(sum(${orders.totalCents}), 0)`.mapWith(Number) })
    .from(orders).where(and(gte(orders.createdAt, from), lte(orders.createdAt, to))).groupBy(orders.paymentStatus);
  const keys = [...new Set(['paid', 'unpaid', 'refunded', 'partial', ...rows.map(r => r.status)])];
  return keys.map(status => rows.find(r => r.status === status) ?? { status, count: 0, total: 0 });
}

/** Paid order values, grouped by recorded method; dates refer to order creation. */
export async function paymentMethodSummary(from: Date, to: Date) {
  const rows = await db.select({
    method: orders.paymentMethod,
    count: sql<number>`count(*)`.mapWith(Number),
    customers: sql<number>`count(distinct coalesce(nullif(trim(${orders.phone}), ''), nullif(lower(trim(${orders.email})), '')))`.mapWith(Number),
    total: sql<number>`coalesce(sum(${orders.totalCents}), 0)`.mapWith(Number),
  }).from(orders).where(and(eq(orders.paymentStatus, 'paid'), gte(orders.createdAt, from), lte(orders.createdAt, to))).groupBy(orders.paymentMethod);
  const methods = [...new Set(['cash', 'bank_transfer', 'electronic', 'cod', ...rows.map(r => r.method)])];
  return methods.map(method => rows.find(r => r.method === method) ?? { method, count: 0, customers: 0, total: 0 });
}
