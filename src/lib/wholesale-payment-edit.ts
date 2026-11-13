import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { activityLog, orderEvents, orders, wholesalePayments } from '@/db/schema';
import { WholesaleEditError } from '@/lib/wholesale-edit';
export async function correctWholesalePayment(orderId: number, input: unknown, executor: typeof db = db) {
  const b = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const paymentId = b.paymentId, amount = b.amount;
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || typeof paymentId !== 'number' || !Number.isSafeInteger(paymentId) || paymentId <= 0 || typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0 || amount > 2_147_483_647) throw new WholesaleEditError('أدخل دفعة ومبلغاً صحيحاً.');
  const expected = typeof b.expectedUpdatedAt === 'string' ? Date.parse(b.expectedUpdatedAt) : NaN;
  if (!Number.isFinite(expected)) throw new WholesaleEditError('أعد فتح الدفعات قبل تعديلها.', 409);
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 200) : '';
  return executor.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.source, 'wholesale'))).for('update');
    if (!order) throw new WholesaleEditError('فاتورة الجملة غير موجودة.', 404);
    if (order.status !== 'delivered') throw new WholesaleEditError('يمكن تصحيح دفعات الفواتير المسلّمة فقط.', 409);
    if (order.updatedAt.getTime() !== expected) throw new WholesaleEditError('تغيرت الفاتورة أو دفعاتها. أعد فتحها قبل التصحيح.', 409);
    const receipts = await tx.select().from(wholesalePayments).where(eq(wholesalePayments.orderId, orderId));
    const payment = receipts.find(p => p.id === paymentId);
    if (!payment) throw new WholesaleEditError('الدفعة غير موجودة على هذه الفاتورة.', 404);
    const received = receipts.reduce((sum, p) => sum + p.amountIqd, 0);
    if (received !== order.paidCents) throw new WholesaleEditError('مجموع الدفعات لا يطابق رصيد الفاتورة. يجب تسوية السجل قبل التصحيح.', 409);
    const paid = received - payment.amountIqd + amount;
    if (paid > order.totalCents) throw new WholesaleEditError('مجموع الدفعات لا يمكن أن يتجاوز إجمالي الفاتورة.');
    const updatedAt = new Date(Math.max(Date.now(), order.updatedAt.getTime() + 1));
    await tx.update(wholesalePayments).set({ amountIqd: amount, note: note || null }).where(eq(wholesalePayments.id, paymentId));
    await tx.update(orders).set({ paidCents: paid, paymentStatus: paid >= order.totalCents ? 'paid' : paid > 0 ? 'partial' : 'unpaid', paymentMethod: paid < order.totalCents ? 'credit' : order.paymentMethod, updatedAt }).where(eq(orders.id, orderId));
    const details = `Payment #${paymentId} corrected · ${payment.amountIqd} → ${amount} IQD · note: ${JSON.stringify(payment.note)} → ${JSON.stringify(note || null)}`;
    await tx.insert(orderEvents).values({ orderId, type: 'payment_corrected', message: details });
    await tx.insert(activityLog).values({ action: 'wholesale.payment_corrected', entity: 'order', entityId: String(orderId), details });
    return { paid, remaining: order.totalCents - paid };
  });
}
