import { NextRequest, NextResponse } from 'next/server';
import { getPaymentSettings } from '@/lib/payments/config';
import { applyStatus, getPaymentByToken, syncPayment } from '@/lib/payments';
import { verifyZainCashToken, zainCashClaims } from '@/lib/payments/providers';
import { db } from '@/db';
import { payments } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
/**
 * The shopper comes back here from ZainCash (success or failure) with a signed token. The token is
 * verified with the API key; the status is then confirmed with an inquiry, which is the source of truth.
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams.get('p') ?? '';
  const jwt = request.nextUrl.searchParams.get('token') ?? '';
  const origin = request.nextUrl.origin;
  const payment = await getPaymentByToken(p);
  if (!payment) return NextResponse.redirect(new URL('/', origin));
  try {
    const config = await getPaymentSettings();
    const claims = jwt ? verifyZainCashToken(jwt, config.zaincash.apiKey) : null;
    let current = payment;
    if (claims) {
      const c = zainCashClaims(claims);
      const matches = (!c.externalRef || c.externalRef === payment.externalRef) && (!c.transactionId || !payment.providerRef || c.transactionId === payment.providerRef);
      // A failed or expired result in a valid token is final; success is always double-checked below.
      if (matches && !payment.providerRef && c.transactionId) {
        [current] = await db.update(payments).set({ providerRef: c.transactionId, updatedAt: new Date() }).where(eq(payments.id, payment.id)).returning();
      }
      // The token is signed with our API key, so its status can be trusted. A paid status is still
      // double-checked by the inquiry below whenever the transaction id is known.
      if (matches && c.status !== 'pending' && (c.status !== 'paid' || !current.providerRef)) current = await applyStatus(current, c.status, { returnToken: claims }, origin);
    }
    await syncPayment(current, origin).catch(error => console.error('ZainCash inquiry failed', error));
  } catch (error) { console.error('ZainCash return failed', error); }
  return NextResponse.redirect(new URL(`/pay/${payment.token}`, origin));
}
