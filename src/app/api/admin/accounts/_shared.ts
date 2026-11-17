import { NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/admin-auth';
import { AccountsError } from '@/lib/accounts';

export const forbidden = () => NextResponse.json({ error: 'ما عندك صلاحية على الحسابات.' }, { status: 403 });
export const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
export const canManage = () => requireAdminSection('finance', 'manage');
export const iqd = (value: unknown) => { const n = Math.round(Number(value)); return Number.isFinite(n) ? n : NaN; };
export const day = (value: unknown) => {
  // "YYYY-MM-DD" (Baghdad) → noon that day, so the date never slips across midnight in reports.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T09:00:00.000Z`);
  return new Date();
};
export function failure(error: unknown, fallback: string) {
  if (error instanceof AccountsError) return bad(error.message);
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
