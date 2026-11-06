import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSection } from '@/lib/admin-auth';
import { logActivity } from '@/lib/activity-log';
import { normalizeHeroRing, saveHeroRing } from '@/lib/hero-ring';
import { analyzeUploadedCutout, loadStoreImage } from '@/lib/cutout';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Saves the homepage ring (Admin → Homepage → Product ring). */
export async function PUT(request: NextRequest) {
  const actor = await requireAdminSection('storefront', 'manage');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const next = normalizeHeroRing(await request.json().catch(() => null));
  // A picture set without going through the cut-out tool: check whether it is see-through.
  await Promise.all(next.items.map(async item => {
    if (!item.image || typeof item.cut === 'boolean') return;
    const data = await loadStoreImage(item.image, request.nextUrl.origin).catch(() => null);
    item.cut = data ? (await analyzeUploadedCutout(data).catch(() => ({ cutout: false }))).cutout : false;
  }));
  const ring = await saveHeroRing(next);
  await logActivity(actor, 'settings.update', 'homepage', 'hero-ring', `Product ring ${ring.enabled ? 'on' : 'off'} · ${ring.items.length} products · ${ring.secondsPerTurn}s per turn`);
  revalidatePath('/');
  return NextResponse.json({ ring });
}
