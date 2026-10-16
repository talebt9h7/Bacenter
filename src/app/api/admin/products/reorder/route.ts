import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { products } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { invalidateCatalog } from '@/lib/cache-tags';
import { logActivity } from '@/lib/orders';

export const dynamic = 'force-dynamic';

/** Saves the manual product order: { ids: [...] } in the order they should appear in the store. */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('catalog', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((id: unknown): id is string => typeof id === 'string' && /^[a-z0-9-]{1,80}$/.test(id)) : [];
  if (!ids.length || new Set(ids).size !== ids.length || ids.length > 5000) return NextResponse.json({ error: 'Invalid order.' }, { status: 400 });
  const existing = await db.select({ id: products.id }).from(products);
  const known = new Set(existing.map(p => p.id));
  const ordered = ids.filter(id => known.has(id));
  // Products not in the list (e.g. created meanwhile) keep their place after the ordered ones.
  const rest = existing.map(p => p.id).filter(id => !ordered.includes(id));
  const all = [...ordered, ...rest];
  await db.transaction(async tx => { for (const [pos, id] of all.entries()) await tx.update(products).set({ sortOrder: pos }).where(eq(products.id, id)); });
  invalidateCatalog();
  await logActivity('products.reordered', 'product', undefined, `${ordered.length} products`);
  return NextResponse.json({ ok: true });
}
