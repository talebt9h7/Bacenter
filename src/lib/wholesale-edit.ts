import { and, asc, eq, inArray, max, sql } from 'drizzle-orm';
import { db } from '@/db';
import { activityLog, customers, orderEvents, orders, productVariants, products } from '@/db/schema';
import { iraqPhonePattern, normalizeIraqPhone } from '@/lib/iraq';
import { assertAvailable, consumeInventoryBatches, orderProductProfit, restoreInventoryBatches, type OrderItem } from '@/lib/orders';
import { variantNameArSql, variantNameSql, variantPriceSql } from '@/lib/variant-sql';

export class WholesaleEditError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

type EditLine = { variantId: number; quantity: number; unitPrice: number; retailPrice: number };
type WholesaleItem = OrderItem & { nameAr?: string; colorAr?: string };
function fail(message: string, status = 400): never { throw new WholesaleEditError(message, status); }
const money = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647;

/** Split off returned units without changing the historical cost of the units still sold. */
function splitItem(item: WholesaleItem, keep: number): [WholesaleItem, WholesaleItem] {
  let left = keep;
  const retained: NonNullable<OrderItem['batchAllocations']> = [], returned: NonNullable<OrderItem['batchAllocations']> = [];
  for (const a of item.batchAllocations ?? []) {
    const n = Math.min(left, a.quantity);
    if (n) retained.push({ ...a, quantity: n });
    if (a.quantity > n) returned.push({ ...a, quantity: a.quantity - n });
    left -= n;
  }
  return [{ ...item, quantity: keep, batchAllocations: retained }, { ...item, quantity: item.quantity - keep, batchAllocations: returned }];
}

/** Delivered wholesale invoices have their own editor; ordinary delivered orders stay locked. */
export async function editWholesaleInvoice(id: number, raw: unknown, executor: typeof db = db) {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const text = (key: string, limit: number) => typeof b[key] === 'string' ? b[key].trim().slice(0, limit) : '';
  const name = text('name', 100), phone = normalizeIraqPhone(text('phone', 30));
  const city = text('city', 120), shop = text('shop', 120), note = text('note', 500);
  if (!Number.isSafeInteger(id) || id <= 0) fail('رقم الفاتورة غير صالح.');
  if (name.length < 2 || !iraqPhonePattern.test(phone)) fail('أدخل اسم التاجر ورقم موبايل عراقي صحيح.');
  if (!money(b.discount)) fail('أدخل خصماً صحيحاً بالدينار.');
  if (typeof b.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(b.expectedUpdatedAt))) fail('أعد فتح الفاتورة قبل تعديلها.', 409);
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 200) fail('أضف منتجاً واحداً على الأقل (بحد أقصى 200 سطر).');
  const lines: EditLine[] = [];
  const seen = new Set<number>();
  for (const value of b.items as unknown[]) {
    const l = (value && typeof value === 'object' ? value : {}) as EditLine;
    if (!Number.isSafeInteger(l.variantId) || l.variantId <= 0 || !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 10000 || !money(l.unitPrice) || !money(l.retailPrice) || seen.has(l.variantId)) fail('تأكد من المنتجات والكميات والأسعار، ولا تكرر نفس اللون بسطرين.');
    seen.add(l.variantId); lines.push(l);
  }
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const discount = b.discount as number;
  if (!money(subtotal) || discount > subtotal) fail('الإجمالي غير صالح أو الخصم أكبر من مجموع الفاتورة.');
  const total = subtotal - discount;

  return executor.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(and(eq(orders.id, id), eq(orders.source, 'wholesale'))).for('update');
    if (!order) fail('فاتورة الجملة غير موجودة.', 404);
    if (order.status !== 'delivered') fail('يمكن تعديل فواتير الجملة المسلّمة فقط؛ الفاتورة الملغاة أو المرتجعة لا يمكن تعديلها.', 409);
    if (order.updatedAt.getTime() !== Date.parse(b.expectedUpdatedAt as string)) fail('تغيّرت الفاتورة أو انقبضت دفعة بعد فتحها. أعد فتحها حتى تعدّل أحدث نسخة.', 409);
    if (total < order.paidCents) fail(`إجمالي الفاتورة لا يمكن أن يقل عن المقبوض (${order.paidCents.toLocaleString('en-US')} د.ع). عالج ردّ المبلغ أولاً.`, 409);

    const previous = order.items as WholesaleItem[];
    const ids = [...new Set([...previous.map(i => i.variantId), ...lines.map(i => i.variantId)])].sort((a, b) => a - b);
    const variants = await tx.select({ id: productVariants.id, productId: products.id, name: products.name, nameAr: products.nameAr, color: variantNameSql, colorAr: variantNameArSql, retail: variantPriceSql, images: productVariants.images, primaryIndex: productVariants.primaryIndex })
      .from(productVariants).innerJoin(products, eq(products.id, productVariants.productId)).where(inArray(productVariants.id, ids)).orderBy(asc(productVariants.id)).for('update', { of: productVariants });
    const byId = new Map(variants.map(v => [v.id, v]));
    const requested = new Map(lines.map(l => [l.variantId, l]));
    const remaining = new Map(lines.map(l => [l.variantId, l.quantity]));
    const retained: WholesaleItem[] = [];
    // Return only removed units, to their original purchase batches. Price-only edits never move stock.
    for (const item of previous) {
      const keep = Math.min(item.quantity, remaining.get(item.variantId) ?? 0);
      const [kept, returned] = splitItem(item, keep);
      if (returned.quantity) {
        if (!byId.has(item.variantId)) fail('أحد ألوان الفاتورة انحذف. لا يمكن تغيير كميته قبل معالجة سجل المخزون.', 409);
        await restoreInventoryBatches(tx, returned, 'Wholesale invoice edited · return', order.reference);
      }
      remaining.set(item.variantId, (remaining.get(item.variantId) ?? 0) - keep);
      if (keep) {
        const l = requested.get(item.variantId)!;
        retained.push({ ...kept, unitPrice: l.unitPrice, listPrice: l.retailPrice, profitIqd: kept.purchaseCostCents == null ? 0 : l.unitPrice - kept.purchaseCostCents });
      }
    }
    const items = [...retained];
    // Extra units use today's available stock and FIFO cost, without rewriting costs already recorded.
    for (const line of [...lines].sort((a, b) => a.variantId - b.variantId)) {
      const quantity = remaining.get(line.variantId) ?? 0;
      if (!quantity) continue;
      const v = byId.get(line.variantId);
      if (!v) fail('أحد المنتجات أو الألوان لم يعد موجوداً.', 409);
      try { await assertAvailable(tx, line.variantId, quantity); }
      catch (e) { if (e instanceof Error && e.message === 'INSUFFICIENT_STOCK') fail(`المخزون المتاح لا يكفي: ${v.nameAr || v.name} / ${v.colorAr || v.color}.`, 409); throw e; }
      const consumed = await consumeInventoryBatches(tx, line.variantId, quantity, 'Wholesale invoice edited · add', order.reference);
      const cost = consumed.purchaseCostCents;
      items.push({ productId: v.productId, variantId: line.variantId, name: v.name, nameAr: v.nameAr, color: v.color, colorAr: v.colorAr, quantity, unitPrice: line.unitPrice, listPrice: line.retailPrice, purchaseCostCents: cost, profitIqd: cost == null ? 0 : line.unitPrice - cost, batchAllocations: consumed.allocations.map(a => ({ batchId: a.batchId, quantity: a.quantity })), image: v.images?.[v.primaryIndex] ?? v.images?.[0] ?? null });
    }

    let customerId = order.customerId;
    if (phone !== order.phone || !customerId) {
      if (customerId) {
        const [last] = await tx.select({ at: max(orders.createdAt) }).from(orders).where(and(eq(orders.customerId, customerId), sql`${orders.id} <> ${id}`, sql`${orders.status} NOT IN ('cancelled', 'returned')`));
        await tx.update(customers).set({ ordersCount: sql`GREATEST(${customers.ordersCount} - 1, 0)`, totalSpent: sql`GREATEST(${customers.totalSpent} - ${order.totalCents}, 0)`, lastOrderAt: last.at, updatedAt: new Date() }).where(eq(customers.id, customerId));
      }
      const [customer] = await tx.insert(customers).values({ phone, name, ordersCount: 1, totalSpent: total, lastOrderAt: order.createdAt, tags: ['wholesale'] }).onConflictDoUpdate({ target: customers.phone, set: { name, ordersCount: sql`${customers.ordersCount} + 1`, totalSpent: sql`${customers.totalSpent} + ${total}`, lastOrderAt: sql`GREATEST(COALESCE(${customers.lastOrderAt}, ${order.createdAt}), ${order.createdAt})`, updatedAt: new Date(), tags: sql`(select coalesce(jsonb_agg(distinct t), '[]'::jsonb) from jsonb_array_elements_text(${customers.tags} || '["wholesale"]'::jsonb) t)` } }).returning({ id: customers.id });
      customerId = customer.id;
    } else {
      await tx.update(customers).set({ name, totalSpent: sql`GREATEST(${customers.totalSpent} - ${order.totalCents} + ${total}, 0)`, updatedAt: new Date() }).where(eq(customers.id, customerId));
    }
    const updatedAt = new Date(Math.max(Date.now(), order.updatedAt.getTime() + 1));
    await tx.update(orders).set({ customerId, name, phone, address: { ...(order.address as Record<string, unknown>), city, line1: shop }, sourceNote: shop || null, customerNote: note || null, items, subtotalCents: subtotal, discountCents: discount, totalCents: total, profitIqd: orderProductProfit(items, discount), paymentMethod: total > order.paidCents ? 'credit' : order.paymentMethod, paymentStatus: order.paidCents >= total ? 'paid' : order.paidCents > 0 ? 'partial' : 'unpaid', updatedAt }).where(eq(orders.id, id));
    await tx.insert(orderEvents).values({ orderId: id, type: 'edited', message: `Wholesale invoice edited · ${order.totalCents} → ${total} IQD · received payments unchanged` });
    await tx.insert(activityLog).values({ action: 'wholesale.edit', entity: 'order', entityId: String(id), details: `${order.reference} · ${order.totalCents} → ${total} IQD` });
    return { id, reference: order.reference };
  });
}
