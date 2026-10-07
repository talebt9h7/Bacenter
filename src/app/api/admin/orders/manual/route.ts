import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { customers, orderEvents, orders, productVariants, products, shippingZones } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { normalizeIraqPhone, iraqPhonePattern } from '@/lib/iraq';
import { consumeInventoryBatches, logActivity, orderProductProfit } from '@/lib/orders';
import { getSettings } from '@/lib/settings';

export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('sales', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await request.json();
    const text = (key: string, max = 300) => typeof body[key] === 'string' ? body[key].trim().slice(0, max) : '';
    const name = text('name', 100), phone = normalizeIraqPhone(text('phone', 30)), altPhone = normalizeIraqPhone(text('altPhone', 30));
    const email = text('email', 254).toLowerCase(), governorate = text('governorate', 40), city = text('city', 120), address = text('address', 300), landmark = text('landmark', 200), note = text('note', 500);
    const source = text('source', 40) || 'instagram', sourceNote = text('sourceNote', 200) || null;
    const paymentMethod = text('paymentMethod', 30) || 'cod', paymentStatus = text('paymentStatus', 30) || 'unpaid', status = text('status', 30) || 'pending';
    const discount = Math.max(0, Number.isFinite(Number(body.discount)) ? Math.round(Number(body.discount)) : 0);
    const shippingOverride = body.shipping !== '' && body.shipping !== null && body.shipping !== undefined ? Number(body.shipping) : null;
    const codFee = Math.max(0, Number.isFinite(Number(body.codFee)) ? Math.round(Number(body.codFee)) : 0);
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (name.length < 2) return NextResponse.json({ error: 'Enter the customer name.' }, { status: 400 });
    if (!iraqPhonePattern.test(phone)) return NextResponse.json({ error: 'Enter a valid Iraqi mobile number.' }, { status: 400 });
    if (!governorate) return NextResponse.json({ error: 'Choose a governorate.' }, { status: 400 });
    if (!city || address.length < 3) return NextResponse.json({ error: 'Enter the city/district and detailed address.' }, { status: 400 });
    if (!rawItems.length) return NextResponse.json({ error: 'Add at least one product.' }, { status: 400 });
    const settings = await getSettings();
    const result = await db.transaction(async tx => {
      const [zone] = await tx.select().from(shippingZones).where(eq(shippingZones.code, governorate));
      if (!zone || !zone.enabled) throw new Error('INVALID_GOVERNORATE');
      const reference = `${settings.orderPrefix || 'UR'}-M-${randomBytes(3).toString('hex').toUpperCase()}`;
      const items: any[] = [];
      for (const raw of rawItems) {
        const variantId = Number(raw.variantId), quantity = Number(raw.quantity), enteredPrice = Number(raw.unitPrice);
        if (!Number.isInteger(variantId) || !Number.isInteger(quantity) || quantity <= 0 || !Number.isInteger(enteredPrice) || enteredPrice < 0) throw new Error('INVALID_ITEM');
        const [line] = await tx.select({ variantId: productVariants.id, productId: products.id, name: products.name, color: productVariants.name, stock: productVariants.stock, image: productVariants.images, primaryIndex: productVariants.primaryIndex }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).where(eq(productVariants.id, variantId)).for('update', { of: productVariants });
        if (!line) throw new Error('PRODUCT_NOT_FOUND');
        if (quantity > line.stock) throw new Error(`INSUFFICIENT_STOCK:${line.name} / ${line.color}`);
        const consumed = await consumeInventoryBatches(tx, variantId, quantity, 'Manual order', reference);
        const purchaseCost = consumed.purchaseCostCents == null ? null : Number(consumed.purchaseCostCents);
        const unitProfit = purchaseCost == null ? 0 : enteredPrice - purchaseCost;
        items.push({ productId: line.productId, variantId, name: line.name, color: line.color, quantity, unitPrice: enteredPrice, profitIqd: unitProfit, purchaseCostCents: purchaseCost, batchAllocations: consumed.allocations.map(a => ({ batchId: a.batchId, quantity: a.quantity })), image: line.image?.[line.primaryIndex] ?? line.image?.[0] ?? null });
      }
      const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const safeDiscount = Math.min(discount, subtotal), shipping = shippingOverride === null ? zone.rate : Math.max(0, Math.round(shippingOverride));
      const total = Math.max(0, subtotal - safeDiscount) + shipping + codFee;
      const orderProfitIqd = orderProductProfit(items, safeDiscount);
      const [customer] = await tx.insert(customers).values({ phone, name, email: email || null, governorate: zone.code, ordersCount: 1, totalSpent: Math.max(0, subtotal - discount), lastOrderAt: new Date() }).onConflictDoUpdate({ target: customers.phone, set: { name, email: sql`COALESCE(NULLIF(${email}, ''), ${customers.email})`, governorate: zone.code, ordersCount: sql`${customers.ordersCount} + 1`, totalSpent: sql`${customers.totalSpent} + ${Math.max(0, subtotal - safeDiscount)}`, lastOrderAt: new Date() } }).returning({ id: customers.id });
      const sessionId = `manual-${randomBytes(8).toString('hex')}`;
      const [created] = await tx.insert(orders).values({ reference, sessionId, customerId: customer.id, email, name, phone, governorate: zone.code, address: { governorate: zone.nameEn, governorateAr: zone.nameAr, city, line1: address, landmark, altPhone, country: 'Iraq' }, items, currency: 'IQD', exchangeRate: settings.exchangeRate, subtotalCents: subtotal, shippingCents: shipping, discountCents: safeDiscount, codFeeCents: codFee, totalCents: total, profitIqd: status === 'delivered' ? orderProfitIqd : 0, paymentMethod, paymentStatus, status, customerNote: note || null, source, sourceNote }).returning({ id: orders.id });
      await tx.insert(orderEvents).values({ orderId: created.id, type: 'created', message: `Manual order · ${source} · ${paymentMethod}` });
      return { id: created.id, reference, total };
    });
    await logActivity('create', 'order', result.id, `Manual order ${result.reference} · ${source}`);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const known: Record<string, string> = { INVALID_GOVERNORATE: 'Invalid governorate.', INVALID_ITEM: 'One of the products has invalid quantity or price.', PRODUCT_NOT_FOUND: 'One of the selected products no longer exists.', BATCH_STOCK_MISMATCH: 'Inventory batches do not match current stock.' };
    if (message.startsWith('INSUFFICIENT_STOCK:')) return NextResponse.json({ error: `${message.slice(19)} does not have enough stock.` }, { status: 409 });
    if (known[message]) return NextResponse.json({ error: known[message] }, { status: 400 });
    console.error('Manual order failed', error);
    return NextResponse.json({ error: 'The manual order could not be created.' }, { status: 500 });
  }
}
