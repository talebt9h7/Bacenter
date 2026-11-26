import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/admin-auth';
import { logActivity } from '@/lib/activity-log';
import { orderWithEvents, partialDeliver } from '@/lib/orders';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

const MESSAGES: Record<string, string> = {
  NOT_FOUND: 'الطلب غير موجود.',
  NOT_PARTIAL_RETURNABLE: 'التسليم الجزئي للطلبات المؤكدة أو قيد التجهيز أو بالطريق فقط.',
  INVALID_QUANTITIES: 'الكميات غير صحيحة.',
  NOTHING_KEPT: 'إذا الزبون رجّع كل المنتجات، حوّل الطلب إلى مرتجع.',
  NOTHING_RETURNED: 'الزبون استلم كل المنتجات؛ حوّل الطلب إلى تم التوصيل.',
};

/** Partial delivery: `received` is the kept quantity for each order line, in order. */
export async function POST(request: NextRequest, { params }: Context) {
  const session = await requireAdminSection('sales', 'manage');
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { received?: unknown; note?: unknown };
  const received = Array.isArray(body.received) ? body.received.map(Number) : [];
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';
  try {
    await partialDeliver(Number(id), received, note || undefined);
    const data = await orderWithEvents(Number(id));
    const returned = ((data?.order?.returnedItems ?? []) as { name: string; color: string; quantity: number }[]).map(r => `${r.name} (${r.color}) ×${r.quantity}`).join(', ');
    await logActivity(session, 'partial_return', 'order', id, `${data?.order?.reference ?? id} · returned: ${returned}`);
    return NextResponse.json(data);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (MESSAGES[code]) return NextResponse.json({ error: MESSAGES[code] }, { status: 400 });
    console.error('Partial return failed', error);
    return NextResponse.json({ error: 'تعذر حفظ التسليم الجزئي.' }, { status: 500 });
  }
}
