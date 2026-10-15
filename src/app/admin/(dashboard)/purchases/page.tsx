import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { loadProcurement } from '@/lib/procurement';
import { variantCatalog } from '@/lib/admin-catalog';
import { getSettings } from '@/lib/settings';
import { ProcurementManager } from '@/components/admin/procurement-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'المشتريات والموردون' };

export default async function PurchasesPage() {
  const actor = await requireAdminSection('catalog', 'view');
  if (!actor) redirect('/admin');
  const canManage = !!(await requireAdminSection('catalog', 'manage'));
  const [data, catalog, settings] = await Promise.all([loadProcurement(), variantCatalog(), getSettings()]);
  return <ProcurementManager initial={data} catalog={catalog} exchangeRate={settings.exchangeRate} canManage={canManage} />;
}
