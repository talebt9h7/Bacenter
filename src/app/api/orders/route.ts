import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { cartItems, coupons, customers, orderEvents, orders, productVariants, products, shippingZones } from '@/db/schema';
import { getSession } from '@/lib/session';
import { getSettings } from '@/lib/settings';
import { iraqPhonePattern, normalizeIraqPhone, roundIqd } from '@/lib/iraq';
import { consumeInventoryBatches, validateCoupon } from '@/lib/orders';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = (key: string, max = 200) => typeof body[key] === 'string' ? body[key].trim().slice(0, max) : '';
    const name = text('name', 100); const phone = normalizeIraqPhone(text('phone', 30)); const altPhone = normalizeIraqPhone(text('altPhone', 30));
    const governorate = text('governorate', 40); const city = text('city', 120); const address = text('address', 300); const landmark = text('landmark', 200); const email = text('email', 254).toLowerCase(); const note = text('note', 500); const couponCode = text('coupon', 40).toUpperCase();
    if (name.length < 2) return NextResponse.json({ error: 'Please enter the recipient’s full name.' }, { status: 400 });
    if (!iraqPhonePattern.test(phone)) return NextResponse.json({ error: 'Please enter a valid Iraqi mobile number (e.g. 0770 123 4567).' }, { status: 400 });
    if (altPhone && !iraqPhonePattern.test(altPhone)) return NextResponse.json({ error: 'The alternative phone number must be a valid Iraqi mobile number.' }, { status: 400 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Please enter a valid email address or leave it empty.' }, { status: 400 });
    if (!city || address.length < 5) return NextResponse.json({ error: 'Please add the city/district and a detailed delivery address.' }, { status: 400 });
    const settings = await getSettings();
    if (!settings.codEnabled) return NextResponse.json({ error: 'Cash on delivery is temporarily unavailable. Please try again later.' }, { status: 409 });
    const [zone] = await db.select().from(shippingZones).where(eq(shippingZones.code, governorate));
    if (!zone || !zone.enabled) return NextResponse.json({ error: 'Please choose a governorate we currently deliver to.' }, { status: 400 });
    const sessionId = await getSession();
    const result = await db.transaction(async tx => {
      const cart = await tx.select({ id: cartItems.id, quantity: cartItems.quantity, variantId: productVariants.id, color: productVariants.name, stock: productVariants.stock, image: productVariants.images, primaryIndex: productVariants.primaryIndex, productId: products.id, name: products.name, priceCents: products.priceCents, salePriceIqd: products.salePriceIqd }).from(cartItems).innerJoin(productVariants, eq(cartItems.variantId, productVariants.id)).innerJoin(products, eq(productVariants.productId, products.id)).where(eq(cartItems.sessionId, sessionId)).for('update', { of: productVariants });
      if (!cart.length) return { error: 'Your bag is empty. Add something you love first.' };
      const short = cart.find(line => line.quantity > line.stock);
      if (short) return { error: `${short.name} in ${short.color} only has ${short.stock} left. Please adjust your bag.` };
      const rate = settings.exchangeRate;
      const reference = `${settings.orderPrefix || 'BR'}-${randomBytes(3).toString('hex').toUpperCase()}`;
      const items = [];
      for (const line of cart) {
        const consumed = await consumeInventoryBatches(tx, line.variantId, line.quantity, 'Order placed', reference);
        items.push({ productId: line.productId, variantId: line.variantId, name: line.name, color: line.color, quantity: line.quantity, unitPrice: line.salePriceIqd || roundIqd(line.priceCents / 100 * rate), profitIqd: consumed.purchaseCostCents == null ? 0 : (line.salePriceIqd || roundIqd(line.priceCents / 100 * rate)) - Number(consumed.purchaseCostCents), purchaseCostCents: consumed.purchaseCostCents, batchAllocations: consumed.allocations.map(item => ({ batchId: item.batchId, quantity: item.quantity })), image: line.image?.[line.primaryIndex] ?? line.image?.[0] ?? null });
      }
      const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      let discount = 0; let freeShipping = subtotal >= settings.freeShippingThreshold; let appliedCoupon: string | null = null;
      if (couponCode) { const check = await validateCoupon(couponCode, subtotal); if ('error' in check) return { error: check.error }; discount = check.discount; freeShipping = freeShipping || check.freeShipping; appliedCoupon = check.coupon.code; await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(eq(coupons.id, check.coupon.id)); }
      const shipping = freeShipping ? 0 : zone.rate;
      const codFee = settings.codFee;
      const total = Math.max(0, subtotal - discount) + shipping + codFee;
      const [customer] = await tx.insert(customers).values({ phone, name, email: email || null, governorate: zone.code, ordersCount: 1, totalSpent: Math.max(0, subtotal - discount), lastOrderAt: new Date() }).onConflictDoUpdate({ target: customers.phone, set: { name, email: sql`COALESCE(NULLIF(${email}, ''), ${customers.email})`, governorate: zone.code, ordersCount: sql`${customers.ordersCount} + 1`, totalSpent: sql`${customers.totalSpent} + ${Math.max(0, subtotal - discount)}`, lastOrderAt: new Date() } }).returning({ id: customers.id });
      // The order is pending at checkout, so realized financial profit stays at zero until delivery.
      // The item-level sale/purchase snapshot is kept for calculating the profit when it is delivered.
      const [created] = await tx.insert(orders).values({ reference, sessionId, customerId: customer.id, email, name, phone, governorate: zone.code, address: { governorate: zone.nameEn, governorateAr: zone.nameAr, city, line1: address, landmark, altPhone, country: 'Iraq' }, items, currency: 'IQD', exchangeRate: rate, subtotalCents: subtotal, shippingCents: shipping, discountCents: discount, codFeeCents: codFee, totalCents: total, profitIqd: 0, couponCode: appliedCoupon, paymentMethod: 'cod', paymentStatus: 'unpaid', status: 'pending', customerNote: note || null }).returning({ id: orders.id });
      await tx.insert(orderEvents).values({ orderId: created.id, type: 'created', message: `Order placed · cash on delivery · ${zone.nameEn}` });
      await tx.delete(cartItems).where(eq(cartItems.sessionId, sessionId));
      return { order: { reference, total, subtotal, shipping, discount, codFee, currency: 'IQD', phone, email, governorate: zone.nameEn, eta: `${zone.minDays}–${zone.maxDays} business days`, items } };
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { console.error('Checkout failed', error); return NextResponse.json({ error: 'We couldn’t complete your order. Please try again.' }, { status: 500 }); }
}
