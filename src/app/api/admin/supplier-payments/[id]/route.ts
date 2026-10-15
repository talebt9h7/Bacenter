import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { supplierPayments } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { logActivity } from '@/lib/orders';
import { fail } from '@/lib/procurement-api';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** Removes a payment entered by mistake. */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  if (!(await requireAdminSection('catalog', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number((await params).id);
  const [row] = await db.delete(supplierPayments).where(eq(supplierPayments.id, id)).returning({ supplierId: supplierPayments.supplierId, amount: supplierPayments.amountIqd });
  if (!row) return fail(request, 404, 'Payment not found.', 'الدفعة غير موجودة.');
  await logActivity('supplier.payment.deleted', 'supplier', row.supplierId, `${row.amount} IQD`);
  return NextResponse.json({ ok: true });
}
