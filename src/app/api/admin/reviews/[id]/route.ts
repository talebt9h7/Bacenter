import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { reviews } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { invalidateCatalog } from '@/lib/cache-tags';
import { logActivity } from '@/lib/orders';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
/** Approve / hide a review, or save the store's public reply. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  if (!(await requireAdminSection('sales', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number((await params).id);
  const body = await request.json().catch(() => ({}));
  const patch: Partial<typeof reviews.$inferInsert> = { updatedAt: new Date() };
  if (['pending', 'approved', 'hidden'].includes(body.status)) patch.status = body.status;
  if (typeof body.reply === 'string') patch.reply = body.reply.trim().slice(0, 800);
  await db.update(reviews).set(patch).where(eq(reviews.id, id));
  invalidateCatalog();
  await logActivity('update', 'review', id, patch.status ?? 'reply');
  return NextResponse.json({ ok: true });
}
export async function DELETE(_: NextRequest, { params }: Ctx) {
  if (!(await requireAdminSection('sales', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number((await params).id);
  await db.delete(reviews).where(eq(reviews.id, id));
  invalidateCatalog();
  await logActivity('delete', 'review', id);
  return NextResponse.json({ ok: true });
}
