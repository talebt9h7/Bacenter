import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { couriers } from '@/db/schema';
import { logActivity } from '@/lib/orders';
import { bad, canManage, failure, forbidden } from '../../_shared';
import { courierInput } from '../input';

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, { params }: Context) {
  if (!(await canManage())) return forbidden();
  const id = Number((await params).id);
  const input = courierInput(await request.json().catch(() => ({})));
  if ('error' in input) return bad(input.error);
  try {
    const [row] = await db.update(couriers).set(input.value).where(eq(couriers.id, id)).returning();
    if (!row) return bad('الشركة غير موجودة.');
    await logActivity('update', 'courier', id, `${row.name} · أجور ${row.defaultFeeIqd} · إرجاع ${row.returnFeeIqd}`);
    return NextResponse.json({ courier: row });
  } catch (error) { return failure(error, 'ما انحفظت شركة التوصيل.'); }
}
