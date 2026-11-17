import { iraqGovernorates } from '@/lib/iraq';

/** Validates a delivery company from the admin form. */
export type CourierInput = { name: string; phone: string | null; defaultFeeIqd: number; returnFeeIqd: number; rates: Record<string, number>; active: boolean };
export function courierInput(body: Record<string, unknown>): { error: string } | { value: CourierInput } {
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  if (name.length < 2) return { error: 'اكتب اسم شركة التوصيل.' };
  const fee = (v: unknown) => Math.max(0, Math.min(1_000_000, Math.round(Number(v) || 0)));
  const rates: Record<string, number> = {};
  const raw = body.rates && typeof body.rates === 'object' ? body.rates as Record<string, unknown> : {};
  for (const g of iraqGovernorates) if (raw[g.code] !== undefined && raw[g.code] !== '' && raw[g.code] !== null) rates[g.code] = fee(raw[g.code]);
  return { value: { name, phone: typeof body.phone === 'string' ? body.phone.trim().slice(0, 30) || null : null, defaultFeeIqd: fee(body.defaultFeeIqd), returnFeeIqd: fee(body.returnFeeIqd), rates, active: body.active !== false } };
}
