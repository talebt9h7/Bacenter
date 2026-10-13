import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/admin-auth';
import { getIntegrations, saveIntegrations, trackingPatterns, type Integrations } from '@/lib/integrations';
import { logActivity } from '@/lib/orders';

export const dynamic = 'force-dynamic';
const MASK = '••••••';
/** The bot token and API key are never sent back in full; the editor shows them masked. */
function masked(i: Integrations) {
  return { ...i, telegram: { ...i.telegram, botToken: i.telegram.botToken ? `${i.telegram.botToken.slice(0, 6)}${MASK}` : '' }, whatsapp: { ...i.whatsapp, apiKey: i.whatsapp.apiKey ? MASK : '' } };
}
export async function GET() {
  if (!(await requireAdminSection('configuration', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ integrations: masked(await getIntegrations()) });
}
export async function PUT(request: NextRequest) {
  if (!(await requireAdminSection('configuration', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Partial<Integrations>;
  const current = await getIntegrations();
  const str = (v: unknown, max = 200) => typeof v === 'string' ? v.trim().slice(0, max) : '';
  // Keep the stored secret when the editor sends back the masked value.
  const token = str(body.telegram?.botToken, 120);
  const apiKey = str(body.whatsapp?.apiKey, 60);
  const next: Integrations = {
    telegram: { enabled: !!body.telegram?.enabled, botToken: token.includes(MASK) ? current.telegram.botToken : token, chatIds: Array.isArray(body.telegram?.chatIds) ? [...new Set(body.telegram!.chatIds.map(id => str(id, 30)).filter(id => /^-?\d{3,20}$/.test(id)))].slice(0, 10) : current.telegram.chatIds },
    whatsapp: { enabled: !!body.whatsapp?.enabled, phone: str(body.whatsapp?.phone, 20).replace(/[^\d+]/g, ''), apiKey: apiKey.includes(MASK) ? current.whatsapp.apiKey : apiKey },
    notify: { newOrder: body.notify?.newOrder !== false, lowStock: body.notify?.lowStock !== false },
    tracking: { metaPixelId: str(body.tracking?.metaPixelId, 30), ga4Id: str(body.tracking?.ga4Id, 30).toUpperCase(), clarityId: str(body.tracking?.clarityId, 30).toLowerCase() },
  };
  if (next.telegram.botToken && !/^\d{5,15}:[A-Za-z0-9_-]{20,60}$/.test(next.telegram.botToken)) return NextResponse.json({ error: 'The Telegram bot token doesn’t look right. Copy it from @BotFather (it looks like 123456789:AA…).' }, { status: 400 });
  if (next.telegram.enabled && (!next.telegram.botToken || !next.telegram.chatIds.length)) return NextResponse.json({ error: 'To turn Telegram on, add the bot token and at least one chat.' }, { status: 400 });
  if (next.whatsapp.enabled && (!/^\+?\d{10,15}$/.test(next.whatsapp.phone) || !next.whatsapp.apiKey)) return NextResponse.json({ error: 'To turn WhatsApp on, add your number in international format (e.g. +9647701234567) and the CallMeBot API key.' }, { status: 400 });
  for (const [key, pattern] of Object.entries(trackingPatterns)) {
    const value = next.tracking[key as keyof Integrations['tracking']];
    if (value && !pattern.test(value)) return NextResponse.json({ error: key === 'metaPixelId' ? 'Meta Pixel ID is the number only (e.g. 1234567890123456).' : key === 'ga4Id' ? 'Google Analytics ID starts with G- (e.g. G-ABC123XYZ9).' : 'Clarity project ID is the short code from Clarity → Settings (e.g. abcd1234ef).' }, { status: 400 });
  }
  await saveIntegrations(next);
  await logActivity('update', 'integrations', undefined, `Telegram ${next.telegram.enabled ? 'on' : 'off'} · WhatsApp ${next.whatsapp.enabled ? 'on' : 'off'} · Pixel ${next.tracking.metaPixelId ? 'set' : '—'} · GA4 ${next.tracking.ga4Id ? 'set' : '—'} · Clarity ${next.tracking.clarityId ? 'set' : '—'}`);
  return NextResponse.json({ integrations: masked(next) });
}
