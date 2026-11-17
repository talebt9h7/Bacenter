import { NextRequest, NextResponse } from 'next/server';
import { deleteSettlement } from '@/lib/accounts';
import { logActivity } from '@/lib/orders';
import { canManage, failure, forbidden } from '../../_shared';

type Context = { params: Promise<{ id: string }> };
export async function DELETE(_request: NextRequest, { params }: Context) {
  if (!(await canManage())) return forbidden();
  const id = Number((await params).id);
  try {
    const s = await deleteSettlement(id);
    await logActivity('delete', 'settlement', id, `كشف محذوف · مستلم ${s.receivedIqd} · ${s.account}`);
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error, 'ما انحذف الكشف.'); }
}
