import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte, ilike, lte, or } from 'drizzle-orm';
import { db } from '@/db';
import { activityLog } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const actor = await requireAdminSection('configuration', 'view');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() || '';
  const entity = url.searchParams.get('entity')?.trim() || '';
  const from = url.searchParams.get('from')?.trim() || '';
  const to = url.searchParams.get('to')?.trim() || '';
  const limitRaw = Number(url.searchParams.get('limit') || 100);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 100, 1), 250);
  const conditions = [];
  if (q) conditions.push(or(ilike(activityLog.action, `%${q}%`), ilike(activityLog.entity, `%${q}%`), ilike(activityLog.entityId, `%${q}%`), ilike(activityLog.details, `%${q}%`)));
  if (entity) conditions.push(eq(activityLog.entity, entity));
  if (from && !Number.isNaN(Date.parse(from))) conditions.push(gte(activityLog.createdAt, new Date(`${from}T00:00:00`)));
  if (to && !Number.isNaN(Date.parse(to))) conditions.push(lte(activityLog.createdAt, new Date(`${to}T23:59:59.999`)));
  const rows = await db.select().from(activityLog).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(activityLog.createdAt)).limit(limit);
  const entities = await db.selectDistinct({ entity: activityLog.entity }).from(activityLog).orderBy(activityLog.entity);
  return NextResponse.json({ items: rows, entities: entities.map(x => x.entity) });
}
