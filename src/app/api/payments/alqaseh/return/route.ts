import { NextRequest, NextResponse } from 'next/server';
import { getPaymentByToken, syncPayment } from '@/lib/payments';

export const dynamic = 'force-dynamic';
/**
 * The shopper returns here from Al Qaseh's hosted page (?payment_id&order_id&status). The query
 * status is only a hint: the real status, amount and currency are read from Al Qaseh before anything changes.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const payment = await getPaymentByToken(request.nextUrl.searchParams.get('p') ?? '');
  if (!payment) return NextResponse.redirect(new URL('/', origin));
  await syncPayment(payment, origin).catch(error => console.error('Al Qaseh status check failed', error));
  return NextResponse.redirect(new URL(`/pay/${payment.token}`, origin));
}
