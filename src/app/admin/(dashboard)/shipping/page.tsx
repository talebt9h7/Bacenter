import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { resources } from '@/lib/admin-resources';
import { ensureStoreSeeded, getSettings } from '@/lib/settings';
import { ShippingManager, type ZoneRow } from '@/components/admin/managers';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata = { title: 'Shipping' };
export default async function AdminShippingPage() {
  const actor = await requireAdminSection('configuration', 'view');
  if (!actor) redirect('/admin');
  await ensureStoreSeeded();
  const [zones, settings] = await Promise.all([resources['shipping-zones'].list(), getSettings()]);
  return <main className="admin-page"><AdminPageHeader section="Delivery · Iraq" title="Delivery · Iraq" description="Cash-on-delivery courier rates and lead times for each of the 18 governorates." /><ShippingManager initial={zones as unknown as ZoneRow[]} settings={{ freeShippingThreshold: settings.freeShippingThreshold, codFee: settings.codFee, codEnabled: settings.codEnabled }} /></main>;
}
