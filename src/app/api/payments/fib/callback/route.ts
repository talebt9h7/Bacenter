import { NextRequest, NextResponse } from 'next/server';
import { findPayment, syncPayment } from '@/lib/payments';

export const dynamic = 'force-dynamic';
/**
 * FIB posts { id, status } here when a payment changes. The body is not signed, so it is only a
 * hint: the real status is fetched from FIB with our own credentials before anything is recorded.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { id?: string };
  const id = typeof body.id === 'string' ? body.id.slice(0, 100) : '';
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const payment = await findPayment('fib', { providerRef: id });
  if (payment) await syncPayment(payment, request.nextUrl.origin).catch(error => console.error('FIB callback sync failed', error));
  return NextResponse.json({ ok: true });
}
