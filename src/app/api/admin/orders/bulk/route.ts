import { NextRequest, NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { orderStatuses, type OrderStatus } from '@/lib/iraq';
import { logActivity, transitionOrder } from '@/lib/orders';

export const dynamic = 'force-dynamic';
/**
 * Moves several orders to one status. Each order goes through the normal transition (stock,
 * profit, events); an order that can't move (for example not enough stock) is skipped and reported.
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('sales', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { ids?: unknown; status?: unknown };
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 200) : [];
  const status = typeof body.status === 'string' && (orderStatuses as readonly string[]).includes(body.status) ? body.status as OrderStatus : null;
  if (!ids.length || !status) return NextResponse.json({ error: 'Choose orders and a status.' }, { status: 400 });
  const rows = await db.select({ id: orders.id, reference: orders.reference, status: orders.status }).from(orders).where(inArray(orders.id, ids));
  const done: number[] = []; const skipped: { id: number; reference: string; reason: string }[] = [];
  for (const row of rows) {
    const current = row.status as OrderStatus;
    if (current === status) { skipped.push({ id: row.id, reference: row.reference, reason: 'same' }); continue; }
    try { await transitionOrder(row.id, status); done.push(row.id); }
    catch (error) { skipped.push({ id: row.id, reference: row.reference, reason: error instanceof Error && error.message === 'INSUFFICIENT_STOCK' ? 'stock' : 'error' }); }
  }
  if (done.length) await logActivity('update', 'orders', undefined, `Bulk status → ${status} · ${done.length} orders`);
  return NextResponse.json({ done, skipped });
}
