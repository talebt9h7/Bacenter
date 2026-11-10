import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { inventoryBatches, productVariants } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { logActivity } from '@/lib/orders';

export const dynamic = 'force-dynamic';

/**
 * Admin → Inventory: sets the purchase cost per unit (IQD) of the units of one colour now on the
 * shelf. Batches still holding stock take the new cost; units that came in without any batch
 * (added before costs were tracked) get an opening batch at that cost. Batches already sold out
 * keep their historical cost, so past profit doesn't change.
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('catalog', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const ar = (request.cookies.get('UR_lang')?.value ?? 'ar') !== 'en';
  const body = await request.json().catch(() => ({})) as { variantId?: unknown; costIqd?: unknown };
  const variantId = Number(body.variantId), costIqd = Math.round(Number(body.costIqd));
  if (!Number.isInteger(variantId) || variantId <= 0) return NextResponse.json({ error: ar ? 'اللون مو موجود.' : 'Unknown colour.' }, { status: 400 });
  if (!Number.isFinite(costIqd) || costIqd < 0 || costIqd > 100_000_000) return NextResponse.json({ error: ar ? 'اكتب تكلفة صحيحة بالدينار.' : 'Enter a valid cost in IQD.' }, { status: 400 });
  const result = await db.transaction(async tx => {
    const [variant] = await tx.select({ stock: productVariants.stock, name: productVariants.name, productId: productVariants.productId }).from(productVariants).where(eq(productVariants.id, variantId));
    if (!variant) return null;
    const updated = await tx.update(inventoryBatches).set({ purchaseCostIqd: costIqd, purchaseCostUsdCents: null }).where(and(eq(inventoryBatches.variantId, variantId), gt(inventoryBatches.quantityRemaining, 0))).returning({ remaining: inventoryBatches.quantityRemaining });
    const covered = updated.reduce((sum, b) => sum + b.remaining, 0);
    const uncovered = Math.max(0, variant.stock - covered);
    // Nothing on the shelf: keep the cost as a record with no units, so the next view and future margins use it.
    if (covered + uncovered === 0) await tx.insert(inventoryBatches).values({ variantId, batchNumber: `COST-${new Date().toISOString().slice(0, 10)}`, quantityReceived: 0, quantityRemaining: 0, purchaseCostIqd: costIqd, receivedAt: sql`now()` });
    if (uncovered > 0) await tx.insert(inventoryBatches).values({ variantId, batchNumber: `OPENING-${new Date().toISOString().slice(0, 10)}`, quantityReceived: uncovered, quantityRemaining: uncovered, purchaseCostIqd: costIqd, receivedAt: sql`now()` });
    return { variant, units: covered + uncovered };
  });
  if (!result) return NextResponse.json({ error: ar ? 'اللون مو موجود.' : 'Unknown colour.' }, { status: 404 });
  await logActivity('inventory.cost', 'variant', variantId, `${result.variant.productId} · ${result.variant.name}: cost ${costIqd} IQD on ${result.units} units`);
  return NextResponse.json({ costIqd, units: result.units });
}
