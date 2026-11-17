import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { moneyMovements } from '@/db/schema';
import { clearMemo } from '@/lib/memo-cache';
import { logActivity } from '@/lib/orders';
import { canManage, failure, forbidden } from '../../_shared';

type Context = { params: Promise<{ id: string }> };
export async function DELETE(_request: NextRequest, { params }: Context) {
  if (!(await canManage())) return forbidden();
  const id = Number((await params).id);
  try {
    const [row] = await db.delete(moneyMovements).where(eq(moneyMovements.id, id)).returning();
    clearMemo('stats:');
    if (row) await logActivity('delete', 'money_movement', id, `${row.kind} · ${row.amountIqd} · ${row.fromAccount ?? ''} → ${row.toAccount ?? ''}`);
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error, 'ما انحذفت الحركة.'); }
}
