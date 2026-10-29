import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/admin-auth';
import { logActivity } from '@/lib/orders';
import { getPaymentSettings, maskedPaymentSettings, missingFields, savePaymentSettings, SECRET_MASK, type PaymentSettings } from '@/lib/payments/config';
import { testConnection } from '@/lib/payments/providers';

export const dynamic = 'force-dynamic';
const str = (v: unknown, max = 300) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const keep = (incoming: unknown, current: string, max = 400) => { const v = str(incoming, max); return v.includes(SECRET_MASK) ? current : v; };
const url = (v: unknown) => { const s = str(v, 200).replace(/\/+$/, ''); return s && /^https:\/\/[a-z0-9.-]+(:\d+)?(\/[\w./-]*)?$/i.test(s) ? s : ''; };

export async function GET() {
  if (!(await requireAdminSection('configuration', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ settings: maskedPaymentSettings(await getPaymentSettings()) });
}

export async function PUT(request: NextRequest) {
  if (!(await requireAdminSection('configuration', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Partial<PaymentSettings>;
  const current = await getPaymentSettings();
  const next: PaymentSettings = {
    enabled: body.enabled === true,
    provider: body.provider === 'fib' || body.provider === 'alqaseh' ? body.provider : 'zaincash',
    mode: body.mode === 'live' ? 'live' : 'test',
    zaincash: {
      clientId: str(body.zaincash?.clientId, 200),
      clientSecret: keep(body.zaincash?.clientSecret, current.zaincash.clientSecret),
      apiKey: keep(body.zaincash?.apiKey, current.zaincash.apiKey),
      serviceType: str(body.zaincash?.serviceType, 100),
      liveBaseUrl: url(body.zaincash?.liveBaseUrl),
    },
    fib: {
      clientId: str(body.fib?.clientId, 200),
      clientSecret: keep(body.fib?.clientSecret, current.fib.clientSecret),
      liveBaseUrl: url(body.fib?.liveBaseUrl),
    },
    alqaseh: {
      clientId: str(body.alqaseh?.clientId, 200),
      clientSecret: keep(body.alqaseh?.clientSecret, current.alqaseh.clientSecret),
      liveBaseUrl: url(body.alqaseh?.liveBaseUrl),
      livePayUrl: url(body.alqaseh?.livePayUrl),
    },
  };
  if (str(body.zaincash?.liveBaseUrl) && !next.zaincash.liveBaseUrl) return NextResponse.json({ error: 'رابط زين كاش الحقيقي لازم يبدي بـ https://' }, { status: 400 });
  if ((str(body.alqaseh?.liveBaseUrl) && !next.alqaseh.liveBaseUrl) || (str(body.alqaseh?.livePayUrl) && !next.alqaseh.livePayUrl)) return NextResponse.json({ error: 'روابط القاصة الحقيقية لازم تبدي بـ https://' }, { status: 400 });
  if (str(body.fib?.liveBaseUrl) && !next.fib.liveBaseUrl) return NextResponse.json({ error: 'رابط FIB الحقيقي لازم يبدي بـ https://' }, { status: 400 });
  const missing = missingFields(next);
  if (next.enabled && missing.length) return NextResponse.json({ error: `حتى تشغّل الدفع الإلكتروني أكمل الحقول: ${missing.join('، ')}` }, { status: 400 });
  await savePaymentSettings(next);
  await logActivity('update', 'payments', undefined, `Electronic payments ${next.enabled ? 'on' : 'off'} · ${next.provider} · ${next.mode}`);
  return NextResponse.json({ settings: maskedPaymentSettings(next) });
}

/** Test connection: requests an access token with the saved keys. */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('configuration', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { provider?: string };
  const s = await getPaymentSettings();
  const provider = body.provider === 'fib' || body.provider === 'zaincash' || body.provider === 'alqaseh' ? body.provider : s.provider;
  const missing = missingFields(s, provider).filter(f => f !== 'serviceType' && f !== 'apiKey');
  if (missing.length) return NextResponse.json({ ok: false, error: `احفظ هذي الحقول أول: ${missing.join('، ')}` }, { status: 400 });
  try {
    const result = await testConnection(s, provider);
    return NextResponse.json({ ok: true, host: result.host });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message.slice(0, 300) : 'Connection failed' }, { status: 502 });
  }
}
