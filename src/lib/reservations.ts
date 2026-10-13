import { sql } from 'drizzle-orm';
import { db } from '@/db';

type Executor = Pick<typeof db, 'execute'>;

/**
 * Stock model
 * - `product_variants.stock` is the physical stock on hand.
 * - A pending order (not yet confirmed) only reserves units: stock is not deducted and no
 *   purchase batch is consumed. Reserved units are the quantities in pending orders.
 * - Units become sold (stock deducted, FIFO batch cost recorded) when the order is confirmed,
 *   and go back on hand when a confirmed order is cancelled or returned.
 * - What the store can still sell is: available = on hand − reserved.
 */
export const STOCK_HOLDING_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered'] as const;
export function statusHoldsStock(status: string) {
  return (STOCK_HOLDING_STATUSES as readonly string[]).includes(status);
}

/** Units reserved by pending orders, per variant. `excludeOrderId` leaves one order out (when editing it). */
export async function reservedByVariant(executor: Executor = db, excludeOrderId?: number) {
  const result = await executor.execute(sql`
    SELECT (item->>'variantId')::int AS variant_id, COALESCE(SUM((item->>'quantity')::int), 0)::int AS reserved
    FROM orders o, jsonb_array_elements(o.items) AS item
    WHERE o.status = 'pending' ${excludeOrderId ? sql`AND o.id <> ${excludeOrderId}` : sql``}
    GROUP BY 1`);
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as { variant_id: number; reserved: number }[];
  return new Map(rows.map(row => [Number(row.variant_id), Number(row.reserved)]));
}

export async function reservedForVariant(executor: Executor, variantId: number, excludeOrderId?: number) {
  const result = await executor.execute(sql`
    SELECT COALESCE(SUM((item->>'quantity')::int), 0)::int AS reserved
    FROM orders o, jsonb_array_elements(o.items) AS item
    WHERE o.status = 'pending' AND (item->>'variantId')::int = ${variantId} ${excludeOrderId ? sql`AND o.id <> ${excludeOrderId}` : sql``}`);
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as { reserved: number }[];
  return Number(rows[0]?.reserved ?? 0);
}
