import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminSection } from '@/lib/admin-auth';
import { logActivity } from '@/lib/activity-log';
import { saveHeroRing } from '@/lib/hero-ring';

export const dynamic = 'force-dynamic';

/** Saves the homepage ring (Admin → Homepage → Product ring). */
export async function PUT(request: NextRequest) {
  const actor = await requireAdminSection('storefront', 'manage');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const ring = await saveHeroRing(body);
  await logActivity(actor, 'settings.update', 'homepage', 'hero-ring', `Product ring ${ring.enabled ? 'on' : 'off'} · ${ring.items.length} products · ${ring.secondsPerTurn}s per turn`);
  revalidatePath('/');
  return NextResponse.json({ ring });
}
