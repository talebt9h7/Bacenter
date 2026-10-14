import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { bundles } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { listBundles } from '@/lib/bundles';
import { parseBundle } from '@/lib/bundle-input';
import { invalidateCatalog } from '@/lib/cache-tags';
import { logActivity } from '@/lib/orders';

export const dynamic = 'force-dynamic';
export async function GET() {
  if (!(await requireAdminSection('catalog', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ items: await listBundles({ includeInactive: true }) });
}
export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('catalog', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = parseBundle(await request.json().catch(() => ({})));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const [row] = await db.insert(bundles).values(parsed.data).returning({ id: bundles.id });
    invalidateCatalog();
    await logActivity('create', 'bundle', row.id, parsed.data.name);
    return NextResponse.json({ items: await listBundles({ includeInactive: true }) }, { status: 201 });
  } catch (error) {
    if (String(error).includes('bundles_slug_key') || String((error as { cause?: unknown })?.cause).includes('bundles_slug_key')) return NextResponse.json({ error: 'Another bundle already uses that link name.' }, { status: 409 });
    throw error;
  }
}
