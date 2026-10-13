import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { promotions } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { invalidateCatalog } from '@/lib/cache-tags';
import { logActivity } from '@/lib/orders';
import { parsePromotion } from '@/lib/promotion-input';
import { serializePromotion } from '@/lib/promotions';

export const dynamic = 'force-dynamic';
export async function GET() {
  if (!(await requireAdminSection('sales', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const rows = await db.select().from(promotions).orderBy(desc(promotions.startsAt));
  return NextResponse.json({ promotions: rows.map(serializePromotion) });
}
export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('sales', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = parsePromotion(await request.json().catch(() => ({})));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const [row] = await db.insert(promotions).values(parsed.data).returning();
  invalidateCatalog();
  await logActivity('create', 'promotion', row.id, `${row.name} · ${row.type} ${row.value} · until ${row.endsAt.toISOString()}`);
  return NextResponse.json({ promotion: serializePromotion(row) }, { status: 201 });
}
