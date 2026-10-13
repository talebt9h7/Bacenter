import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/admin-auth';
import { getIntegrations } from '@/lib/integrations';
import { sendTelegram, sendWhatsApp } from '@/lib/notify';

export const dynamic = 'force-dynamic';
/** Sends a test message on one channel using the saved settings. */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('configuration', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { channel } = await request.json().catch(() => ({}));
  const config = await getIntegrations();
  const text = '✅ <b>رسالة تجريبية</b>\nإشعارات متجر UR تشتغل. راح توصلك رسالة هنا مع كل طلب جديد.';
  const result = channel === 'whatsapp' ? await sendWhatsApp(config.whatsapp, text) : await sendTelegram(config.telegram, text);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error || 'Sending failed.' }, { status: 400 });
}
