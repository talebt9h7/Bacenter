import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/admin-auth';
import { getIntegrations } from '@/lib/integrations';
import { sendTelegram, sendWhatsApp } from '@/lib/notify';
import { requestUser, sendCapi } from '@/lib/meta-capi';

export const dynamic = 'force-dynamic';
/** Sends a test message on one channel using the saved settings. */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('configuration', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { channel } = await request.json().catch(() => ({}));
  const config = await getIntegrations();
  if (channel === 'meta') {
    const r = await sendCapi([{ name: 'PageView', eventId: `test.${Date.now()}`, url: request.nextUrl.origin, user: requestUser(request.headers, request.cookies) }]);
    return r.ok ? NextResponse.json({ ok: true, received: 'received' in r ? r.received : 0, testCode: config.tracking.metaTestCode }) : NextResponse.json({ error: r.error || 'Sending failed.' }, { status: 400 });
  }
  const text = '✅ <b>رسالة تجريبية</b>\nإشعارات متجر UR تشتغل. راح توصلك رسالة هنا مع كل طلب جديد.';
  const result = channel === 'whatsapp' ? await sendWhatsApp(config.whatsapp, text) : await sendTelegram(config.telegram, text);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error || 'Sending failed.' }, { status: 400 });
}
