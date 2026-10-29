import { after, NextRequest, NextResponse } from 'next/server';
import { notifyNewOrder } from '@/lib/notify';
import { requestUser, sendCapi } from '@/lib/meta-capi';
import { getBundleById, splitBundlePrice, withSelection } from '@/lib/bundles';
import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { cartBundles, cartItems, customers, orderEvents, orders, productVariants, products, shippingZones } from '@/db/schema';
import { getSession } from '@/lib/session';
import { getSettings, freeShippingFrom } from '@/lib/settings';
import { iraqPhonePattern, normalizeIraqPhone, roundIqd } from '@/lib/iraq';
import { assertAvailable, claimCoupon, validateCoupon } from '@/lib/orders';
import { invalidateCatalog } from '@/lib/cache-tags';
import { bestPromotion, getUpcomingPromotions } from '@/lib/promotions';
import { startPayment } from '@/lib/payments';
import { gatewayReady, getPaymentSettings } from '@/lib/payments/config';

/** A checkout problem to show the shopper. Thrown inside the transaction so nothing is saved. */
class CheckoutError extends Error {}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = (key: string, max = 200) => typeof body[key] === 'string' ? body[key].trim().slice(0, max) : '';
    const name = text('name', 100); const phone = normalizeIraqPhone(text('phone', 30)); const altPhone = normalizeIraqPhone(text('altPhone', 30));
    const governorate = text('governorate', 40); const city = text('city', 120); const address = text('address', 300); const payment = text('payment', 20) === 'electronic' ? 'electronic' : 'cod'; const landmark = text('landmark', 200); const email = text('email', 254).toLowerCase(); const note = text('note', 500); const couponCode = text('coupon', 40).toUpperCase();
    if (name.length < 2) return NextResponse.json({ error: 'Please enter the recipient’s full name.' }, { status: 400 });
    if (!iraqPhonePattern.test(phone)) return NextResponse.json({ error: 'Please enter a valid Iraqi mobile number (e.g. 0770 123 4567).' }, { status: 400 });
    if (altPhone && !iraqPhonePattern.test(altPhone)) return NextResponse.json({ error: 'The alternative phone number must be a valid Iraqi mobile number.' }, { status: 400 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Please enter a valid email address or leave it empty.' }, { status: 400 });
    if (!city || city.length < 2) return NextResponse.json({ error: 'Please add the city or district.' }, { status: 400 });
    const settings = await getSettings();
    const paySettings = payment === 'electronic' ? await getPaymentSettings() : null;
    const online = !!paySettings && gatewayReady(paySettings);
    if (!settings.codEnabled && !online) return NextResponse.json({ error: 'Cash on delivery is temporarily unavailable. Please try again later.' }, { status: 409 });
    const [zone] = await db.select().from(shippingZones).where(eq(shippingZones.code, governorate));
    if (!zone || !zone.enabled) return NextResponse.json({ error: 'Please choose a governorate we currently deliver to.' }, { status: 400 });
    const sessionId = await getSession();
    const promos = await getUpcomingPromotions();
    const result = await db.transaction(async tx => {
      const cart = await tx.select({ id: cartItems.id, quantity: cartItems.quantity, variantId: productVariants.id, color: productVariants.name, stock: productVariants.stock, image: productVariants.images, primaryIndex: productVariants.primaryIndex, productId: products.id, name: products.name, priceCents: products.priceCents, salePriceIqd: products.salePriceIqd, category: products.category }).from(cartItems).innerJoin(productVariants, eq(cartItems.variantId, productVariants.id)).innerJoin(products, eq(productVariants.productId, products.id)).where(eq(cartItems.sessionId, sessionId)).for('update', { of: productVariants });
      const bundleRows = await tx.select().from(cartBundles).where(eq(cartBundles.sessionId, sessionId));
      if (!cart.length && !bundleRows.length) throw new CheckoutError('Your bag is empty. Add something you love first.');
      const rate = settings.exchangeRate;
      const reference = `${settings.orderPrefix || 'BR'}-${randomBytes(3).toString('hex').toUpperCase()}`;
      const items = [];
      for (const line of cart) {
        // A new order is pending: it reserves the units but does not take them out of stock.
        // Stock is deducted (and the purchase cost recorded) when the order is confirmed.
        try { await assertAvailable(tx, line.variantId, line.quantity); }
        catch (error) {
          if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') {
            throw new CheckoutError(`${line.name} in ${line.color} doesn’t have ${line.quantity} available any more. Please adjust your bag.`);
          }
          throw error;
        }
        const regular = line.salePriceIqd || roundIqd(line.priceCents / 100 * rate);
        // A live promotion sets the price actually charged; the regular price and the promotion are kept on the line for reports.
        const promo = bestPromotion({ id: line.productId, category: line.category, salePriceIqd: regular }, promos);
        items.push({ productId: line.productId, variantId: line.variantId, name: line.name, color: line.color, quantity: line.quantity, unitPrice: promo?.price ?? regular, listPrice: regular, promotionId: promo?.promotion.id ?? null, promotionName: promo?.promotion.name ?? null, profitIqd: 0, purchaseCostCents: null, batchAllocations: [], image: line.image?.[line.primaryIndex] ?? line.image?.[0] ?? null });
      }
      // Bundles: each component becomes its own line at its share of the bundle price.
      const taken = new Map(cart.map(line => [line.variantId, line.quantity]));
      for (const row of bundleRows) {
        const baseBundle = await getBundleById(row.bundleId, tx);
        const bundle = baseBundle ? withSelection(baseBundle, row.selection) : null;
        if (!bundle || !bundle.active || !bundle.parts.length || !bundle.parts.every(p => p.published)) throw new CheckoutError(`${bundle?.name ?? 'A bundle in your bag'} is no longer available. Please remove it from your bag.`);
        const prices = splitBundlePrice(bundle.priceIqd, bundle.parts);
        for (const [index, part] of bundle.parts.entries()) {
          const quantity = part.quantity * row.quantity;
          const total = (taken.get(part.variantId) ?? 0) + quantity;
          try { await assertAvailable(tx, part.variantId, total); }
          catch (error) {
            if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') throw new CheckoutError(`${bundle.name}: ${part.name} in ${part.color} doesn’t have enough stock any more. Please adjust your bag.`);
            throw error;
          }
          taken.set(part.variantId, total);
          items.push({ productId: part.productId, variantId: part.variantId, name: part.name, color: part.color, quantity, unitPrice: prices[index], listPrice: part.priceIqd, promotionId: null, promotionName: null, bundleId: bundle.id, bundleName: bundle.nameAr || bundle.name, profitIqd: 0, purchaseCostCents: null, batchAllocations: [], image: part.image });
        }
      }
      const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      let discount = 0; const freeFrom = freeShippingFrom(settings); let freeShipping = freeFrom > 0 && subtotal >= freeFrom; let appliedCoupon: string | null = null;
      if (couponCode) {
        // Validated inside the transaction and claimed atomically. Throwing (not returning)
        // rolls back the whole order if the coupon turns out to be invalid.
        const check = await validateCoupon(couponCode, subtotal, tx);
        if ('error' in check) throw new CheckoutError(check.error ?? 'That coupon isn’t valid.');
        if (!(await claimCoupon(tx, check.coupon.id))) throw new CheckoutError('That coupon has been fully redeemed.');
        discount = check.discount; freeShipping = freeShipping || check.freeShipping; appliedCoupon = check.coupon.code;
      }
      const shipping = freeShipping ? 0 : zone.rate;
      const codFee = payment === 'cod' ? settings.codFee : 0;
      const total = Math.max(0, subtotal - discount) + shipping + codFee;
      const [customer] = await tx.insert(customers).values({ phone, name, email: email || null, governorate: zone.code, ordersCount: 1, totalSpent: Math.max(0, subtotal - discount), lastOrderAt: new Date() }).onConflictDoUpdate({ target: customers.phone, set: { name, email: sql`COALESCE(NULLIF(${email}, ''), ${customers.email})`, governorate: zone.code, ordersCount: sql`${customers.ordersCount} + 1`, totalSpent: sql`${customers.totalSpent} + ${Math.max(0, subtotal - discount)}`, lastOrderAt: new Date() } }).returning({ id: customers.id });
      // The order is pending at checkout, so realized financial profit stays at zero until delivery.
      // The item-level sale/purchase snapshot is kept for calculating the profit when it is delivered.
      const [created] = await tx.insert(orders).values({ reference, sessionId, customerId: customer.id, email, name, phone, governorate: zone.code, address: { governorate: zone.nameEn, governorateAr: zone.nameAr, city, line1: address, landmark, altPhone, country: 'Iraq' }, items, currency: 'IQD', exchangeRate: rate, subtotalCents: subtotal, shippingCents: shipping, discountCents: discount, codFeeCents: codFee, totalCents: total, profitIqd: 0, couponCode: appliedCoupon, paymentMethod: payment, paymentStatus: 'unpaid', status: 'pending', customerNote: note || null }).returning({ id: orders.id });
      await tx.insert(orderEvents).values({ orderId: created.id, type: 'created', message: `Order placed · ${payment === 'electronic' ? 'electronic payment' : 'cash on delivery'} · ${zone.nameEn}` });
      await tx.delete(cartItems).where(eq(cartItems.sessionId, sessionId));
      await tx.delete(cartBundles).where(eq(cartBundles.sessionId, sessionId));
      return { orderId: created.id, order: { reference, total, subtotal, shipping, discount, codFee, currency: 'IQD', phone, email, governorate: zone.nameEn, eta: `${zone.minDays}–${zone.maxDays} business days`, items } };
    });
    invalidateCatalog();
    // Tell the owner (Telegram / WhatsApp) after the response is sent, so checkout never waits on it.
    const origin = request.nextUrl.origin;
    after(() => notifyNewOrder(result.orderId, origin));
    // Server-side Purchase for Meta (same event_id as the browser pixel, so it is counted once).
    const capiUser = { ...requestUser(request.headers, request.cookies), phone, email, name, city, governorate: result.order.governorate, externalId: phone };
    const o = result.order;
    after(() => sendCapi([{ name: 'Purchase', eventId: o.reference, url: request.headers.get('referer') ?? `${origin}/checkout`, user: capiUser, custom: { currency: 'IQD', value: o.total, order_id: o.reference, content_type: 'product', content_ids: [...new Set(o.items.map(i => i.productId))], contents: o.items.map(i => ({ id: i.productId, quantity: i.quantity, item_price: i.unitPrice })), num_items: o.items.reduce((n, i) => n + i.quantity, 0) } }]).then(r => { if (!r.ok && !('skipped' in r)) console.error('CAPI Purchase failed', r.error); }));
    // Electronic payment: open the gateway now and send the shopper to it. If the gateway refuses,
    // the order still stands and the shop sends a payment link manually (as before the gateway).
    let pay: { url: string; redirectUrl: string | null } | null = null; let payError = false;
    if (online) {
      try {
        const lang = request.cookies.get('bellroy_lang')?.value === 'en' ? 'en' : 'ar';
        const started = await startPayment(result.orderId, origin, lang);
        if (started) pay = { url: `/pay/${started.token}`, redirectUrl: started.redirectUrl };
      } catch { payError = true; }
    }
    const { orderId: _orderId, ...response } = result; void _orderId;
    return NextResponse.json({ ...response, payment: pay, paymentError: payError }, { status: 201 });
  } catch (error) {
    if (error instanceof CheckoutError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') return NextResponse.json({ error: 'Some items just sold out. Please review your bag.' }, { status: 409 });
    console.error('Checkout failed', error); return NextResponse.json({ error: 'We couldn’t complete your order. Please try again.' }, { status: 500 }); }
}
