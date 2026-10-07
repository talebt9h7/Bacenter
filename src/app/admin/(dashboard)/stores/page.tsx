import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { getStoreLocations } from '@/lib/store-locations';
import { StoreLocationManager } from '@/components/admin/store-location-manager';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata = { title: 'Stores & stockists' };

export default async function StoresPage() {
  const actor = await requireAdminSection('storefront', 'view');
  if (!actor) redirect('/admin');
  return <main className="admin-page"><AdminPageHeader section="Storefront" title="Stores & stockists" description="Manage the points of sale shown on the storefront. Changes are saved to the database." /><StoreLocationManager initial={await getStoreLocations({ includeInactive: true })} /></main>;
}
