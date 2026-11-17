import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { getPriceListData, getPriceListSettings } from '@/lib/wholesale-price-list-data';
import { PriceListStudio } from '@/components/admin/price-list';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'قائمة أسعار الجملة', robots: { index: false } };

export default async function PriceListPage() {
  const actor = await requireAdminSection('sales', 'view');
  if (!actor) redirect('/admin');
  const [data, settings] = await Promise.all([getPriceListData(), getPriceListSettings()]);
  return <PriceListStudio data={data} initial={settings} canManage={actor.type === 'owner' || !!actor.permissions.sales?.manage} />;
}
