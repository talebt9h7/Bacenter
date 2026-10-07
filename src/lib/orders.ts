import { and, asc, desc, eq, max, sql } from 'drizzle-orm';
import { db } from '@/db';
import { activityLog, coupons, customers, inventoryBatches, inventoryMovements, orderEvents, orders, productVariants, products, shippingZones } from '@/db/schema';
import { roundIqd } from './iraq';
import type { OrderStatus } from './iraq';

export async function logActivity(action: string, entity: string, entityId?: string | number, details?: string) {
  await db.insert(activityLog).values({ action, entity, entityId: entityId === undefined ? null : String(entityId), details: details ?? null });
}
export async function validateCoupon(codeRaw: string, subtotal: number) {
  const code = codeRaw.trim().toUpperCase();
  if (!code) return { error: 'Enter a coupon code.' };
  const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code));
  if (!coupon || !coupon.active) return { error: 'That coupon isn’t valid.' };
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return { error: 'That coupon has expired.' };
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return { error: 'That coupon has been fully redeemed.' };
  if (subtotal < coupon.minSubtotal) return { error: `This coupon needs a minimum order of ${coupon.minSubtotal.toLocaleString('en-US')} IQD.` };
  const discount = coupon.type === 'percent' ? roundIqd(subtotal * Math.min(coupon.value, 100) / 100) : Math.min(coupon.value, subtotal);
  return { coupon, discount, freeShipping: coupon.freeShipping };
}
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Adjust stock and keep the legacy movement ledger in sync. */
export async function adjustStock(tx: Tx | typeof db, variantId: number, delta: number, reason: string, reference?: string) {
  const [updated] = await tx.update(productVariants).set({ stock: sql`GREATEST(${productVariants.stock} + ${delta}, 0)` }).where(eq(productVariants.id, variantId)).returning({ stock: productVariants.stock });
  if (updated) await tx.insert(inventoryMovements).values({ variantId, delta, stockAfter: updated.stock, reason, reference: reference ?? null });
  return updated?.stock;
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
  // Existing stock created before batch tracking has no known purchase cost. Preserve that fact rather than inventing a cost.
  if (remaining > 0) throw new Error('BATCH_STOCK_MISMATCH');
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

function customerOrderValue(subtotal: number, discount: number) {
  return Math.max(0, Math.round(subtotal) - Math.max(0, Math.round(discount)));
}

export type OrderItem = { productId?: string; variantId: number; name: string; color: string; quantity: number; unitPrice?: number; profitIqd?: number | null; purchaseCostCents?: number | null; purchaseUnitCost?: number | null; batchAllocations?: { batchId: number; quantity: number }[]; image?: string | null };
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
  return db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
    if (!order) throw new Error('NOT_FOUND');
    const previous = order.status;
    const wasCancelled = previous === 'cancelled' || previous === 'returned';
    const willCancel = next === 'cancelled' || next === 'returned';
    if (!wasCancelled && willCancel) for (const item of order.items as OrderItem[]) await restoreInventoryBatches(tx, item, next === 'returned' ? 'Order returned' : 'Order cancelled', order.reference);
    if (wasCancelled && !willCancel) {
      const nextItems: OrderItem[] = [];
      for (const item of order.items as OrderItem[]) {
        let allocations = item.batchAllocations ?? [];
        let restoredAvailability = true;
        for (const allocation of allocations) {
          const [batch] = await tx.select({ quantityRemaining: inventoryBatches.quantityRemaining }).from(inventoryBatches).where(eq(inventoryBatches.id, allocation.batchId)).for('update');
          if (!batch || batch.quantityRemaining < allocation.quantity) { restoredAvailability = false; break; }
        }
        if (restoredAvailability && allocations.length) {
          for (const allocation of allocations) await tx.update(inventoryBatches).set({ quantityRemaining: sql`${inventoryBatches.quantityRemaining} - ${allocation.quantity}` }).where(eq(inventoryBatches.id, allocation.batchId));
          const [updated] = await tx.update(productVariants).set({ stock: sql`${productVariants.stock} - ${item.quantity}` }).where(eq(productVariants.id, item.variantId)).returning({ stock: productVariants.stock });
          if (!updated || updated.stock < 0) throw new Error('INSUFFICIENT_STOCK');
          await tx.insert(inventoryMovements).values({ variantId: item.variantId, delta: -item.quantity, stockAfter: updated.stock, reason: 'Order reinstated', reference: order.reference });
        } else {
          const consumed = await consumeInventoryBatches(tx, item.variantId, item.quantity, 'Order reinstated', order.reference);
          allocations = consumed.allocations.map(allocation => ({ batchId: allocation.batchId, quantity: allocation.quantity }));
        }
        nextItems.push({ ...item, batchAllocations: allocations });
      }
      await tx.update(orders).set({ items: nextItems }).where(eq(orders.id, orderId));
    }
    const paymentStatus = extra.paymentStatus ?? (next === 'delivered' && order.paymentMethod === 'cod' ? 'paid' : willCancel ? (order.paymentStatus === 'paid' ? 'refunded' : 'unpaid') : order.paymentStatus);
    // Financial recognition starts only when the order is delivered. Pending/confirmed/processing/shipped
    // orders are operationally active but must not contribute to realized revenue or profit yet.
    const recognizedProfit = next === 'delivered'
      ? orderProductProfit(order.items as OrderItem[], Number(order.discountCents || 0))
      : 0;
    await tx.update(orders).set({ status: next, paymentStatus, profitIqd: recognizedProfit, trackingNumber: extra.trackingNumber === undefined ? order.trackingNumber : extra.trackingNumber, courier: extra.courier === undefined ? order.courier : extra.courier, adminNote: extra.adminNote === undefined ? order.adminNote : extra.adminNote, updatedAt: new Date() }).where(eq(orders.id, orderId));
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
}

export async function updateOrderDetails(orderId: number, input: {
  name: string; phone: string; email?: string; governorate: string; city: string; address: string; landmark?: string;
  source?: string; sourceNote?: string | null; shippingCents: number; discountCents: number; paymentMethod: string; paymentStatus: string; customerNote?: string | null;
  items?: { variantId: number; quantity: number; unitPrice: number; profitIqd?: number }[];
}) {
  return db.transaction(async tx => {
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
      if (order.status !== 'cancelled' && order.status !== 'returned') {
        for (const item of nextItems) await restoreInventoryBatches(tx, item, 'Order edited', order.reference);
      }
      nextItems = [];
      for (const requestedItem of requested) {
        const [line] = await tx.select({ variantId: productVariants.id, productId: products.id, name: products.name, color: productVariants.name, stock: productVariants.stock, image: productVariants.images, primaryIndex: productVariants.primaryIndex }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).where(eq(productVariants.id, requestedItem.variantId)).for('update', { of: productVariants });
        if (!line) throw new Error('PRODUCT_NOT_FOUND');
        if (order.status !== 'cancelled' && order.status !== 'returned') {
          if (requestedItem.quantity > line.stock) throw new Error(`INSUFFICIENT_STOCK:${line.name} / ${line.color}`);
          const consumed = await consumeInventoryBatches(tx, requestedItem.variantId, requestedItem.quantity, 'Order edited', order.reference);
          nextItems.push({ productId: line.productId, variantId: requestedItem.variantId, name: line.name, color: line.color, quantity: requestedItem.quantity, unitPrice: requestedItem.unitPrice, profitIqd: consumed.purchaseCostCents == null ? 0 : requestedItem.unitPrice - Number(consumed.purchaseCostCents), purchaseCostCents: consumed.purchaseCostCents, batchAllocations: consumed.allocations.map(a => ({ batchId: a.batchId, quantity: a.quantity })), image: line.image?.[line.primaryIndex] ?? line.image?.[0] ?? null });
        } else {
          nextItems.push({ productId: line.productId, variantId: requestedItem.variantId, name: line.name, color: line.color, quantity: requestedItem.quantity, unitPrice: requestedItem.unitPrice, profitIqd: 0, purchaseCostCents: null, batchAllocations: [], image: line.image?.[line.primaryIndex] ?? line.image?.[0] ?? null });
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
    let customerId = oldCustomerId;
    if (phoneChanged) {
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
}

export async function deleteOrder(orderId: number) {
  return db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
    if (!order) throw new Error('NOT_FOUND');
    if (order.status === 'delivered') throw new Error('CANNOT_DELETE_DELIVERED');
    const wasCancelled = order.status === 'cancelled' || order.status === 'returned';
    if (!wasCancelled) for (const item of order.items as OrderItem[]) await restoreInventoryBatches(tx, item, 'Order deleted', order.reference);
    if (order.customerId) {
      await tx.update(customers).set({ ordersCount: sql`GREATEST(${customers.ordersCount} - 1, 0)`, totalSpent: sql`GREATEST(${customers.totalSpent} - ${customerOrderValue(order.subtotalCents, order.discountCents)}, 0)` }).where(eq(customers.id, order.customerId));
      const [last] = await tx.select({ lastOrderAt: max(orders.createdAt) }).from(orders).where(and(eq(orders.customerId, order.customerId), sql`${orders.id} <> ${orderId}`));
      await tx.update(customers).set({ updatedAt: new Date(), lastOrderAt: last?.lastOrderAt ?? null }).where(eq(customers.id, order.customerId));
    }
    await tx.delete(orders).where(eq(orders.id, orderId));
    return orderId;
  });
}

export async function orderWithEvents(id: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, id)).orderBy(asc(orderEvents.createdAt), asc(orderEvents.id));
  return { order, events };
}
