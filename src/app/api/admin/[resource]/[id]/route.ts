import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/admin-auth';
import { resources } from '@/lib/admin-resources';
import { logActivity } from '@/lib/orders';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ resource: string; id: string }> };
export async function PUT(request: NextRequest, { params }: Context) {
  const { resource, id } = await params; const handler = resources[resource];
  const section = resource === 'products' || resource === 'collections' || resource === 'inventory' || resource === 'purchases' || resource === 'suppliers' ? 'catalog' : resource === 'coupons' ? 'sales' : resource === 'banners' || resource === 'content' || resource === 'navigation' || resource === 'footer' || resource === 'homepage' || resource === 'media' ? 'storefront' : resource === 'expenses' ? 'finance' : 'configuration';
  const actor = await requireAdminSection(section, 'manage');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!handler) return NextResponse.json({ error: 'Unknown resource' }, { status: 404 });
  try {
    const result = await handler.update(id, await request.json().catch(() => ({})));
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.error.includes('not found') ? 404 : 400 });
    await logActivity('update', handler.label, id);
    return NextResponse.json({ item: result.row });
  } catch (error) { console.error(`Update ${resource} failed`, error); return NextResponse.json({ error: 'The record could not be saved.' }, { status: 500 }); }
}
export async function DELETE(_request: NextRequest, { params }: Context) {
  const { resource, id } = await params; const handler = resources[resource];
  const section = resource === 'products' || resource === 'collections' || resource === 'inventory' || resource === 'purchases' || resource === 'suppliers' ? 'catalog' : resource === 'coupons' ? 'sales' : resource === 'banners' || resource === 'content' || resource === 'navigation' || resource === 'footer' || resource === 'homepage' || resource === 'media' ? 'storefront' : resource === 'expenses' ? 'finance' : 'configuration';
  const actor = await requireAdminSection(section, 'manage');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!handler?.remove) return NextResponse.json({ error: 'This record cannot be deleted.' }, { status: 405 });
  try { await handler.remove(id); await logActivity('delete', handler.label, id); return NextResponse.json({ ok: true }); }
  catch (error) { console.error(`Delete ${resource} failed`, error); return NextResponse.json({ error: 'The record could not be deleted.' }, { status: 500 }); }
}
