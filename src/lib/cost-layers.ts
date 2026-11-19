import { asc, gt } from 'drizzle-orm';
import { db } from '@/db';
import { inventoryBatches } from '@/db/schema';
import type { CostLayer } from './profit-estimate';

/** Remaining purchase batches per colour, oldest first (the order a sale consumes them). */
export async function costLayersByVariant(): Promise<Record<number, CostLayer[]>> {
  const rows = await db.select({ variantId: inventoryBatches.variantId, qty: inventoryBatches.quantityRemaining, cost: inventoryBatches.purchaseCostIqd })
    .from(inventoryBatches).where(gt(inventoryBatches.quantityRemaining, 0)).orderBy(asc(inventoryBatches.receivedAt), asc(inventoryBatches.id));
  const out: Record<number, CostLayer[]> = {};
  for (const r of rows) (out[r.variantId] ??= []).push([r.qty, r.cost]);
  return out;
}
