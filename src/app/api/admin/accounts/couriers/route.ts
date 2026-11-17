import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { couriers } from '@/db/schema';
import { logActivity } from '@/lib/orders';
import { bad, canManage, failure, forbidden } from '../_shared';
import { courierInput } from './input';

export async function POST(request: NextRequest) {
  if (!(await canManage())) return forbidden();
  const input = courierInput(await request.json().catch(() => ({})));
  if ('error' in input) return bad(input.error);
  try {
    const [row] = await db.insert(couriers).values(input.value).returning();
    await logActivity('create', 'courier', row.id, row.name);
    return NextResponse.json({ courier: row }, { status: 201 });
  } catch (error) { return failure(error, 'ما انحفظت شركة التوصيل.'); }
}
