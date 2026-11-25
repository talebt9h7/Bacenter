import { NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/admin-auth';
import { getPaymentSettings } from '@/lib/payments/config';
import { GatewayError, qsHistory } from '@/lib/payments/providers';

export const dynamic = 'force-dynamic';
/** The latest Al Qaseh transactions as Al Qaseh reports them (read-only), to check a payment by hand. */
export async function GET() {
  if (!(await requireAdminSection('finance', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { rows, raw } = await qsHistory(await getPaymentSettings(), 50);
    return NextResponse.json({ rows, raw: rows.length ? undefined : raw }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof GatewayError || error instanceof Error ? error.message : 'Al Qaseh could not be reached.' }, { status: 502 });
  }
}
