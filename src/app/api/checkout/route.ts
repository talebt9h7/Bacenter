import { NextRequest, NextResponse } from 'next/server';
import { validateCoupon } from '@/lib/orders';
import { checkoutConfig } from '@/lib/checkout-config';

export const dynamic = 'force-dynamic';
// Checkout configuration (Iraq delivery zones, COD settings) and coupon validation.
export async function GET() {
  return NextResponse.json(await checkoutConfig());
}
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const subtotal = Number(body.subtotal);
  if (typeof body.code !== 'string' || !Number.isFinite(subtotal)) return NextResponse.json({ error: 'Invalid coupon request.' }, { status: 400 });
  const result = await validateCoupon(body.code, subtotal);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ code: result.coupon.code, discount: result.discount, freeShipping: result.freeShipping, description: result.coupon.type === 'percent' ? `${result.coupon.value}% off` : `${result.coupon.value.toLocaleString('en-US')} IQD off` });
}
