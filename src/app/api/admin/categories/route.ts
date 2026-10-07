import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, products } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { logActivity } from '@/lib/activity-log';

export const dynamic = 'force-dynamic';
const clean = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
const slug = (v: unknown) => clean(v, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function GET() {
  if (!(await requireAdminSection('catalog', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
  const usage = await db.select({ category: products.category, count: sql<number>`count(*)` }).from(products).groupBy(products.category);
  const counts = Object.fromEntries(usage.map(x => [x.category, Number(x.count)]));
  return NextResponse.json({ categories: rows.map(x => ({ ...x, productCount: counts[x.id] ?? 0 })) });
}

export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('catalog', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const id = slug(body?.id || body?.name);
  const name = clean(body?.name, 100); const nameAr = clean(body?.nameAr, 100) || name;
  if (!id || !name || id === 'all') return NextResponse.json({ error: 'Valid category name and slug are required.' }, { status: 400 });
  try {
    const [row] = await db.insert(categories).values({ id, name, nameAr, description: clean(body?.description, 500), descriptionAr: clean(body?.descriptionAr, 500) || clean(body?.description, 500), image: clean(body?.image, 500) || null, active: body?.active !== false, sortOrder: Number(body?.sortOrder) || 0 }).returning();
    await logActivity({ action: 'category.create', entityType: 'category', entityId: id, metadata: { name } });
    revalidatePath('/');
    revalidatePath(`/products/category/${id}`);
    return NextResponse.json({ category: row }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Category slug already exists.' }, { status: 409 }); }
}

export async function PUT(request: NextRequest) {
  if (!(await requireAdminSection('catalog', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null); const id = clean(body?.id, 80); if (!id) return NextResponse.json({ error: 'Category id is required.' }, { status: 400 });
  const name = clean(body?.name, 100); const nameAr = clean(body?.nameAr, 100) || name; if (!name) return NextResponse.json({ error: 'Category name is required.' }, { status: 400 });
  const [row] = await db.update(categories).set({ name, nameAr, description: clean(body?.description, 500), descriptionAr: clean(body?.descriptionAr, 500) || clean(body?.description, 500), image: clean(body?.image, 500) || null, active: body?.active !== false, sortOrder: Number(body?.sortOrder) || 0, updatedAt: new Date() }).where(eq(categories.id, id)).returning();
  if (!row) return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
  await logActivity({ action: 'category.update', entityType: 'category', entityId: id, metadata: { name } });
  revalidatePath('/');
  revalidatePath(`/products/category/${id}`);
  return NextResponse.json({ category: row });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdminSection('catalog', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null); const id = clean(body?.id, 80); if (!id) return NextResponse.json({ error: 'Category id is required.' }, { status: 400 });
  const [used] = await db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.category, id));
  if (Number(used?.count ?? 0) > 0) return NextResponse.json({ error: 'Cannot delete a category that still has products. Reassign its products first.' }, { status: 409 });
  const [row] = await db.delete(categories).where(eq(categories.id, id)).returning();
  if (!row) return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
  await logActivity({ action: 'category.delete', entityType: 'category', entityId: id, metadata: { name: row.name } });
  revalidatePath('/');
  revalidatePath(`/products/category/${id}`);
  return NextResponse.json({ ok: true });
}
