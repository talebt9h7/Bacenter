import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { activityLog, settings } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { normalizeReceiptSettings } from '@/lib/wholesale-receipt';
import { getWholesaleReceiptSettings, WHOLESALE_RECEIPT_KEY } from '@/lib/wholesale-receipt-settings';
import { invalidateSettings } from '@/lib/cache-tags';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!(await requireAdminSection('sales', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ settings: await getWholesaleReceiptSettings() }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function PUT(request: NextRequest) {
  if (!(await requireAdminSection('sales', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'إعدادات الوصل غير صالحة.' }, { status: 400 });
  const next = normalizeReceiptSettings(body, await getWholesaleReceiptSettings());
  if (!next.brand || !next.title || !next.currency) return NextResponse.json({ error: 'اسم المتجر وعنوان الوصل والعملة مطلوبة.' }, { status: 400 });
  try {
    await db.transaction(async tx => {
      await tx.insert(settings).values({ key: WHOLESALE_RECEIPT_KEY, value: next, updatedAt: new Date() }).onConflictDoUpdate({ target: settings.key, set: { value: next, updatedAt: new Date() } });
      await tx.insert(activityLog).values({ action: 'wholesale.receipt', entity: 'settings', entityId: WHOLESALE_RECEIPT_KEY, details: 'Updated wholesale receipt design' });
    });
    invalidateSettings(); return NextResponse.json({ settings: next });
  } catch (e) { console.error('Saving wholesale receipt settings failed', e); return NextResponse.json({ error: 'تعذر حفظ إعدادات الوصل. حاول مرة ثانية.' }, { status: 500 }); }
}
