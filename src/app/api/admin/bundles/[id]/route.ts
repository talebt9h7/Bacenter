import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { bundles } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { listBundles } from '@/lib/bundles';
import { parseBundle } from '@/lib/bundle-input';
import { invalidateCatalog } from '@/lib/cache-tags';
import { logActivity } from '@/lib/orders';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
export async function PUT(request: NextRequest, { params }: Ctx) {
  if (!(await requireAdminSection('catalog', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number((await params).id);
  const parsed = parseBundle(await request.json().catch(() => ({})));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  await db.update(bundles).set({ ...parsed.data, updatedAt: new Date() }).where(eq(bundles.id, id));
  invalidateCatalog();
  await logActivity('update', 'bundle', id, parsed.data.name);
  return NextResponse.json({ items: await listBundles({ includeInactive: true }) });
}
export async function DELETE(_: NextRequest, { params }: Ctx) {
  if (!(await requireAdminSection('catalog', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number((await params).id);
  await db.delete(bundles).where(eq(bundles.id, id));
  invalidateCatalog();
  await logActivity('delete', 'bundle', id);
  return NextResponse.json({ items: await listBundles({ includeInactive: true }) });
}
