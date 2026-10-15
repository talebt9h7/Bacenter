import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { suppliers } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { logActivity } from '@/lib/orders';
import { fail, supplierFields } from '@/lib/procurement-api';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** Edit a supplier, or { active: false } to archive it (history is kept). */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  if (!(await requireAdminSection('catalog', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number((await params).id);
  const body = await request.json().catch(() => ({}));
  const onlyActive = Object.keys(body).length === 1 && typeof body.active === 'boolean';
  const patch = onlyActive ? { active: body.active as boolean } : { ...supplierFields(body), ...(typeof body.active === 'boolean' ? { active: body.active } : {}) };
  if (!onlyActive && (patch as { name: string }).name.length < 2) return fail(request, 400, 'Enter the supplier name.', 'اكتب اسم المورد.');
  const [row] = await db.update(suppliers).set({ ...patch, updatedAt: new Date() }).where(eq(suppliers.id, id)).returning({ id: suppliers.id, name: suppliers.name });
  if (!row) return fail(request, 404, 'Supplier not found.', 'المورد غير موجود.');
  await logActivity(onlyActive ? (body.active ? 'supplier.activated' : 'supplier.archived') : 'supplier.updated', 'supplier', id, row.name);
  return NextResponse.json({ ok: true });
}
