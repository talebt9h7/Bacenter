import { NextRequest, NextResponse } from 'next/server';
import { getPaymentByToken, latestPaymentForOrder, publicPayment, startPayment, syncPayment } from '@/lib/payments';
import { GatewayError } from '@/lib/payments/providers';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/** Current status for the pay page (asks the provider while the payment is still open). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let payment = await getPaymentByToken(token);
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (payment.status === 'pending' && Date.now() - payment.updatedAt.getTime() > 3000) {
    payment = await syncPayment(payment, request.nextUrl.origin).catch(() => payment!);
  }
  return NextResponse.json(await publicPayment(payment), { headers: { 'Cache-Control': 'no-store' } });
}

/** Try again after a failed, expired or cancelled attempt: opens a new attempt for the same order. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payment = await getPaymentByToken(token);
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [order] = await db.select({ paymentStatus: orders.paymentStatus, status: orders.status }).from(orders).where(eq(orders.id, payment.orderId));
  if (!order || order.paymentStatus === 'paid') return NextResponse.json({ error: 'This order is already paid.' }, { status: 409 });
  if (order.status === 'cancelled') return NextResponse.json({ error: 'This order was cancelled.' }, { status: 409 });
  const latest = await latestPaymentForOrder(payment.orderId);
  if (latest && latest.status === 'pending' && latest.token !== token) return NextResponse.json({ url: `/pay/${latest.token}`, redirectUrl: latest.redirectUrl });
  try {
    const lang = request.cookies.get('bellroy_lang')?.value === 'en' ? 'en' : 'ar';
    const started = await startPayment(payment.orderId, request.nextUrl.origin, lang);
    if (!started) return NextResponse.json({ error: 'Electronic payment is not available right now.' }, { status: 409 });
    return NextResponse.json({ url: `/pay/${started.token}`, redirectUrl: started.redirectUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof GatewayError ? 'The payment provider could not start the payment. Please try again shortly.' : 'Payment could not be started.' }, { status: 502 });
  }
}
