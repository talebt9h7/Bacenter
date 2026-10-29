import { NextRequest, NextResponse } from 'next/server';
import { getPaymentSettings } from '@/lib/payments/config';
import { findPayment, syncPayment } from '@/lib/payments';
import { verifyZainCashToken, zainCashClaims } from '@/lib/payments/providers';

export const dynamic = 'force-dynamic';
/** ZainCash server-to-server notification ({ webhook_token: JWT }). Always answered 200 once handled. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { webhook_token?: string };
  const config = await getPaymentSettings();
  const claims = body.webhook_token ? verifyZainCashToken(body.webhook_token, config.zaincash.apiKey) : null;
  if (!claims) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  const c = zainCashClaims(claims);
  const payment = await findPayment('zaincash', { providerRef: c.transactionId, externalRef: c.externalRef });
  if (payment) await syncPayment(payment, request.nextUrl.origin).catch(error => console.error('ZainCash webhook sync failed', error));
  return NextResponse.json({ ok: true });
}
