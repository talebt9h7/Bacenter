import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { orderEvents, orders, wholesalePayments } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { logActivity } from '@/lib/orders';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
/** Records money received against a credit (آجل) wholesale invoice. */
export async function POST(request: NextRequest, { params }: Ctx) {
  if (!(await requireAdminSection('sales', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number((await params).id);
  const body = await request.json().catch(() => ({}));
  const amount = Math.round(Number(body.amount));
  if (!Number.isInteger(amount) || amount <= 0) return NextResponse.json({ error: 'Enter the amount received.' }, { status: 400 });
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : null;
  const result = await db.transaction(async tx => {
    const [order] = await tx.select({ id: orders.id, total: orders.totalCents, paid: orders.paidCents, status: orders.status, reference: orders.reference }).from(orders).where(and(eq(orders.id, id), eq(orders.source, 'wholesale'))).for('update');
    if (!order) return { error: 'Invoice not found.', status: 404 };
    if (order.status === 'cancelled' || order.status === 'returned') return { error: 'This invoice was cancelled.', status: 409 };
    const remaining = order.total - order.paid;
    if (remaining <= 0) return { error: 'This invoice is already paid in full.', status: 409 };
    if (amount > remaining) return { error: `Only ${remaining.toLocaleString('en-US')} IQD is still owed on this invoice.`, status: 400 };
    await tx.insert(wholesalePayments).values({ orderId: id, amountIqd: amount, note });
    const paid = order.paid + amount;
    await tx.update(orders).set({ paidCents: sql`${orders.paidCents} + ${amount}`, paymentStatus: paid >= order.total ? 'paid' : 'partial', updatedAt: new Date() }).where(eq(orders.id, id));
    await tx.insert(orderEvents).values({ orderId: id, type: 'payment', message: `Payment received · ${amount} IQD` });
    return { ok: true, paid, remaining: order.total - paid, reference: order.reference };
  });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  await logActivity('update', 'order', id, `Wholesale payment ${amount} IQD · ${result.reference}`);
  return NextResponse.json(result);
}
