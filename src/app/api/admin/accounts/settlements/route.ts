import { NextRequest, NextResponse } from 'next/server';
import { createSettlement } from '@/lib/accounts';
import { isMoneyAccount } from '@/lib/accounts-rules';
import { logActivity } from '@/lib/orders';
import { bad, canManage, day, failure, forbidden, iqd } from '../_shared';

export async function POST(request: NextRequest) {
  if (!(await canManage())) return forbidden();
  const body = await request.json().catch(() => ({}));
  const courierId = Number(body.courierId);
  const orderIds = Array.isArray(body.orderIds) ? body.orderIds.map(Number).filter((n: number) => Number.isInteger(n) && n > 0) : [];
  const receivedIqd = iqd(body.receivedIqd);
  if (!Number.isInteger(courierId)) return bad('اختر شركة التوصيل.');
  if (!Number.isFinite(receivedIqd) || receivedIqd < 0) return bad('اكتب المبلغ اللي استلمته (صفر إذا ما استلمت شي).');
  if (!isMoneyAccount(body.account) || body.account === 'qaseh') return bad('اختر وين دخلت الفلوس: الصندوق أو الماستر.');
  try {
    const settlement = await createSettlement({ courierId, orderIds, receivedIqd, account: body.account, settledAt: day(body.settledAt), note: typeof body.note === 'string' ? body.note.trim().slice(0, 300) : null });
    await logActivity('create', 'settlement', settlement.id, `${orderIds.length} طلب · متوقع ${settlement.expectedIqd} · مستلم ${settlement.receivedIqd} · ${settlement.account}`);
    return NextResponse.json({ settlement }, { status: 201 });
  } catch (error) { return failure(error, 'ما انحفظ الكشف.'); }
}
