import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import { db } from '@/db';
import { couriers, orders } from '@/db/schema';
import { courierFee } from '@/lib/accounts-rules';
import { clearMemo } from '@/lib/memo-cache';
import { logActivity } from '@/lib/orders';
import { bad, canManage, failure, forbidden } from '../_shared';

/** Puts delivery orders that have no delivery company on one, with that company's fee for each. */
export async function POST(request: NextRequest) {
  if (!(await canManage())) return forbidden();
  const body = await request.json().catch(() => ({}));
  const courierId = Number(body.courierId);
  const ids = Array.isArray(body.orderIds) ? body.orderIds.map(Number).filter((n: number) => Number.isInteger(n) && n > 0) : [];
  if (!Number.isInteger(courierId) || !ids.length) return bad('اختر الشركة والطلبات.');
  try {
    const [courier] = await db.select().from(couriers).where(eq(couriers.id, courierId));
    if (!courier) return bad('الشركة غير موجودة.');
    const rows = await db.select({ id: orders.id, status: orders.status, governorate: orders.governorate, courierFeeIqd: orders.courierFeeIqd }).from(orders)
      .where(and(inArray(orders.id, ids), isNull(orders.courierId), isNull(orders.settlementId), eq(orders.fulfillment, 'courier'), ne(orders.source, 'wholesale')));
    for (const o of rows) {
      const fee = o.courierFeeIqd ?? (o.status === 'returned' ? courier.returnFeeIqd : o.status === 'delivered' ? courierFee(courier, o.governorate) : null);
      await db.update(orders).set({ courierId, courierFeeIqd: fee, updatedAt: new Date() }).where(eq(orders.id, o.id));
    }
    clearMemo('stats:');
    await logActivity('update', 'order', undefined, `ربط ${rows.length} طلب بشركة ${courier.name}`);
    return NextResponse.json({ updated: rows.length });
  } catch (error) { return failure(error, 'ما انربطت الطلبات.'); }
}
