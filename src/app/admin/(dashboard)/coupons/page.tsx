import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { resources } from '@/lib/admin-resources';
import { CouponManager, type CouponRow } from '@/components/admin/managers';

export const metadata = { title: 'Coupons' };
export default async function AdminCouponsPage() {
  const actor = await requireAdminSection('sales', 'view');
  if (!actor) redirect('/admin');
  const rows = (await resources.coupons.list()).map(row => ({ ...row, expiresAt: row.expiresAt ? (row.expiresAt as Date).toISOString() : null, createdAt: (row.createdAt as Date).toISOString() })) as unknown as CouponRow[];
  return <main className="admin-page"><div className="admin-page-heading"><div><span className="admin-eyebrow">Marketing</span><h1>Coupons</h1><p>Percentage or fixed-amount discounts in IQD, with minimum order, usage limits, expiry and optional free delivery.</p></div></div><CouponManager initial={rows} /></main>;
}
