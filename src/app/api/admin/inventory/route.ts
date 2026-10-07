import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { inventoryBatches, inventoryMovements, productVariants, products, purchaseItems } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { adjustStock, logActivity, receiveInventoryBatch } from '@/lib/orders';

export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('catalog', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  const lines = Array.isArray(body.lines) ? body.lines : [];
  const newColors = Array.isArray(body.newColors) ? body.newColors : [];
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 120) : 'Manual adjustment';
  if (reason === 'Purchase received' && productId && (lines.length || newColors.length)) {
    const purchasePriceUsd = Number(body.purchasePriceUsd);
    const exchangeRate = Number(body.exchangeRate || 1);
    const batchNumberInput = typeof body.batchNumber === 'string' ? body.batchNumber.trim().slice(0, 120) : '';
    const batchNumber = batchNumberInput || `PUR-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
    if (!Number.isFinite(purchasePriceUsd) || purchasePriceUsd < 0) return NextResponse.json({ error: 'Enter a valid purchase price in USD.' }, { status: 400 });
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) return NextResponse.json({ error: 'Invalid exchange rate.' }, { status: 400 });
    const cleanLines = lines.map((line: any) => ({ variantId: Number(line.variantId), quantity: Number(line.quantity) })).filter((line: { variantId: number; quantity: number }) => line.quantity > 0);
    if (cleanLines.some((line: { variantId: number; quantity: number }) => !Number.isInteger(line.variantId) || !Number.isInteger(line.quantity) || line.quantity <= 0)) return NextResponse.json({ error: 'Invalid batch quantities.' }, { status: 400 });
    const cleanNewColors = newColors.map((color: any) => ({ name: String(color.name || '').trim().slice(0, 80), hex: String(color.hex || '#8b6f47').trim().slice(0, 20), quantity: Number(color.quantity) })).filter((color: { name: string; quantity: number }) => color.name);
    if (cleanNewColors.some((color: { name: string; quantity: number }) => !Number.isInteger(color.quantity) || color.quantity <= 0)) return NextResponse.json({ error: 'Invalid new color quantities.' }, { status: 400 });
    try {
      const result = await db.transaction(async tx => {
        const [product] = await tx.select({ id: products.id }).from(products).where(eq(products.id, productId));
        if (!product) throw new Error('PRODUCT_NOT_FOUND');
        const existing = await tx.select().from(productVariants).where(eq(productVariants.productId, productId));
        const existingByName = new Map(existing.map(variant => [variant.name.trim().toLowerCase(), variant]));
        const outputRows: Array<{ variantId: number; stock: number; color: string }> = [];
        for (const line of cleanLines) {
          const variant = existing.find(item => item.id === line.variantId);
          if (!variant || variant.productId !== productId) throw new Error('INVALID_VARIANT');
          const received = await receiveInventoryBatch(tx, { variantId: variant.id, quantity: line.quantity, purchaseCostUsdCents: Math.round(purchasePriceUsd * 100), purchaseExchangeRate: Math.round(exchangeRate), salePriceIqd: null, batchNumber, notes: typeof body.notes === 'string' ? body.notes : null });
          outputRows.push({ variantId: variant.id, stock: received.stock, color: variant.name });
        }
        let nextSort = existing.reduce((max, variant) => Math.max(max, Number(variant.sortOrder) || 0), -1) + 1;
        for (const color of cleanNewColors) {
          const key = color.name.toLowerCase();
          if (existingByName.has(key)) throw new Error('COLOR_EXISTS');
          const [created] = await tx.insert(productVariants).values({ productId, name: color.name, hex: color.hex || '#8b6f47', stock: 0, images: [], primaryIndex: 0, sortOrder: nextSort++ }).returning();
          const received = await receiveInventoryBatch(tx, { variantId: created.id, quantity: color.quantity, purchaseCostUsdCents: Math.round(purchasePriceUsd * 100), purchaseExchangeRate: Math.round(exchangeRate), salePriceIqd: null, batchNumber, notes: typeof body.notes === 'string' ? body.notes : null });
          outputRows.push({ variantId: created.id, stock: received.stock, color: created.name });
        }
        return { rows: outputRows, createdVariants: outputRows.slice(cleanLines.length).map(item => item.variantId), batchNumber };
      });
      await logActivity('inventory.purchase', 'product', productId, `${result.rows.reduce((sum, row) => sum + 1, 0)} colors · batch ${result.batchNumber} · purchase $${purchasePriceUsd.toFixed(2)} USD @ ${exchangeRate.toLocaleString('en-US')} IQD`);
      return NextResponse.json(result);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'PRODUCT_NOT_FOUND') return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
      if (code === 'INVALID_VARIANT') return NextResponse.json({ error: 'One of the selected colors does not belong to this product.' }, { status: 400 });
      if (code === 'COLOR_EXISTS') return NextResponse.json({ error: 'One of the new colors already exists for this product.' }, { status: 409 });
      return NextResponse.json({ error: 'Could not receive this inventory batch.' }, { status: 500 });
    }
  }
  const variantId = Number(body.variantId);
  if (!Number.isInteger(variantId)) return NextResponse.json({ error: 'Invalid variant.' }, { status: 400 });
  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, variantId));
  if (!variant) return NextResponse.json({ error: 'Variant not found.' }, { status: 404 });
  if (reason === 'Purchase received' && Number(body.delta) > 0) {
    const quantity = Number(body.delta);
    const purchasePriceUsd = Number(body.purchasePriceUsd);
    const batchNumber = typeof body.batchNumber === 'string' && body.batchNumber.trim() ? body.batchNumber.trim().slice(0, 120) : `PUR-${new Date().toISOString().slice(0,10)}-${variantId}`;
    const exchangeRate = Number(body.exchangeRate || 1);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 1000000) return NextResponse.json({ error: 'Quantity must be a positive whole number.' }, { status: 400 });
    if (!Number.isFinite(purchasePriceUsd) || purchasePriceUsd < 0) return NextResponse.json({ error: 'Enter a valid purchase price in USD.' }, { status: 400 });
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) return NextResponse.json({ error: 'Invalid exchange rate.' }, { status: 400 });
    try {
      const result = await db.transaction(async tx => receiveInventoryBatch(tx, { variantId, quantity, purchaseCostUsdCents: Math.round(purchasePriceUsd * 100), purchaseExchangeRate: Math.round(exchangeRate), salePriceIqd: null, batchNumber, notes: typeof body.notes === 'string' ? body.notes : null }));
      await logActivity('inventory.purchase', 'variant', variantId, `+${quantity} · batch ${batchNumber} · purchase $${purchasePriceUsd.toFixed(2)} USD @ ${exchangeRate.toLocaleString('en-US')} IQD`);
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json({ error: 'Could not receive this inventory batch.' }, { status: 500 });
    }
  }
  let delta: number;
  if (body.set !== undefined) { const target = Number(body.set); if (!Number.isInteger(target) || target < 0 || target > 1000000) return NextResponse.json({ error: 'Stock must be a whole number of 0 or more.' }, { status: 400 }); delta = target - variant.stock; }
  else { delta = Number(body.delta); if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1000000) return NextResponse.json({ error: 'Enter a non-zero adjustment.' }, { status: 400 }); if (variant.stock + delta < 0) return NextResponse.json({ error: `Only ${variant.stock} in stock; can’t remove ${Math.abs(delta)}.` }, { status: 400 }); }
  if (delta === 0) return NextResponse.json({ stock: variant.stock });
  const stock = await adjustStock(db, variantId, delta, reason);
  await logActivity('inventory.adjust', 'variant', variantId, `${delta > 0 ? '+' : ''}${delta} (${reason})`);
  return NextResponse.json({ stock });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdminSection('catalog', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const batchId = Number(body.batchId);
  if (!Number.isInteger(batchId) || batchId <= 0) return NextResponse.json({ error: 'Invalid batch.' }, { status: 400 });
  try {
    const result = await db.transaction(async tx => {
      const [batch] = await tx.select({
        id: inventoryBatches.id, variantId: inventoryBatches.variantId, quantityReceived: inventoryBatches.quantityReceived,
        quantityRemaining: inventoryBatches.quantityRemaining, batchNumber: inventoryBatches.batchNumber,
      }).from(inventoryBatches).where(eq(inventoryBatches.id, batchId)).for('update');
      if (!batch) throw new Error('NOT_FOUND');
      if (batch.quantityRemaining !== batch.quantityReceived) throw new Error('BATCH_ALREADY_USED');
      const [purchaseLink] = await tx.select({ id: purchaseItems.id }).from(purchaseItems).where(eq(purchaseItems.batchId, batchId)).limit(1);
      if (purchaseLink) throw new Error('BATCH_LINKED_TO_PURCHASE');
      const [variant] = await tx.select({ stock: productVariants.stock, productId: productVariants.productId }).from(productVariants).where(eq(productVariants.id, batch.variantId)).for('update');
      if (!variant || variant.stock < batch.quantityRemaining) throw new Error('STOCK_MISMATCH');
      const nextStock = variant.stock - batch.quantityRemaining;
      await tx.update(productVariants).set({ stock: nextStock }).where(eq(productVariants.id, batch.variantId));
      await tx.insert(inventoryMovements).values({ variantId: batch.variantId, delta: -batch.quantityRemaining, stockAfter: nextStock, reason: 'Inventory batch deleted', reference: batch.batchNumber });
      await tx.delete(inventoryBatches).where(eq(inventoryBatches.id, batchId));
      return { batchId, stock: nextStock };
    });
    await logActivity('inventory.batch_delete', 'inventory_batch', batchId, `Deleted batch ${batchId}`);
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'NOT_FOUND') return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });
    if (code === 'BATCH_ALREADY_USED') return NextResponse.json({ error: 'This batch cannot be deleted because it has already been used.' }, { status: 409 });
    if (code === 'BATCH_LINKED_TO_PURCHASE') return NextResponse.json({ error: 'This batch cannot be deleted because it is linked to a purchase.' }, { status: 409 });
    if (code === 'STOCK_MISMATCH') return NextResponse.json({ error: 'This batch cannot be deleted because the current stock no longer matches the batch quantity.' }, { status: 409 });
    return NextResponse.json({ error: 'Could not delete this inventory batch.' }, { status: 500 });
  }
}
