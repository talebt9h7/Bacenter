import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { orders, wholesalePayments } from '@/db/schema';

export type WholesaleLine = { productId: string; variantId: number; name: string; nameAr?: string; color: string; colorAr?: string; quantity: number; unitPrice: number; listPrice: number; image: string | null };
export type WholesaleInvoice = { id: number; reference: string; name: string; phone: string; city: string; shop: string; payment: 'cash' | 'credit'; status: string; paymentStatus: string; subtotal: number; discount: number; total: number; paid: number; remaining: number; profit: number; createdAt: string; note: string | null; items: WholesaleLine[]; payments: { id: number; amount: number; note: string | null; createdAt: string }[] };

function toInvoice(o: typeof orders.$inferSelect, payments: (typeof wholesalePayments.$inferSelect)[]): WholesaleInvoice {
  const address = (o.address ?? {}) as { city?: string; line1?: string };
  const items = (Array.isArray(o.items) ? o.items : []) as WholesaleLine[];
  const void_ = o.status === 'cancelled' || o.status === 'returned';
  return { id: o.id, reference: o.reference, name: o.name, phone: o.phone, city: address.city ?? '', shop: address.line1 ?? '', payment: o.paymentMethod === 'credit' ? 'credit' : 'cash', status: o.status, paymentStatus: o.paymentStatus, subtotal: o.subtotalCents, discount: o.discountCents, total: o.totalCents, paid: o.paidCents, remaining: void_ ? 0 : Math.max(0, o.totalCents - o.paidCents), profit: o.profitIqd ?? 0, createdAt: o.createdAt.toISOString(), note: o.customerNote, items: items.map(i => ({ ...i, listPrice: i.listPrice ?? i.unitPrice, image: i.image ?? null })), payments: payments.map(p => ({ id: p.id, amount: p.amountIqd, note: p.note, createdAt: p.createdAt.toISOString() })) };
}

export async function listWholesale(limit = 300): Promise<WholesaleInvoice[]> {
  const rows = await db.select().from(orders).where(eq(orders.source, 'wholesale')).orderBy(desc(orders.createdAt)).limit(limit);
  const pays = rows.length ? await db.select().from(wholesalePayments).where(inArray(wholesalePayments.orderId, rows.map(r => r.id))) : [];
  return rows.map(r => toInvoice(r, pays.filter(p => p.orderId === r.id)));
}
export async function getWholesale(id: number) {
  const [row] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.source, 'wholesale')));
  if (!row) return null;
  const pays = await db.select().from(wholesalePayments).where(eq(wholesalePayments.orderId, id));
  return toInvoice(row, pays);
}
