import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { suppliers } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { logActivity } from '@/lib/orders';
import { fail, supplierFields } from '@/lib/procurement-api';

export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('catalog', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const fields = supplierFields(await request.json().catch(() => ({})));
  if (fields.name.length < 2) return fail(request, 400, 'Enter the supplier name.', 'اكتب اسم المورد.');
  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return fail(request, 400, 'The email address is not valid.', 'البريد الإلكتروني غير صحيح.');
  const [row] = await db.insert(suppliers).values(fields).returning({ id: suppliers.id });
  await logActivity('supplier.created', 'supplier', row.id, fields.name);
  return NextResponse.json({ ok: true, id: row.id });
}
