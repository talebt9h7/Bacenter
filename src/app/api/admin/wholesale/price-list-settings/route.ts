import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { activityLog, settings } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { normalizePriceList } from '@/lib/wholesale-price-list';
import { getPriceListSettings, PRICE_LIST_KEY } from '@/lib/wholesale-price-list-data';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  if (!(await requireAdminSection('sales', 'manage'))) return NextResponse.json({ error: 'ما عندك صلاحية.' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'إعدادات القائمة غير صالحة.' }, { status: 400 });
  const next = normalizePriceList(body, await getPriceListSettings());
  if (!next.brand || !next.title) return NextResponse.json({ error: 'اسم المتجر وعنوان القائمة مطلوبة.' }, { status: 400 });
  try {
    await db.transaction(async tx => {
      await tx.insert(settings).values({ key: PRICE_LIST_KEY, value: next, updatedAt: new Date() }).onConflictDoUpdate({ target: settings.key, set: { value: next, updatedAt: new Date() } });
      await tx.insert(activityLog).values({ action: 'wholesale.price_list', entity: 'settings', entityId: PRICE_LIST_KEY, details: 'Updated wholesale price list design' });
    });
    return NextResponse.json({ settings: next });
  } catch (e) { console.error('Saving price list settings failed', e); return NextResponse.json({ error: 'ما انحفظت القائمة. حاول مرة ثانية.' }, { status: 500 }); }
}
