import { NextRequest, NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { productVariants, purchaseItems, purchases, supplierPayments } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { getSettings } from '@/lib/settings';
import { invalidateCatalog } from '@/lib/cache-tags';
import { logActivity } from '@/lib/orders';
import { landedCosts, loadProcurement, nextPurchaseReference, receivePurchase, supplierExists } from '@/lib/procurement';
import { baghdadDate, fail, int, str } from '@/lib/procurement-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await requireAdminSection('catalog', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json(await loadProcurement());
}

/**
 * New purchase. Lines are priced in IQD (dinars) or USD (cents). Shipping/customs and the discount
 * are spread over the lines so each unit carries its landed cost. status "received" adds the stock
 * now; "ordered" waits until the goods arrive. paidNow records a payment to the supplier.
 */
export async function POST(request: NextRequest) {
  const actor = await requireAdminSection('catalog', 'manage');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const currency = body.currency === 'USD' ? 'USD' : 'IQD';
  const status = body.status === 'ordered' ? 'ordered' : 'received';
  const supplierId = body.supplierId == null || body.supplierId === '' ? null : int(body.supplierId);
  const extra = Math.max(0, int(body.extraCostsIqd) || 0), discount = Math.max(0, int(body.discountIqd) || 0);
  const paidNow = Math.max(0, int(body.paidNow) || 0);
  const method = ['cash', 'transfer', 'zaincash', 'other'].includes(body.paymentMethod) ? body.paymentMethod : 'cash';
  const purchaseDate = baghdadDate(body.purchaseDate) ?? new Date();
  const dueDate = baghdadDate(body.dueDate);
  const raw: unknown[] = Array.isArray(body.items) ? body.items : [];
  const settings = await getSettings();
  const rate = int(body.exchangeRate) > 0 ? int(body.exchangeRate) : settings.exchangeRate;

  if (supplierId !== null && !Number.isInteger(supplierId)) return fail(request, 400, 'Choose a supplier.', 'اختار المورد.');
  if (!raw.length) return fail(request, 400, 'Add at least one product.', 'أضف منتج واحد على الأقل.');
  if (raw.length > 200) return fail(request, 400, 'Too many lines.', 'عدد الأسطر كثير.');
  const lines = raw.map(r => { const o = (r ?? {}) as Record<string, unknown>; return { variantId: int(o.variantId), quantity: int(o.quantity), unitCost: int(o.unitCost), salePriceIqd: o.salePriceIqd == null || o.salePriceIqd === '' ? null : int(o.salePriceIqd) }; });
  if (lines.some(l => !Number.isInteger(l.variantId) || !Number.isInteger(l.quantity) || l.quantity <= 0 || l.quantity > 100000 || !Number.isInteger(l.unitCost) || l.unitCost < 0 || (l.salePriceIqd !== null && (!Number.isInteger(l.salePriceIqd) || l.salePriceIqd < 0))))
    return fail(request, 400, 'Check the quantity and cost on every line.', 'تأكد من الكمية والتكلفة بكل سطر.');
  if (new Set(lines.map(l => l.variantId)).size !== lines.length) return fail(request, 400, 'The same product colour is on two lines.', 'نفس المنتج واللون مكرر بسطرين.');
  if (currency === 'USD' && !(rate >= 100 && rate <= 100000)) return fail(request, 400, 'Enter the dollar exchange rate.', 'اكتب سعر صرف الدولار.');
  const { units, subtotalIqd, totalIqd } = landedCosts(lines, currency, rate, extra, discount);
  if (discount > subtotalIqd + extra) return fail(request, 400, 'The discount is larger than the purchase.', 'الخصم أكبر من قيمة الفاتورة.');
  if (paidNow > 0 && supplierId === null) return fail(request, 400, 'Choose the supplier to record a payment.', 'اختار المورد حتى تسجل دفعة.');
  if (paidNow > totalIqd) return fail(request, 400, 'Paid now is more than the purchase total.', 'المدفوع أكثر من إجمالي الفاتورة.');

  try {
    const result = await db.transaction(async tx => {
      if (supplierId !== null && !(await supplierExists(tx, supplierId))) throw new Error('NO_SUPPLIER');
      const found = await tx.select({ id: productVariants.id }).from(productVariants).where(inArray(productVariants.id, lines.map(l => l.variantId)));
      if (found.length !== lines.length) throw new Error('NO_VARIANT');
      const wanted = str(body.reference, 40);
      if (wanted) { const [dup] = await tx.select({ id: purchases.id }).from(purchases).where(eq(purchases.reference, wanted)).limit(1); if (dup) throw new Error('DUP_REF'); }
      const reference = wanted || await nextPurchaseReference(tx);
      const [p] = await tx.insert(purchases).values({ reference, supplierId, status: 'ordered', totalCostIqd: totalIqd, subtotalIqd, extraCostsIqd: extra, discountIqd: discount, currency, exchangeRate: rate, purchaseDate, dueDate, supplierInvoice: str(body.supplierInvoice, 60) || null, notes: str(body.notes, 1000) || null, createdBy: actor.name }).returning({ id: purchases.id });
      await tx.insert(purchaseItems).values(lines.map((l, i) => ({ purchaseId: p.id, variantId: l.variantId, quantity: l.quantity, unitCost: l.unitCost, landedCostIqd: units[i], purchaseCostIqd: units[i], purchaseCostUsdCents: currency === 'USD' ? l.unitCost : Math.round(l.unitCost / rate * 100), purchaseExchangeRate: rate, salePriceIqd: l.salePriceIqd, salePriceCents: l.salePriceIqd == null ? null : Math.round(l.salePriceIqd / rate * 100) })));
      if (status === 'received') await receivePurchase(tx, p.id, purchaseDate, settings.exchangeRate);
      if (paidNow > 0 && supplierId !== null) await tx.insert(supplierPayments).values({ supplierId, purchaseId: p.id, amountIqd: paidNow, method, paidAt: purchaseDate, note: null, createdBy: actor.name });
      return { id: p.id, reference };
    });
    await logActivity(status === 'received' ? 'purchase.received' : 'purchase.ordered', 'purchase', result.id, `${result.reference} · ${totalIqd} IQD`);
    if (status === 'received') invalidateCatalog();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'NO_SUPPLIER') return fail(request, 404, 'Supplier not found.', 'المورد غير موجود.');
    if (code === 'NO_VARIANT') return fail(request, 404, 'A product on the list no longer exists.', 'منتج بالقائمة ما موجود.');
    if (code === 'DUP_REF') return fail(request, 409, 'That purchase number is already used.', 'رقم الفاتورة مستخدم قبل.');
    console.error('purchase create failed', error);
    return fail(request, 500, 'Could not save the purchase.', 'ما گدرنا نحفظ الفاتورة.');
  }
}
