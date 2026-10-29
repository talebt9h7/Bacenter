import { NextRequest, NextResponse } from 'next/server';
import { findPayment, syncPayment } from '@/lib/payments';

export const dynamic = 'force-dynamic';
/** Al Qaseh server-to-server notification. Used only as a trigger: the status is re-read from Al Qaseh. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const id = String(body.payment_id ?? body.paymentId ?? '').slice(0, 120);
  const orderId = String(body.order_id ?? body.orderId ?? '').slice(0, 120);
  if (!id && !orderId) return NextResponse.json({ error: 'payment_id is required' }, { status: 400 });
  const payment = await findPayment('alqaseh', { providerRef: id || undefined, externalRef: orderId || undefined });
  if (!payment) return NextResponse.json({ ok: true, status: 'not_registered_yet' }, { status: 202 });
  await syncPayment(payment, request.nextUrl.origin).catch(error => console.error('Al Qaseh webhook sync failed', error));
  return NextResponse.json({ ok: true });
}
