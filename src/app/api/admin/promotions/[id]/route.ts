import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { promotions } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { invalidateCatalog } from '@/lib/cache-tags';
import { logActivity } from '@/lib/orders';
import { parsePromotion } from '@/lib/promotion-input';
import { serializePromotion } from '@/lib/promotions';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Context) {
  if (!(await requireAdminSection('sales', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number((await params).id);
  const parsed = parsePromotion(await request.json().catch(() => ({})));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const [row] = await db.update(promotions).set({ ...parsed.data, updatedAt: new Date() }).where(eq(promotions.id, id)).returning();
  if (!row) return NextResponse.json({ error: 'Offer not found.' }, { status: 404 });
  invalidateCatalog();
  await logActivity('update', 'promotion', id, `${row.name} · ${row.active ? 'active' : 'paused'} · until ${row.endsAt.toISOString()}`);
  return NextResponse.json({ promotion: serializePromotion(row) });
}
export async function DELETE(_request: NextRequest, { params }: Context) {
  if (!(await requireAdminSection('sales', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number((await params).id);
  const [row] = await db.delete(promotions).where(eq(promotions.id, id)).returning({ name: promotions.name });
  invalidateCatalog();
  if (row) await logActivity('delete', 'promotion', id, row.name);
  return NextResponse.json({ ok: true });
}
