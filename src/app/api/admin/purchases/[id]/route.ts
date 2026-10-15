import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { purchases } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { getSettings } from '@/lib/settings';
import { invalidateCatalog } from '@/lib/cache-tags';
import { logActivity } from '@/lib/orders';
import { cancelPurchase, receivePurchase } from '@/lib/procurement';
import { baghdadDate, fail, str } from '@/lib/procurement-api';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** { action: 'receive' } adds an ordered purchase to stock; { action: 'cancel' } cancels it; otherwise edits notes / due date / supplier invoice. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const actor = await requireAdminSection('catalog', 'manage');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return fail(request, 400, 'Invalid purchase.', 'فاتورة غير صحيحة.');
  const body = await request.json().catch(() => ({}));
  try {
    if (body.action === 'receive') {
      const settings = await getSettings();
      const r = await db.transaction(tx => receivePurchase(tx, id, baghdadDate(body.receivedAt) ?? new Date(), settings.exchangeRate));
      await logActivity('purchase.received', 'purchase', id, r.reference);
      invalidateCatalog();
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'cancel') {
      const r = await db.transaction(tx => cancelPurchase(tx, id));
      await logActivity('purchase.cancelled', 'purchase', id, r.reference);
      invalidateCatalog();
      return NextResponse.json({ ok: true });
    }
    const patch: Partial<typeof purchases.$inferInsert> = { updatedAt: new Date() };
    if ('notes' in body) patch.notes = str(body.notes, 1000) || null;
    if ('supplierInvoice' in body) patch.supplierInvoice = str(body.supplierInvoice, 60) || null;
    if ('dueDate' in body) patch.dueDate = baghdadDate(body.dueDate);
    const [row] = await db.update(purchases).set(patch).where(eq(purchases.id, id)).returning({ id: purchases.id });
    if (!row) return fail(request, 404, 'Purchase not found.', 'الفاتورة غير موجودة.');
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'PURCHASE_NOT_FOUND') return fail(request, 404, 'Purchase not found.', 'الفاتورة غير موجودة.');
    if (code === 'NOT_ORDERED') return fail(request, 409, 'This purchase is already received or cancelled.', 'الفاتورة مستلمة أو ملغية من قبل.');
    if (code === 'ALREADY_CANCELLED') return fail(request, 409, 'Already cancelled.', 'ملغية من قبل.');
    if (code === 'UNITS_SOLD') return fail(request, 409, 'Some units from this purchase were already sold, so it cannot be cancelled. Adjust stock from Inventory instead.', 'انباع جزء من بضاعة هالفاتورة، فما تنلغي. عدّل المخزون من صفحة المخزون.');
    console.error('purchase action failed', error);
    return fail(request, 500, 'Could not update the purchase.', 'ما گدرنا نحدّث الفاتورة.');
  }
}
