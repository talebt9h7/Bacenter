import { NextRequest, NextResponse } from 'next/server';
import { LANGUAGE_COOKIE, normalizeLanguage } from './i18n';

/** JSON error in the admin's language (Arabic unless they switched to English). */
export function fail(request: NextRequest, status: number, en: string, ar: string) {
  const lang = normalizeLanguage(request.cookies.get(LANGUAGE_COOKIE)?.value);
  return NextResponse.json({ error: lang === 'en' ? en : ar }, { status });
}
export const str = (v: unknown, max = 300) => typeof v === 'string' ? v.trim().slice(0, max) : '';
export const int = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : NaN; };
/** "2026-10-15" or "2026-10-15T09:30" read as Baghdad time (UTC+3), not the server's clock. */
export function baghdadDate(v: unknown): Date | null {
  const s = str(v, 30);
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], (m[4] ? +m[4] : 12) - 3, m[5] ? +m[5] : 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function supplierFields(body: Record<string, unknown>) {
  return {
    name: str(body.name, 120), phone: str(body.phone, 40) || null, email: str(body.email, 160) || null, country: str(body.country, 80) || null,
    city: str(body.city, 80) || null, address: str(body.address, 300) || null, contactPerson: str(body.contactPerson, 120) || null, notes: str(body.notes, 1000) || null,
    openingBalanceIqd: Number.isInteger(int(body.openingBalanceIqd)) ? int(body.openingBalanceIqd) : 0,
    paymentTermsDays: Math.min(365, Math.max(0, int(body.paymentTermsDays) || 0)),
  };
}
