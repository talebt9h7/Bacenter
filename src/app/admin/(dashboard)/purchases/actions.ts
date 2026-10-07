'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { inventoryBatches, inventoryMovements, productVariants, purchaseItems, purchases, suppliers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdminSection } from '@/lib/admin-auth';
import { getSettings } from '@/lib/settings';

export async function createSupplier(formData: FormData) {
  if (!(await requireAdminSection('catalog', 'manage'))) throw new Error('Forbidden');
  const name = String(formData.get('name') || '').trim();
  if (!name) throw new Error('Supplier name is required');
  await db.insert(suppliers).values({
    name,
    phone: String(formData.get('phone') || '').trim() || null,
    email: String(formData.get('email') || '').trim() || null,
    country: String(formData.get('country') || '').trim() || null,
    address: String(formData.get('address') || '').trim() || null,
    notes: String(formData.get('notes') || '').trim() || null,
  });
  revalidatePath('/admin/purchases');
}

export async function createPurchase(formData: FormData) {
  if (!(await requireAdminSection('catalog', 'manage'))) throw new Error('Forbidden');
  const supplierIdRaw = String(formData.get('supplierId') || '');
  const variantId = Number(formData.get('variantId'));
  const quantity = Number(formData.get('quantity'));
  const purchaseCostUsd = Number(formData.get('purchaseCostUsd'));
  const salePriceIqdRaw = String(formData.get('salePriceIqd') || '');
  const salePriceIqd = salePriceIqdRaw ? Number(salePriceIqdRaw) : null;
  const settings = await getSettings();
  const exchangeRate = settings.exchangeRate;
  const reference = String(formData.get('reference') || '').trim() || `PUR-${Date.now()}`;
  const purchaseDateRaw = String(formData.get('purchaseDate') || '');
  const notes = String(formData.get('notes') || '').trim() || null;
  if (!variantId || quantity <= 0 || !Number.isFinite(purchaseCostUsd) || purchaseCostUsd < 0 || (salePriceIqd !== null && (!Number.isFinite(salePriceIqd) || salePriceIqd < 0))) throw new Error('Invalid purchase values');
  await db.transaction(async tx => {
    const [variant] = await tx.select({ id: productVariants.id, stock: productVariants.stock }).from(productVariants).where(eq(productVariants.id, variantId)).limit(1);
    if (!variant) throw new Error('Variant not found');
    const purchaseCostUsdCents = Math.round(purchaseCostUsd * 100);
    const purchaseCostIqd = Math.round(purchaseCostUsd * exchangeRate);
    const totalCostIqd = quantity * purchaseCostIqd;
    const [purchase] = await tx.insert(purchases).values({ reference, supplierId: supplierIdRaw ? Number(supplierIdRaw) : null, totalCostIqd, purchaseDate: purchaseDateRaw ? new Date(purchaseDateRaw) : new Date(), notes }).returning({ id: purchases.id });
    const [batch] = await tx.insert(inventoryBatches).values({ variantId, batchNumber: reference, quantityReceived: quantity, quantityRemaining: quantity, purchaseCostIqd, purchaseCostUsdCents, purchaseExchangeRate: exchangeRate, salePriceCents: salePriceIqd === null ? null : Math.round((salePriceIqd / exchangeRate) * 100), salePriceIqd, receivedAt: purchaseDateRaw ? new Date(purchaseDateRaw) : new Date(), notes }).returning({ id: inventoryBatches.id });
    await tx.insert(purchaseItems).values({ purchaseId: purchase.id, variantId, quantity, purchaseCostIqd, purchaseCostUsdCents, purchaseExchangeRate: exchangeRate, salePriceCents: salePriceIqd === null ? null : Math.round((salePriceIqd / exchangeRate) * 100), salePriceIqd, batchId: batch.id, notes });
    const stockAfter = variant.stock + quantity;
    await tx.update(productVariants).set({ stock: stockAfter }).where(eq(productVariants.id, variantId));
    if (salePriceIqd !== null) {
      const { products } = await import('@/db/schema');
      const { eq: eq2 } = await import('drizzle-orm');
      const [variantProduct] = await tx.select({ productId: productVariants.productId }).from(productVariants).where(eq2(productVariants.id, variantId)).limit(1);
      if (variantProduct) await tx.update(products).set({ priceCents: Math.round((salePriceIqd / exchangeRate) * 100), salePriceIqd, updatedAt: new Date() }).where(eq2(products.id, variantProduct.productId));
    }
    await tx.insert(inventoryMovements).values({ variantId, delta: quantity, stockAfter, reason: 'purchase', reference });
  });
  revalidatePath('/admin/purchases');
  revalidatePath('/admin/inventory');
  revalidatePath('/admin/reports');
}
