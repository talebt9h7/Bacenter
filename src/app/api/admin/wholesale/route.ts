import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { customers, orderEvents, orders, productVariants, products, wholesalePayments } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { iraqPhonePattern, normalizeIraqPhone } from '@/lib/iraq';
import { assertAvailable, consumeInventoryBatches, logActivity, orderProductProfit } from '@/lib/orders';
import { getSettings } from '@/lib/settings';
import { invalidateCatalog } from '@/lib/cache-tags';

export const dynamic = 'force-dynamic';

/**
 * A wholesale invoice. The goods leave stock immediately (the invoice is recorded as delivered,
 * so revenue, cost and profit are counted today). Cash invoices are paid in full; credit (آجل)
 * invoices start with whatever was paid now and collect the rest through payments.
 * Each line keeps the wholesale price (unitPrice) and the fixed retail price (listPrice).
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('sales', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await request.json();
    const text = (key: string, max = 300) => typeof body[key] === 'string' ? body[key].trim().slice(0, max) : '';
    const name = text('name', 100), phone = normalizeIraqPhone(text('phone', 30)), city = text('city', 120), note = text('note', 500), shop = text('shop', 120);
    const payment = text('payment', 10) === 'credit' ? 'credit' : 'cash';
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (name.length < 2) return NextResponse.json({ error: 'Enter the trader’s name.' }, { status: 400 });
    if (!iraqPhonePattern.test(phone)) return NextResponse.json({ error: 'Enter a valid Iraqi mobile number for the trader.' }, { status: 400 });
    if (!rawItems.length) return NextResponse.json({ error: 'Add at least one product.' }, { status: 400 });
    const settings = await getSettings();
    const result = await db.transaction(async tx => {
      const reference = `${settings.orderPrefix || 'UR'}-W-${randomBytes(3).toString('hex').toUpperCase()}`;
      const items: Record<string, unknown>[] = [];
      const taken = new Map<number, number>();
      for (const raw of rawItems) {
        const variantId = Number(raw.variantId), quantity = Number(raw.quantity), unitPrice = Number(raw.unitPrice), retail = Number(raw.retailPrice);
        if (!Number.isInteger(variantId) || !Number.isInteger(quantity) || quantity <= 0 || quantity > 10000 || !Number.isInteger(unitPrice) || unitPrice < 0) throw new Error('INVALID_ITEM');
        const [line] = await tx.select({ productId: products.id, name: products.name, nameAr: products.nameAr, color: productVariants.name, colorAr: productVariants.nameAr, salePriceIqd: products.salePriceIqd, images: productVariants.images, primaryIndex: productVariants.primaryIndex }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).where(eq(productVariants.id, variantId)).for('update', { of: productVariants });
        if (!line) throw new Error('PRODUCT_NOT_FOUND');
        const total = (taken.get(variantId) ?? 0) + quantity;
        try { await assertAvailable(tx, variantId, total); } catch { throw new Error(`INSUFFICIENT_STOCK:${line.nameAr || line.name} / ${line.color}`); }
        taken.set(variantId, total);
        const consumed = await consumeInventoryBatches(tx, variantId, quantity, 'Wholesale', reference);
        const cost = consumed.purchaseCostCents == null ? null : Number(consumed.purchaseCostCents);
        items.push({ productId: line.productId, variantId, name: line.name, nameAr: line.nameAr, color: line.color, colorAr: line.colorAr, quantity, unitPrice, listPrice: Number.isInteger(retail) && retail > 0 ? retail : line.salePriceIqd, profitIqd: cost == null ? 0 : unitPrice - cost, purchaseCostCents: cost, batchAllocations: consumed.allocations.map(a => ({ batchId: a.batchId, quantity: a.quantity })), image: line.images?.[line.primaryIndex] ?? line.images?.[0] ?? null });
      }
      const subtotal = items.reduce((s, i) => s + (i.unitPrice as number) * (i.quantity as number), 0);
      const discount = Math.min(subtotal, Math.max(0, Math.round(Number(body.discount) || 0)));
      const total = subtotal - discount;
      const paidNow = payment === 'cash' ? total : Math.min(total, Math.max(0, Math.round(Number(body.paid) || 0)));
      const paymentStatus = paidNow >= total ? 'paid' : paidNow > 0 ? 'partial' : 'unpaid';
      const [customer] = await tx.insert(customers).values({ phone, name, governorate: null, ordersCount: 1, totalSpent: total, lastOrderAt: new Date(), tags: ['wholesale'] }).onConflictDoUpdate({ target: customers.phone, set: { name, ordersCount: sql`${customers.ordersCount} + 1`, totalSpent: sql`${customers.totalSpent} + ${total}`, lastOrderAt: new Date(), tags: sql`(select coalesce(jsonb_agg(distinct t), '[]'::jsonb) from jsonb_array_elements_text(${customers.tags} || '["wholesale"]'::jsonb) t)` } }).returning({ id: customers.id });
      const [created] = await tx.insert(orders).values({ reference, sessionId: `wholesale-${randomBytes(8).toString('hex')}`, customerId: customer.id, email: '', name, phone, governorate: '', address: { city, line1: shop, country: 'Iraq', wholesale: true }, items, currency: 'IQD', exchangeRate: settings.exchangeRate, subtotalCents: subtotal, shippingCents: 0, discountCents: discount, codFeeCents: 0, totalCents: total, profitIqd: orderProductProfit(items as never, discount), deliveredAt: new Date(), paymentMethod: payment, paymentStatus, paidCents: paidNow, status: 'delivered', customerNote: note || null, source: 'wholesale', sourceNote: shop || null }).returning({ id: orders.id });
      if (paidNow > 0) await tx.insert(wholesalePayments).values({ orderId: created.id, amountIqd: paidNow, note: payment === 'cash' ? 'Cash at sale' : 'Paid at sale' });
      await tx.insert(orderEvents).values({ orderId: created.id, type: 'created', message: `Wholesale invoice · ${payment === 'cash' ? 'cash' : 'credit'}` });
      return { id: created.id, reference, total };
    });
    invalidateCatalog();
    await logActivity('create', 'order', result.id, `Wholesale invoice ${result.reference}`);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('INSUFFICIENT_STOCK:')) return NextResponse.json({ error: `${message.slice(19)} does not have enough stock.` }, { status: 409 });
    if (message === 'INVALID_ITEM') return NextResponse.json({ error: 'One of the lines has an invalid quantity or price.' }, { status: 400 });
    if (message === 'PRODUCT_NOT_FOUND') return NextResponse.json({ error: 'One of the selected products no longer exists.' }, { status: 400 });
    console.error('Wholesale invoice failed', error);
    return NextResponse.json({ error: 'The wholesale invoice could not be created.' }, { status: 500 });
  }
}
