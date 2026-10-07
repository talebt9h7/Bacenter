import { NextRequest, NextResponse } from 'next/server';
import { getActiveZones, getPublicSettings } from '@/lib/settings';
import { validateCoupon } from '@/lib/orders';

export const dynamic = 'force-dynamic';
// Checkout configuration (Iraq delivery zones, COD settings) and coupon validation.
export async function GET() {
  const [zones, settings] = await Promise.all([getActiveZones(), getPublicSettings()]);
  return NextResponse.json({ zones: zones.map(zone => ({ code: zone.code, nameEn: zone.nameEn, nameAr: zone.nameAr, rate: zone.rate, minDays: zone.minDays, maxDays: zone.maxDays })), settings });
}
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const subtotal = Number(body.subtotal);
  if (typeof body.code !== 'string' || !Number.isFinite(subtotal)) return NextResponse.json({ error: 'Invalid coupon request.' }, { status: 400 });
  const result = await validateCoupon(body.code, subtotal);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ code: result.coupon.code, discount: result.discount, freeShipping: result.freeShipping, description: result.coupon.type === 'percent' ? `${result.coupon.value}% off` : `${result.coupon.value.toLocaleString('en-US')} IQD off` });
}
