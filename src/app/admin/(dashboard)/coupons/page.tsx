import { PageKpis } from '@/components/admin/page-kpis';
import { pageStats } from '@/lib/admin-page-stats';
import { AdminHeading } from '@/components/admin/admin-heading';
import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { resources } from '@/lib/admin-resources';
import { CouponManager, type CouponRow } from '@/components/admin/managers';

export const metadata = { title: 'Coupons' };
export default async function AdminCouponsPage() {
  const actor = await requireAdminSection('sales', 'view');
  if (!actor) redirect('/admin');
  const rows = (await resources.coupons.list()).map(row => ({ ...row, expiresAt: row.expiresAt ? (row.expiresAt as Date).toISOString() : null, createdAt: (row.createdAt as Date).toISOString() })) as unknown as CouponRow[];
  return <main className="admin-page"><AdminHeading eyebrow={{ en: 'Marketing', ar: 'التسويق' }} title={{ en: 'Coupons', ar: 'الكوبونات' }} description={{ en: 'Percentage or fixed-amount discounts in IQD, with minimum order, usage limits, expiry and optional free delivery.', ar: 'خصومات بنسبة أو بمبلغ ثابت بالدينار، مع حد أدنى للطلب، وعدد استخدامات، وتاريخ انتهاء، وتوصيل مجاني اختياري.' }} /><PageKpis items={await pageStats('coupons')} /><CouponManager initial={rows} /></main>;
}
