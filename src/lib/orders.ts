import { and, asc, desc, eq, max, sql } from 'drizzle-orm';
import { db } from '@/db';
import { activityLog, coupons, customers, inventoryBatches, inventoryMovements, orderEvents, orders, productVariants, products, shippingZones } from '@/db/schema';
import { roundIqd } from './iraq';
import { invalidateCatalog } from './cache-tags';
import type { OrderStatus } from './iraq';
import { reservedForVariant, statusHoldsStock } from './reservations';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function logActivity(action: string, entity: string, entityId?: string | number, details?: string) {
  await db.insert(activityLog).values({ action, entity, entityId: entityId === undefined ? null : String(entityId), details: details ?? null });
}
export async function validateCoupon(codeRaw: string, subtotal: number, executor: Tx | typeof db = db) {
  const code = codeRaw.trim().toUpperCase();
  if (!code) return { error: 'Enter a coupon code.' };
  const [coupon] = await executor.select().from(coupons).where(eq(coupons.code, code));
  if (!coupon || !coupon.active) return { error: 'That coupon isn’t valid.' };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return { error: 'That coupon has expired.' };
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return { error: 'That coupon has been fully redeemed.' };
  if (subtotal < coupon.minSubtotal) return { error: `This coupon needs a minimum order of ${coupon.minSubtotal.toLocaleString('en-US')} IQD.` };
  const discount = coupon.type === 'percent' ? roundIqd(subtotal * Math.min(coupon.value, 100) / 100) : Math.min(coupon.value, subtotal);
  return { coupon, discount, freeShipping: coupon.freeShipping };
}

/**
 * Counts one use of a coupon, but only while it still has uses left. Done as a single
 * conditional UPDATE so two customers checking out at the same moment cannot both take
 * the last use of a limited coupon.
 */
export async function claimCoupon(tx: Tx, couponId: number) {
  const claimed = await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` })
    .where(and(eq(coupons.id, couponId), sql`(${coupons.maxUses} IS NULL OR ${coupons.usedCount} < ${coupons.maxUses})`))
    .returning({ id: coupons.id });
  return claimed.length > 0;
}

/** Gives a coupon use back when its order is cancelled, returned or deleted. */
async function releaseCoupon(tx: Tx, code: string | null) {
  if (!code) return;
  await tx.update(coupons).set({ usedCount: sql`GREATEST(${coupons.usedCount} - 1, 0)` }).where(eq(coupons.code, code));
}

/** Takes a coupon use again when a cancelled order is reinstated. */
async function reclaimCoupon(tx: Tx, code: string | null) {
  if (!code) return;
  await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(eq(coupons.code, code));
}

/**
 * Inventory rule: purchase batches can never hold more units than the variant has in
 * stock. Units in stock beyond the batches are "unbatched" (their purchase cost is
 * unknown). When stock goes down outside of a sale, unbatched units are removed first,
 * then batches oldest-first, so the purchase-cost ledger keeps matching real stock.
 */
async function trimBatchesToStock(tx: Tx | typeof db, variantId: number, stock: number) {
  const batches = await tx.select({ id: inventoryBatches.id, quantityRemaining: inventoryBatches.quantityRemaining }).from(inventoryBatches)
    .where(and(eq(inventoryBatches.variantId, variantId), sql`${inventoryBatches.quantityRemaining} > 0`))
    .orderBy(asc(inventoryBatches.receivedAt), asc(inventoryBatches.id)).for('update');
  let excess = batches.reduce((sum, batch) => sum + batch.quantityRemaining, 0) - stock;
  for (const batch of batches) {
    if (excess <= 0) break;
    const take = Math.min(excess, batch.quantityRemaining);
    await tx.update(inventoryBatches).set({ quantityRemaining: batch.quantityRemaining - take }).where(eq(inventoryBatches.id, batch.id));
    excess -= take;
  }
}

/** Adjusts stock by `delta` (never below zero), keeps batches consistent and logs the movement. */
export async function adjustStock(tx: Tx | typeof db, variantId: number, delta: number, reason: string, reference?: string) {
  const [variant] = await tx.select({ stock: productVariants.stock }).from(productVariants).where(eq(productVariants.id, variantId)).for('update');
  if (!variant) return undefined;
  const target = Math.max(variant.stock + delta, 0);
  const applied = target - variant.stock;
  if (applied === 0) return variant.stock;
  if (applied < 0) await trimBatchesToStock(tx, variantId, target);
  const [updated] = await tx.update(productVariants).set({ stock: target }).where(eq(productVariants.id, variantId)).returning({ stock: productVariants.stock });
  await tx.insert(inventoryMovements).values({ variantId, delta: applied, stockAfter: updated.stock, reason, reference: reference ?? null });
  return updated.stock;
}

/** Receive a new purchase batch. Purchase cost is snapshotted; storefront sale price is managed at product level. */
export async function receiveInventoryBatch(tx: Tx | typeof db, input: { variantId: number; quantity: number; purchaseCostUsdCents: number; purchaseExchangeRate: number; salePriceIqd?: number | null; batchNumber: string; notes?: string | null; reference?: string | null }) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw new Error('INVALID_QUANTITY');
  if (!Number.isInteger(input.purchaseCostUsdCents) || input.purchaseCostUsdCents < 0) throw new Error('INVALID_PURCHASE_PRICE');
  if (!Number.isInteger(input.purchaseExchangeRate) || input.purchaseExchangeRate <= 0) throw new Error('INVALID_EXCHANGE_RATE');
  const purchaseCostIqd = Math.round((input.purchaseCostUsdCents / 100) * input.purchaseExchangeRate);
  const [variant] = await tx.select({ stock: productVariants.stock, productId: productVariants.productId }).from(productVariants).where(eq(productVariants.id, input.variantId)).for('update');
  if (!variant) throw new Error('NOT_FOUND');
  const [batch] = await tx.insert(inventoryBatches).values({ variantId: input.variantId, batchNumber: input.batchNumber.trim().slice(0, 120), quantityReceived: input.quantity, quantityRemaining: input.quantity, purchaseCostIqd, purchaseCostUsdCents: input.purchaseCostUsdCents, purchaseExchangeRate: input.purchaseExchangeRate, salePriceCents: null, salePriceIqd: null, notes: input.notes?.trim().slice(0, 500) || null }).returning({ id: inventoryBatches.id });
  const [updated] = await tx.update(productVariants).set({ stock: sql`${productVariants.stock} + ${input.quantity}` }).where(eq(productVariants.id, input.variantId)).returning({ stock: productVariants.stock });
  await tx.insert(inventoryMovements).values({ variantId: input.variantId, delta: input.quantity, stockAfter: updated.stock, reason: 'Purchase received', reference: input.reference ?? batch.id.toString() });
  return { stock: updated.stock, batchId: batch.id };
}

/** Consume batches FIFO and return the purchase cost snapshot used by the order. */
export async function consumeInventoryBatches(tx: Tx | typeof db, variantId: number, quantity: number, reason: string, reference?: string) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('INVALID_QUANTITY');
  const [variant] = await tx.select({ stock: productVariants.stock }).from(productVariants).where(eq(productVariants.id, variantId)).for('update');
  if (!variant || variant.stock < quantity) throw new Error('INSUFFICIENT_STOCK');
  const batches = await tx.select().from(inventoryBatches).where(and(eq(inventoryBatches.variantId, variantId), sql`${inventoryBatches.quantityRemaining} > 0`)).orderBy(asc(inventoryBatches.receivedAt), asc(inventoryBatches.id)).for('update');
  let remaining = quantity;
  let totalCost = 0;
  let knownCostUnits = 0;
  const allocations: { batchId: number; quantity: number; purchasePriceCents: number | null }[] = [];
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.quantityRemaining);
    await tx.update(inventoryBatches).set({ quantityRemaining: batch.quantityRemaining - take }).where(eq(inventoryBatches.id, batch.id));
    allocations.push({ batchId: batch.id, quantity: take, purchasePriceCents: batch.purchaseCostIqd });
    if (batch.purchaseCostIqd !== null) { totalCost += batch.purchaseCostIqd * take; knownCostUnits += take; }
    remaining -= take;
  }
  // Any units left over are unbatched stock (added without a purchase batch, e.g. before
  // batch tracking or through a manual stock increase). They can be sold, but their
  // purchase cost is unknown, so the line keeps purchaseCostCents = null rather than an
  // invented cost. The stock check above guarantees these units exist.
  const [updated] = await tx.update(productVariants).set({ stock: sql`${productVariants.stock} - ${quantity}` }).where(eq(productVariants.id, variantId)).returning({ stock: productVariants.stock });
  await tx.insert(inventoryMovements).values({ variantId, delta: -quantity, stockAfter: updated.stock, reason, reference: reference ?? null });
  return { stock: updated.stock, allocations, purchaseCostCents: knownCostUnits === quantity ? Math.round(totalCost / quantity) : null, purchaseTotalCostCents: knownCostUnits === quantity ? totalCost : null };
}

export async function restoreInventoryBatches(tx: Tx | typeof db, item: OrderItem, reason: string, reference?: string) {
  if (item.batchAllocations?.length) {
    let restored = 0;
    for (const allocation of item.batchAllocations) {
      const [batch] = await tx.select({ quantityRemaining: inventoryBatches.quantityRemaining }).from(inventoryBatches).where(eq(inventoryBatches.id, allocation.batchId)).for('update');
      if (batch) {
        await tx.update(inventoryBatches).set({ quantityRemaining: batch.quantityRemaining + allocation.quantity }).where(eq(inventoryBatches.id, allocation.batchId));
        restored += allocation.quantity;
      }
    }
    if (restored === item.quantity) {
      const [updated] = await tx.update(productVariants).set({ stock: sql`${productVariants.stock} + ${item.quantity}` }).where(eq(productVariants.id, item.variantId)).returning({ stock: productVariants.stock });
      await tx.insert(inventoryMovements).values({ variantId: item.variantId, delta: item.quantity, stockAfter: updated.stock, reason, reference: reference ?? null });
      return updated.stock;
    }
  }
  return adjustStock(tx, item.variantId, item.quantity, reason, reference);
}

/**
 * Checks that `quantity` units of a variant can be reserved by a pending order:
 * on hand − units already reserved by other pending orders. Locks the variant row so two
 * checkouts for the last unit are decided one after the other.
 */
export async function assertAvailable(tx: Tx, variantId: number, quantity: number, excludeOrderId?: number) {
  const [variant] = await tx.select({ stock: productVariants.stock }).from(productVariants).where(eq(productVariants.id, variantId)).for('update');
  if (!variant) throw new Error('PRODUCT_NOT_FOUND');
  const available = variant.stock - await reservedForVariant(tx, variantId, excludeOrderId);
  if (quantity > available) throw new Error('INSUFFICIENT_STOCK');
  return available;
}

/** Deducts an order's units from stock (FIFO batches) and snapshots their purchase cost. */
async function commitOrderStock(tx: Tx, items: OrderItem[], reason: string, reference: string) {
  const next: OrderItem[] = [];
  for (const item of items) {
    const consumed = await consumeInventoryBatches(tx, item.variantId, item.quantity, reason, reference);
    const cost = consumed.purchaseCostCents == null ? null : Number(consumed.purchaseCostCents);
    next.push({ ...item, purchaseCostCents: cost, profitIqd: cost == null ? 0 : Number(item.unitPrice || 0) - cost, batchAllocations: consumed.allocations.map(a => ({ batchId: a.batchId, quantity: a.quantity })) });
  }
  return next;
}

/** Puts an order's units back on hand (into the batches they came from). */
async function releaseOrderStock(tx: Tx, items: OrderItem[], reason: string, reference: string) {
  const next: OrderItem[] = [];
  for (const item of items) { await restoreInventoryBatches(tx, item, reason, reference); next.push({ ...item, batchAllocations: [] }); }
  return next;
}

function customerOrderValue(subtotal: number, discount: number) {
  return Math.max(0, Math.round(subtotal) - Math.max(0, Math.round(discount)));
}

export type OrderItem = { productId?: string; variantId: number; name: string; color: string; quantity: number; unitPrice?: number; profitIqd?: number | null; purchaseCostCents?: number | null; purchaseUnitCost?: number | null; batchAllocations?: { batchId: number; quantity: number }[]; image?: string | null; listPrice?: number; promotionId?: number | null; promotionName?: string | null };
export type ProfitItem = { quantity?: number; unitPrice?: number; purchaseCostCents?: number | null };

/**
 * Financial calculation helpers. Discounts belong to the order, so they must
 * be allocated across product lines before calculating product profit. Delivery
 * and COD fees are deliberately excluded from product profit.
 */
export function orderGrossRevenue(items: ProfitItem[]) {
  return items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);
}

export function orderSafeDiscount(items: ProfitItem[], discount: number) {
  return Math.min(Math.max(0, Number(discount) || 0), orderGrossRevenue(items));
}

export function lineNetRevenue(item: ProfitItem, items: ProfitItem[], discount: number) {
  const grossOrder = orderGrossRevenue(items);
  const grossLine = Number(item.unitPrice || 0) * Number(item.quantity || 0);
  const safeDiscount = orderSafeDiscount(items, discount);
  if (!grossOrder || !grossLine) return 0;
  return Math.max(0, grossLine - safeDiscount * (grossLine / grossOrder));
}

export function lineProductCost(item: ProfitItem) {
  if (item.purchaseCostCents == null) return null;
  return Number(item.purchaseCostCents) * Number(item.quantity || 0);
}

export function lineProductProfit(item: ProfitItem, items: ProfitItem[], discount: number) {
  const cost = lineProductCost(item);
  if (cost == null) return 0;
  return lineNetRevenue(item, items, discount) - cost;
}

export function orderProductProfit(items: ProfitItem[], discount: number) {
  // Monetary values in the database are stored as integer IQD. The discount
  // allocation can produce fractional intermediate values, so round only
  // once at the order total. This keeps the stored accounting value valid
  // while preserving the exact proportional allocation for line reporting.
  return Math.round(items.reduce((sum, item) => sum + lineProductProfit(item, items, discount), 0));
}
export async function transitionOrder(orderId: number, next: OrderStatus, extra: { trackingNumber?: string | null; courier?: string | null; adminNote?: string | null; paymentStatus?: string } = {}) {
  const result = await db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
    if (!order) throw new Error('NOT_FOUND');
    const previous = order.status;
    const wasCancelled = previous === 'cancelled' || previous === 'returned';
    const willCancel = next === 'cancelled' || next === 'returned';
    let items = order.items as OrderItem[];
    const heldStock = statusHoldsStock(previous), holdsStock = statusHoldsStock(next);
    if (heldStock && !holdsStock) {
      const reason = next === 'returned' ? 'Order returned' : next === 'cancelled' ? 'Order cancelled' : 'Order moved back to pending';
      items = await releaseOrderStock(tx, items, reason, order.reference);
    } else if (!heldStock && holdsStock) {
      // Confirming takes the units out of stock now. A pending order's own reservation is part of
      // the stock on hand, so only physical stock has to cover it.
      items = await commitOrderStock(tx, items, previous === 'pending' ? 'Order confirmed' : 'Order reinstated', order.reference);
    } else if (!holdsStock && next === 'pending' && wasCancelled) {
      // Reinstated as pending: it reserves units again, so they must still be available.
      for (const item of items) await assertAvailable(tx, item.variantId, item.quantity, orderId);
    }
    if (items !== order.items) await tx.update(orders).set({ items }).where(eq(orders.id, orderId));
    if (!wasCancelled && willCancel) await releaseCoupon(tx, order.couponCode);
    if (wasCancelled && !willCancel) await reclaimCoupon(tx, order.couponCode);
    const paymentStatus = extra.paymentStatus ?? (next === 'delivered' && order.paymentMethod === 'cod' ? 'paid' : willCancel ? (order.paymentStatus === 'paid' ? 'refunded' : 'unpaid') : order.paymentStatus);
    // Financial recognition starts only when the order is delivered. Pending/confirmed/processing/shipped
    // orders are operationally active but must not contribute to realized revenue or profit yet.
    const recognizedProfit = next === 'delivered'
      ? orderProductProfit(items, Number(order.discountCents || 0))
      : 0;
    // Keep the original delivery date when a delivered order is only being annotated.
    const deliveredAt = next === 'delivered' ? (previous === 'delivered' && order.deliveredAt ? order.deliveredAt : new Date()) : null;
    await tx.update(orders).set({ status: next, paymentStatus, profitIqd: recognizedProfit, deliveredAt, trackingNumber: extra.trackingNumber === undefined ? order.trackingNumber : extra.trackingNumber, courier: extra.courier === undefined ? order.courier : extra.courier, adminNote: extra.adminNote === undefined ? order.adminNote : extra.adminNote, updatedAt: new Date() }).where(eq(orders.id, orderId));
    if (order.customerId && !wasCancelled && willCancel) {
      const value = customerOrderValue(order.subtotalCents, order.discountCents);
      const [last] = await tx.select({ lastOrderAt: max(orders.createdAt) }).from(orders).where(and(eq(orders.customerId, order.customerId), sql`${orders.id} <> ${orderId}`, sql`${orders.status} NOT IN ('cancelled','returned')`));
      await tx.update(customers).set({ ordersCount: sql`GREATEST(${customers.ordersCount} - 1, 0)`, totalSpent: sql`GREATEST(${customers.totalSpent} - ${value}, 0)`, lastOrderAt: last?.lastOrderAt ?? null, updatedAt: new Date() }).where(eq(customers.id, order.customerId));
    } else if (order.customerId && wasCancelled && !willCancel) {
      const value = customerOrderValue(order.subtotalCents, order.discountCents);
      await tx.update(customers).set({ ordersCount: sql`${customers.ordersCount} + 1`, totalSpent: sql`${customers.totalSpent} + ${value}`, lastOrderAt: sql`GREATEST(COALESCE(${customers.lastOrderAt}, ${order.createdAt}), ${order.createdAt})`, updatedAt: new Date() }).where(eq(customers.id, order.customerId));
    }
    await tx.insert(orderEvents).values({ orderId, type: next, message: `Order ${next}${extra.trackingNumber ? ` · ${extra.trackingNumber}` : ''}` });
    return orderId;
  });
  invalidateCatalog();
  return result;
}

export async function updateOrderDetails(orderId: number, input: {
  name: string; phone: string; email?: string; governorate: string; city: string; address: string; landmark?: string;
  source?: string; sourceNote?: string | null; shippingCents: number; discountCents: number; paymentMethod: string; paymentStatus: string; customerNote?: string | null;
  items?: { variantId: number; quantity: number; unitPrice: number; profitIqd?: number }[];
}) {
  const result = await db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
    if (!order) throw new Error('NOT_FOUND');
    const [zone] = await tx.select().from(shippingZones).where(eq(shippingZones.code, input.governorate));
    if (!zone || !zone.enabled) throw new Error('INVALID_GOVERNORATE');
    let nextItems = order.items as OrderItem[];
    if (input.items) {
      if (order.status === 'delivered') throw new Error('CANNOT_EDIT_DELIVERED_ITEMS');
      if (!input.items.length) throw new Error('INVALID_ITEMS');
      const requested = input.items.map(item => ({ variantId: Number(item.variantId), quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) }));
      if (requested.some(item => !Number.isInteger(item.variantId) || !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isInteger(item.unitPrice) || item.unitPrice < 0 || false)) throw new Error('INVALID_ITEMS');
      const holds = statusHoldsStock(order.status);
      if (holds) for (const item of nextItems) await restoreInventoryBatches(tx, item, 'Order edited', order.reference);
      nextItems = [];
      for (const requestedItem of requested) {
        const [line] = await tx.select({ variantId: productVariants.id, productId: products.id, name: products.name, color: productVariants.name, stock: productVariants.stock, image: productVariants.images, primaryIndex: productVariants.primaryIndex }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).where(eq(productVariants.id, requestedItem.variantId)).for('update', { of: productVariants });
        if (!line) throw new Error('PRODUCT_NOT_FOUND');
        const base = { productId: line.productId, variantId: requestedItem.variantId, name: line.name, color: line.color, quantity: requestedItem.quantity, unitPrice: requestedItem.unitPrice, image: line.image?.[line.primaryIndex] ?? line.image?.[0] ?? null };
        if (holds) {
          if (requestedItem.quantity > line.stock) throw new Error(`INSUFFICIENT_STOCK:${line.name} / ${line.color}`);
          const consumed = await consumeInventoryBatches(tx, requestedItem.variantId, requestedItem.quantity, 'Order edited', order.reference);
          nextItems.push({ ...base, profitIqd: consumed.purchaseCostCents == null ? 0 : requestedItem.unitPrice - Number(consumed.purchaseCostCents), purchaseCostCents: consumed.purchaseCostCents, batchAllocations: consumed.allocations.map(a => ({ batchId: a.batchId, quantity: a.quantity })) });
        } else {
          if (order.status === 'pending') {
            const sameVariantBefore = nextItems.filter(item => item.variantId === requestedItem.variantId).reduce((sum, item) => sum + item.quantity, 0);
            try { await assertAvailable(tx, requestedItem.variantId, sameVariantBefore + requestedItem.quantity, orderId); }
            catch { throw new Error(`INSUFFICIENT_STOCK:${line.name} / ${line.color}`); }
          }
          nextItems.push({ ...base, profitIqd: 0, purchaseCostCents: null, batchAllocations: [] });
        }
      }
    }
    const subtotal = nextItems.reduce((sum, item) => sum + Number(item.unitPrice || 0) * item.quantity, 0);
    const safeDiscount = Math.min(Math.max(0, Math.round(input.discountCents)), subtotal);
    const shipping = Math.max(0, Math.round(input.shippingCents));
    const total = Math.max(0, subtotal - safeDiscount) + shipping + order.codFeeCents;
    const orderProfitIqd = order.status === 'delivered' ? orderProductProfit(nextItems, safeDiscount) : 0;
    const oldCustomerId = order.customerId;
    const phoneChanged = input.phone !== order.phone;
    // Cancelled/returned orders were already taken out of the customer's order count and
    // spend when they were cancelled, so editing them must not change those totals again.
    const countsTowardCustomer = order.status !== 'cancelled' && order.status !== 'returned';
    let customerId = oldCustomerId;
    if (!countsTowardCustomer) {
      if (phoneChanged) {
        const [existing] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.phone, input.phone));
        customerId = existing?.id ?? (await tx.insert(customers).values({ phone: input.phone, name: input.name, email: input.email || null, governorate: zone.code, updatedAt: new Date(), ordersCount: 0, totalSpent: 0 }).returning({ id: customers.id }))[0].id;
      }
    } else if (phoneChanged) {
      if (oldCustomerId) await tx.update(customers).set({ ordersCount: sql`GREATEST(${customers.ordersCount} - 1, 0)`, totalSpent: sql`GREATEST(${customers.totalSpent} - ${customerOrderValue(order.subtotalCents, order.discountCents)}, 0)` }).where(eq(customers.id, oldCustomerId));
      const [existing] = await tx.select().from(customers).where(eq(customers.phone, input.phone));
      if (existing) {
        customerId = existing.id;
        await tx.update(customers).set({ name: input.name, email: input.email || existing.email, governorate: zone.code, updatedAt: new Date(), ordersCount: sql`${customers.ordersCount} + 1`, totalSpent: sql`${customers.totalSpent} + ${customerOrderValue(subtotal, safeDiscount)}`, lastOrderAt: new Date() }).where(eq(customers.id, existing.id));
      } else {
        const [createdCustomer] = await tx.insert(customers).values({ phone: input.phone, name: input.name, email: input.email || null, governorate: zone.code, updatedAt: new Date(), ordersCount: 1, totalSpent: customerOrderValue(subtotal, safeDiscount), lastOrderAt: new Date() }).returning({ id: customers.id });
        customerId = createdCustomer.id;
      }
    } else if (oldCustomerId) {
      await tx.update(customers).set({ name: input.name, email: input.email || null, governorate: zone.code, updatedAt: new Date(), totalSpent: sql`GREATEST(${customers.totalSpent} - ${customerOrderValue(order.subtotalCents, order.discountCents)} + ${customerOrderValue(subtotal, safeDiscount)}, 0)`, lastOrderAt: new Date() }).where(eq(customers.id, oldCustomerId));
    }
    await tx.update(orders).set({ customerId, name: input.name, phone: input.phone, email: input.email || '', governorate: zone.code, address: { ...(order.address as Record<string, unknown>), governorate: zone.nameEn, governorateAr: zone.nameAr, city: input.city, line1: input.address, landmark: input.landmark || '', altPhone: (order.address as Record<string, unknown>)?.altPhone || '', country: 'Iraq' }, items: nextItems, subtotalCents: subtotal, source: input.source || order.source, sourceNote: input.sourceNote || null, shippingCents: shipping, discountCents: safeDiscount, totalCents: total, profitIqd: orderProfitIqd, paymentMethod: input.paymentMethod, paymentStatus: input.paymentStatus, customerNote: input.customerNote || null, updatedAt: new Date() }).where(eq(orders.id, orderId));
    await tx.insert(orderEvents).values({ orderId, type: 'edited', message: 'Order details updated' });
    return orderId;
  });
  invalidateCatalog();
  return result;
}

export async function deleteOrder(orderId: number) {
  const result = await db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
    if (!order) throw new Error('NOT_FOUND');
    if (order.status === 'delivered') throw new Error('CANNOT_DELETE_DELIVERED');
    const wasCancelled = order.status === 'cancelled' || order.status === 'returned';
    if (statusHoldsStock(order.status)) await releaseOrderStock(tx, order.items as OrderItem[], 'Order deleted', order.reference);
    if (!wasCancelled) await releaseCoupon(tx, order.couponCode);
    if (order.customerId) {
      // A cancelled/returned order was already removed from the customer's totals.
      if (!wasCancelled) await tx.update(customers).set({ ordersCount: sql`GREATEST(${customers.ordersCount} - 1, 0)`, totalSpent: sql`GREATEST(${customers.totalSpent} - ${customerOrderValue(order.subtotalCents, order.discountCents)}, 0)` }).where(eq(customers.id, order.customerId));
      const [last] = await tx.select({ lastOrderAt: max(orders.createdAt) }).from(orders).where(and(eq(orders.customerId, order.customerId), sql`${orders.id} <> ${orderId}`, sql`${orders.status} NOT IN ('cancelled','returned')`));
      await tx.update(customers).set({ updatedAt: new Date(), lastOrderAt: last?.lastOrderAt ?? null }).where(eq(customers.id, order.customerId));
    }
    await tx.delete(orders).where(eq(orders.id, orderId));
    return orderId;
  });
  invalidateCatalog();
  return result;
}

export async function orderWithEvents(id: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, id)).orderBy(asc(orderEvents.createdAt), asc(orderEvents.id));
  return { order, events };
}
