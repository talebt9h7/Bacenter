import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { moneyMovements } from '@/db/schema';
import { validAccount } from '@/lib/accounts';
import { movementKinds } from '@/lib/accounts-rules';
import { clearMemo } from '@/lib/memo-cache';
import { logActivity } from '@/lib/orders';
import { bad, canManage, day, failure, forbidden, iqd } from '../_shared';

/** Money moved by hand. Opening/deposit need only "to", withdrawal only "from", transfer both. */
export async function POST(request: NextRequest) {
  if (!(await canManage())) return forbidden();
  const body = await request.json().catch(() => ({}));
  const kind = typeof body.kind === 'string' && movementKinds[body.kind] ? body.kind : '';
  const amount = iqd(body.amountIqd);
  const from = typeof body.fromAccount === 'string' && validAccount(body.fromAccount) ? body.fromAccount : null;
  const to = typeof body.toAccount === 'string' && validAccount(body.toAccount) ? body.toAccount : null;
  if (!kind) return bad('اختر نوع الحركة.');
  if (!Number.isFinite(amount) || amount <= 0) return bad('اكتب مبلغ أكبر من صفر.');
  if (kind === 'transfer' && (!from || !to || from === to)) return bad('اختر حسابين مختلفين للتحويل.');
  if ((kind === 'opening' || kind === 'deposit') && !to) return bad('اختر الحساب.');
  if (kind === 'withdrawal' && !from) return bad('اختر الحساب اللي انسحبت منه الفلوس.');
  if (kind === 'adjustment' && !from === !to) return bad('اختر حساب واحد: يزيد أو ينقص.');
  try {
    const [row] = await db.insert(moneyMovements).values({ kind, fromAccount: kind === 'opening' || kind === 'deposit' ? null : from, toAccount: kind === 'withdrawal' ? null : to, amountIqd: amount, movedAt: day(body.movedAt), note: typeof body.note === 'string' ? body.note.trim().slice(0, 300) || null : null }).returning();
    clearMemo('stats:');
    await logActivity('create', 'money_movement', row.id, `${movementKinds[kind]} · ${amount} · ${from ?? ''} → ${to ?? ''}`);
    return NextResponse.json({ movement: row }, { status: 201 });
  } catch (error) { return failure(error, 'ما انحفظت الحركة.'); }
}
