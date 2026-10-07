import { NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { storeLocations } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { logActivity } from '@/lib/activity-log';

export const dynamic = 'force-dynamic';
const clean = (v: unknown, max = 1000) => String(v ?? '').trim().slice(0, max);
const number = (v: unknown, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
function values(body: any) {
  return {
    name: clean(body?.name, 120), nameAr: clean(body?.nameAr, 120),
    address: clean(body?.address, 300), addressAr: clean(body?.addressAr, 300),
    description: clean(body?.description, 800), descriptionAr: clean(body?.descriptionAr, 800),
    mapUrl: clean(body?.mapUrl, 1000), phone: clean(body?.phone, 80) || null,
    hours: clean(body?.hours, 200), hoursAr: clean(body?.hoursAr, 200), image: clean(body?.image, 500) || null,
    active: body?.active !== false, sortOrder: number(body?.sortOrder), updatedAt: new Date(),
  };
}
export async function GET() {
  if (!(await requireAdminSection('storefront', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ stores: await db.select().from(storeLocations).orderBy(asc(storeLocations.sortOrder), asc(storeLocations.id)) });
}
export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('storefront', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null); const data = values(body);
  if (!data.name) return NextResponse.json({ error: 'Store name is required.' }, { status: 400 });
  const [row] = await db.insert(storeLocations).values(data).returning();
  await logActivity({ action: 'store-location.create', entityType: 'store-location', entityId: String(row.id), metadata: { name: row.name } });
  return NextResponse.json({ store: row }, { status: 201 });
}
export async function PUT(request: NextRequest) {
  if (!(await requireAdminSection('storefront', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null); const id = number(body?.id, -1); const data = values(body);
  if (id < 1 || !data.name) return NextResponse.json({ error: 'Valid store id and name are required.' }, { status: 400 });
  const [row] = await db.update(storeLocations).set(data).where(eq(storeLocations.id, id)).returning();
  if (!row) return NextResponse.json({ error: 'Store location not found.' }, { status: 404 });
  await logActivity({ action: 'store-location.update', entityType: 'store-location', entityId: String(row.id), metadata: { name: row.name } });
  return NextResponse.json({ store: row });
}
export async function DELETE(request: NextRequest) {
  if (!(await requireAdminSection('storefront', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null); const id = number(body?.id, -1);
  if (id < 1) return NextResponse.json({ error: 'Store id is required.' }, { status: 400 });
  const [row] = await db.delete(storeLocations).where(eq(storeLocations.id, id)).returning();
  if (!row) return NextResponse.json({ error: 'Store location not found.' }, { status: 404 });
  await logActivity({ action: 'store-location.delete', entityType: 'store-location', entityId: String(row.id), metadata: { name: row.name } });
  return NextResponse.json({ ok: true });
}
