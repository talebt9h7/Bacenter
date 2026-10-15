import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { purchases, supplierPayments, suppliers } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { logActivity } from '@/lib/orders';
import { baghdadDate, fail, int, str } from '@/lib/procurement-api';

export const dynamic = 'force-dynamic';

/** Money paid to a supplier. With purchaseId it settles that purchase first; the rest settles the oldest unpaid ones. */
export async function POST(request: NextRequest) {
  const actor = await requireAdminSection('catalog', 'manage');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const supplierId = int(body.supplierId), amount = int(body.amountIqd);
  const purchaseId = body.purchaseId == null || body.purchaseId === '' ? null : int(body.purchaseId);
  const method = ['cash', 'transfer', 'zaincash', 'other'].includes(body.method) ? body.method : 'cash';
  if (!Number.isInteger(supplierId)) return fail(request, 400, 'Choose the supplier.', 'اختار المورد.');
  if (!Number.isInteger(amount) || amount <= 0 || amount > 2_000_000_000) return fail(request, 400, 'Enter the amount paid.', 'اكتب المبلغ المدفوع.');
  const [s] = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.id, supplierId));
  if (!s) return fail(request, 404, 'Supplier not found.', 'المورد غير موجود.');
  if (purchaseId !== null) {
    const [p] = await db.select({ id: purchases.id }).from(purchases).where(and(eq(purchases.id, purchaseId), eq(purchases.supplierId, supplierId)));
    if (!p) return fail(request, 400, 'That purchase is not from this supplier.', 'هالفاتورة مو من هذا المورد.');
  }
  const [row] = await db.insert(supplierPayments).values({ supplierId, purchaseId, amountIqd: amount, method, paidAt: baghdadDate(body.paidAt) ?? new Date(), note: str(body.note, 300) || null, createdBy: actor.name }).returning({ id: supplierPayments.id });
  await logActivity('supplier.payment', 'supplier', supplierId, `${s.name} · ${amount} IQD`);
  return NextResponse.json({ ok: true, id: row.id });
}
