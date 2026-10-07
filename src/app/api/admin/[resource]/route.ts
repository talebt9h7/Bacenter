import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/admin-auth';
import { resources } from '@/lib/admin-resources';
import { ensureStoreSeeded } from '@/lib/settings';
import { logActivity } from '@/lib/orders';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ resource: string }> };
export async function GET(_request: NextRequest, { params }: Context) {
  const { resource } = await params; const handler = resources[resource];
  const section = resource === 'products' || resource === 'collections' || resource === 'inventory' || resource === 'purchases' || resource === 'suppliers' ? 'catalog' : resource === 'coupons' ? 'sales' : resource === 'banners' || resource === 'content' || resource === 'navigation' || resource === 'footer' || resource === 'homepage' || resource === 'media' ? 'storefront' : resource === 'expenses' ? 'finance' : 'configuration';
  const actor = await requireAdminSection(section, 'view');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!handler) return NextResponse.json({ error: 'Unknown resource' }, { status: 404 });
  await ensureStoreSeeded();
  return NextResponse.json({ items: await handler.list() });
}
export async function POST(request: NextRequest, { params }: Context) {
  const { resource } = await params; const handler = resources[resource];
  const section = resource === 'products' || resource === 'collections' || resource === 'inventory' || resource === 'purchases' || resource === 'suppliers' ? 'catalog' : resource === 'coupons' ? 'sales' : resource === 'banners' || resource === 'content' || resource === 'navigation' || resource === 'footer' || resource === 'homepage' || resource === 'media' ? 'storefront' : resource === 'expenses' ? 'finance' : 'configuration';
  const actor = await requireAdminSection(section, 'manage');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!handler?.create) return NextResponse.json({ error: 'Unknown resource' }, { status: 404 });
  try {
    const result = await handler.create(await request.json().catch(() => ({})));
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    await logActivity('create', handler.label, String((result.row as { id?: unknown })?.id ?? ''), (result.row as { title?: string; code?: string })?.title ?? (result.row as { code?: string })?.code);
    return NextResponse.json({ item: result.row }, { status: 201 });
  } catch (error) { console.error(`Create ${resource} failed`, error); return NextResponse.json({ error: 'The record could not be created.' }, { status: 500 }); }
}
