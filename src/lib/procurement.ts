import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { inventoryBatches, inventoryMovements, productVariants, products, purchaseItems, purchases, supplierPayments, suppliers } from '@/db/schema';

/**
 * Procurement: purchases from suppliers and what we owe them.
 *
 * - A purchase has one or more lines, priced in IQD or USD. Shipping/customs (extra costs) and the
 *   supplier's discount are spread over the lines by value, so each unit carries its true landed
 *   cost in IQD. That landed cost goes on the inventory batch, which is what profit reports use.
 * - Lifecycle: ordered (no stock yet) → received (batches created, stock added) → cancelled.
 *   A received purchase can only be cancelled while none of its units has been sold.
 * - Money: a supplier's balance = opening balance + received purchases − payments. Payments are
 *   applied to the purchase they name first, then to the oldest unpaid purchases (FIFO), so each
 *   purchase shows paid / remaining / overdue without storing a number that can drift.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Exec = typeof db | Tx;

export type PurchaseLineInput = { variantId: number; quantity: number; unitCost: number; salePriceIqd?: number | null };

/** Splits extra costs and discount over the lines in proportion to their value. Returns IQD per unit for each line. */
export function landedCosts(lines: { quantity: number; unitCost: number }[], currency: 'IQD' | 'USD', rate: number, extraIqd: number, discountIqd: number) {
  const toIqd = (unit: number) => currency === 'USD' ? unit / 100 * rate : unit;
  const values = lines.map(l => toIqd(l.unitCost) * l.quantity);
  const subtotal = values.reduce((s, v) => s + v, 0);
  const adjust = extraIqd - discountIqd;
  const units = lines.map((l, i) => {
    const share = subtotal > 0 ? values[i] / subtotal : 1 / lines.length;
    return Math.max(0, Math.round((values[i] + adjust * share) / l.quantity));
  });
  return { subtotalIqd: Math.round(subtotal), units, totalIqd: Math.max(0, Math.round(subtotal + adjust)) };
}

/** Adds the purchase's units to stock: one batch per line at its landed cost, a movement per line. */
export async function receivePurchase(tx: Tx, purchaseId: number, receivedAt: Date, exchangeRate: number) {
  const [p] = await tx.select({ reference: purchases.reference, status: purchases.status }).from(purchases).where(eq(purchases.id, purchaseId)).for('update');
  if (!p) throw new Error('PURCHASE_NOT_FOUND');
  if (p.status !== 'ordered') throw new Error('NOT_ORDERED');
  const lines = await tx.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, purchaseId)).orderBy(asc(purchaseItems.id));
  for (const line of lines) {
    const saleCents = line.salePriceIqd == null ? null : Math.round(line.salePriceIqd / exchangeRate * 100);
    const [batch] = await tx.insert(inventoryBatches).values({ variantId: line.variantId, batchNumber: p.reference, quantityReceived: line.quantity, quantityRemaining: line.quantity, purchaseCostIqd: line.landedCostIqd, purchaseCostUsdCents: Math.round(line.landedCostIqd / exchangeRate * 100), purchaseExchangeRate: exchangeRate, salePriceCents: saleCents, salePriceIqd: line.salePriceIqd, receivedAt, notes: `purchase ${p.reference}` }).returning({ id: inventoryBatches.id });
    await tx.update(purchaseItems).set({ batchId: batch.id }).where(eq(purchaseItems.id, line.id));
    // Atomic increment: an order placed at the same moment must not be overwritten.
    const [{ stock }] = await tx.update(productVariants).set({ stock: sql`${productVariants.stock} + ${line.quantity}` }).where(eq(productVariants.id, line.variantId)).returning({ stock: productVariants.stock });
    await tx.insert(inventoryMovements).values({ variantId: line.variantId, delta: line.quantity, stockAfter: stock, reason: 'purchase', reference: p.reference });
    if (line.salePriceIqd != null && line.salePriceIqd > 0) {
      const [v] = await tx.select({ productId: productVariants.productId }).from(productVariants).where(eq(productVariants.id, line.variantId));
      if (v) await tx.update(products).set({ salePriceIqd: line.salePriceIqd, priceCents: saleCents ?? 0, updatedAt: new Date() }).where(eq(products.id, v.productId));
    }
  }
  await tx.update(purchases).set({ status: 'received', receivedAt, updatedAt: new Date() }).where(eq(purchases.id, purchaseId));
  return { reference: p.reference, lines: lines.length };
}

/** Cancels a purchase. If it was received, its units leave stock again — only while none were sold. */
export async function cancelPurchase(tx: Tx, purchaseId: number) {
  const [p] = await tx.select({ reference: purchases.reference, status: purchases.status }).from(purchases).where(eq(purchases.id, purchaseId)).for('update');
  if (!p) throw new Error('PURCHASE_NOT_FOUND');
  if (p.status === 'cancelled') throw new Error('ALREADY_CANCELLED');
  if (p.status === 'received') {
    const lines = await tx.select({ id: purchaseItems.id, variantId: purchaseItems.variantId, quantity: purchaseItems.quantity, batchId: purchaseItems.batchId }).from(purchaseItems).where(eq(purchaseItems.purchaseId, purchaseId));
    const batchIds = lines.map(l => l.batchId).filter((id): id is number => id != null);
    const batches = batchIds.length ? await tx.select().from(inventoryBatches).where(inArray(inventoryBatches.id, batchIds)).for('update') : [];
    if (batches.some(b => b.quantityRemaining < b.quantityReceived)) throw new Error('UNITS_SOLD');
    for (const line of lines) {
      const [v] = await tx.select({ stock: productVariants.stock }).from(productVariants).where(eq(productVariants.id, line.variantId)).for('update');
      if (!v || v.stock < line.quantity) throw new Error('UNITS_SOLD');
      const [{ stock }] = await tx.update(productVariants).set({ stock: sql`${productVariants.stock} - ${line.quantity}` }).where(eq(productVariants.id, line.variantId)).returning({ stock: productVariants.stock });
      await tx.insert(inventoryMovements).values({ variantId: line.variantId, delta: -line.quantity, stockAfter: stock, reason: 'purchase-cancelled', reference: p.reference });
    }
    await tx.update(purchaseItems).set({ batchId: null }).where(eq(purchaseItems.purchaseId, purchaseId));
    if (batchIds.length) await tx.delete(inventoryBatches).where(inArray(inventoryBatches.id, batchIds));
  }
  await tx.update(purchases).set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() }).where(eq(purchases.id, purchaseId));
  return { reference: p.reference };
}

export type PurchaseLineView = { id: number; variantId: number; productId: string; productName: string; productNameAr: string; color: string; colorAr: string; hex: string; image: string | null; quantity: number; unitCost: number; landedCostIqd: number; salePriceIqd: number | null; sold: number };
export type PaymentView = { id: number; supplierId: number; supplierName: string; purchaseId: number | null; purchaseRef: string | null; amountIqd: number; method: string; paidAt: string; note: string | null; createdBy: string | null };
export type PurchaseView = {
  id: number; reference: string; supplierId: number | null; supplierName: string | null; supplierInvoice: string | null; status: 'ordered' | 'received' | 'cancelled';
  currency: 'IQD' | 'USD'; exchangeRate: number; subtotalIqd: number; extraCostsIqd: number; discountIqd: number; totalIqd: number;
  paidIqd: number; remainingIqd: number; overdue: boolean; dueDate: string | null; purchaseDate: string; receivedAt: string | null; notes: string | null; createdBy: string | null;
  units: number; lines: PurchaseLineView[];
};
export type SupplierView = {
  id: number; name: string; phone: string | null; email: string | null; country: string | null; city: string | null; address: string | null; contactPerson: string | null; notes: string | null; active: boolean;
  openingBalanceIqd: number; paymentTermsDays: number;
  purchasedIqd: number; paidIqd: number; balanceIqd: number; purchases: number; openOrders: number; lastPurchase: string | null; overdueIqd: number; units: number;
};

/** Everything the procurement screen needs, with payments applied to purchases. */
export async function loadProcurement(ex: Exec = db) {
  const [supplierRows, purchaseRows, lineRows, paymentRows] = await Promise.all([
    ex.select().from(suppliers).orderBy(asc(suppliers.name)),
    ex.select({ p: purchases, supplierName: suppliers.name }).from(purchases).leftJoin(suppliers, eq(purchases.supplierId, suppliers.id)).orderBy(desc(purchases.purchaseDate), desc(purchases.id)).limit(500),
    ex.select({ line: purchaseItems, productId: products.id, productName: products.name, productNameAr: products.nameAr, color: productVariants.name, colorAr: productVariants.nameAr, hex: productVariants.hex, images: productVariants.images, primaryIndex: productVariants.primaryIndex, remaining: inventoryBatches.quantityRemaining })
      .from(purchaseItems).innerJoin(productVariants, eq(purchaseItems.variantId, productVariants.id)).innerJoin(products, eq(productVariants.productId, products.id)).leftJoin(inventoryBatches, eq(purchaseItems.batchId, inventoryBatches.id)).orderBy(asc(purchaseItems.id)),
    ex.select({ pay: supplierPayments, supplierName: suppliers.name, purchaseRef: purchases.reference }).from(supplierPayments).innerJoin(suppliers, eq(supplierPayments.supplierId, suppliers.id)).leftJoin(purchases, eq(supplierPayments.purchaseId, purchases.id)).orderBy(desc(supplierPayments.paidAt), desc(supplierPayments.id)),
  ]);
  const linesBy = new Map<number, PurchaseLineView[]>();
  for (const r of lineRows) {
    const l = r.line;
    const view: PurchaseLineView = { id: l.id, variantId: l.variantId, productId: r.productId, productName: r.productName, productNameAr: r.productNameAr || r.productName, color: r.color, colorAr: r.colorAr || r.color, hex: r.hex, image: r.images?.[r.primaryIndex] ?? r.images?.[0] ?? null, quantity: l.quantity, unitCost: l.unitCost || l.purchaseCostIqd, landedCostIqd: l.landedCostIqd || l.purchaseCostIqd, salePriceIqd: l.salePriceIqd, sold: r.remaining == null ? 0 : Math.max(0, l.quantity - r.remaining) };
    (linesBy.get(l.purchaseId) ?? linesBy.set(l.purchaseId, []).get(l.purchaseId)!).push(view);
  }
  const now = Date.now();
  const views: PurchaseView[] = purchaseRows.map(({ p, supplierName }) => {
    const lines = linesBy.get(p.id) ?? [];
    return { id: p.id, reference: p.reference, supplierId: p.supplierId, supplierName, supplierInvoice: p.supplierInvoice, status: (['ordered', 'received', 'cancelled'].includes(p.status) ? p.status : 'received') as PurchaseView['status'], currency: p.currency === 'USD' ? 'USD' : 'IQD', exchangeRate: p.exchangeRate, subtotalIqd: p.subtotalIqd || p.totalCostIqd, extraCostsIqd: p.extraCostsIqd, discountIqd: p.discountIqd, totalIqd: p.totalCostIqd, paidIqd: 0, remainingIqd: 0, overdue: false, dueDate: p.dueDate?.toISOString() ?? null, purchaseDate: p.purchaseDate.toISOString(), receivedAt: p.receivedAt?.toISOString() ?? null, notes: p.notes, createdBy: p.createdBy, units: lines.reduce((s, l) => s + l.quantity, 0), lines };
  });

  // Apply payments: first to the purchase they name, then oldest-first across the supplier's purchases.
  const payable = (v: PurchaseView) => v.status !== 'cancelled' && v.supplierId != null;
  const bySupplier = new Map<number, PurchaseView[]>();
  for (const v of views) if (payable(v)) (bySupplier.get(v.supplierId!) ?? bySupplier.set(v.supplierId!, []).get(v.supplierId!)!).push(v);
  for (const list of bySupplier.values()) list.sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate) || a.id - b.id);
  const viewById = new Map(views.map(v => [v.id, v]));
  const free = new Map<number, number>();
  for (const { pay } of [...paymentRows].reverse()) {
    let amount = pay.amountIqd;
    const target = pay.purchaseId != null ? viewById.get(pay.purchaseId) : undefined;
    if (target && payable(target)) { const take = Math.min(amount, target.totalIqd - target.paidIqd); target.paidIqd += take; amount -= take; }
    free.set(pay.supplierId, (free.get(pay.supplierId) ?? 0) + amount);
  }
  for (const [supplierId, list] of bySupplier) {
    const s = supplierRows.find(x => x.id === supplierId);
    let pool = (free.get(supplierId) ?? 0) - Math.max(0, s?.openingBalanceIqd ?? 0); // payments settle the opening balance first
    if (pool < 0) pool = 0;
    for (const v of list) { const take = Math.min(pool, v.totalIqd - v.paidIqd); v.paidIqd += take; pool -= take; }
  }
  for (const v of views) {
    v.remainingIqd = payable(v) ? Math.max(0, v.totalIqd - v.paidIqd) : 0;
    v.overdue = v.remainingIqd > 0 && !!v.dueDate && new Date(v.dueDate).getTime() < now;
  }

  const paymentsBySupplier = new Map<number, number>();
  for (const { pay } of paymentRows) paymentsBySupplier.set(pay.supplierId, (paymentsBySupplier.get(pay.supplierId) ?? 0) + pay.amountIqd);
  const supplierViews: SupplierView[] = supplierRows.map(s => {
    const mine = views.filter(v => v.supplierId === s.id);
    const live = mine.filter(v => v.status !== 'cancelled');
    const owedPurchases = live.filter(v => v.status === 'received');
    const purchasedIqd = owedPurchases.reduce((t, v) => t + v.totalIqd, 0);
    const paidIqd = paymentsBySupplier.get(s.id) ?? 0;
    return { id: s.id, name: s.name, phone: s.phone, email: s.email, country: s.country, city: s.city, address: s.address, contactPerson: s.contactPerson, notes: s.notes, active: s.active, openingBalanceIqd: s.openingBalanceIqd, paymentTermsDays: s.paymentTermsDays, purchasedIqd, paidIqd, balanceIqd: s.openingBalanceIqd + purchasedIqd - paidIqd, purchases: live.length, openOrders: live.filter(v => v.status === 'ordered').length, lastPurchase: live[0]?.purchaseDate ?? null, overdueIqd: live.filter(v => v.overdue).reduce((t, v) => t + v.remainingIqd, 0), units: owedPurchases.reduce((t, v) => t + v.units, 0) };
  });
  const payments: PaymentView[] = paymentRows.map(({ pay, supplierName, purchaseRef }) => ({ id: pay.id, supplierId: pay.supplierId, supplierName, purchaseId: pay.purchaseId, purchaseRef, amountIqd: pay.amountIqd, method: pay.method, paidAt: pay.paidAt.toISOString(), note: pay.note, createdBy: pay.createdBy }));
  return { purchases: views, suppliers: supplierViews, payments };
}

/** Next purchase reference: PO-0001, PO-0002 … */
export async function nextPurchaseReference(tx: Tx) {
  const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(purchases);
  let n = (row?.n ?? 0) + 1;
  for (;;) {
    const ref = `PO-${String(n).padStart(4, '0')}`;
    const [taken] = await tx.select({ id: purchases.id }).from(purchases).where(eq(purchases.reference, ref)).limit(1);
    if (!taken) return ref;
    n++;
  }
}

export async function supplierExists(tx: Tx, id: number) {
  const [row] = await tx.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, id))).limit(1);
  return !!row;
}
