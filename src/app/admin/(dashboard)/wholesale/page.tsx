import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { listWholesale } from '@/lib/wholesale-data';
import { variantCatalog } from '@/lib/admin-catalog';
import { WholesaleManager } from '@/components/admin/wholesale-manager';

export const metadata = { title: 'Wholesale' };
export const dynamic = 'force-dynamic';
export default async function WholesalePage() {
  const actor = await requireAdminSection('sales', 'view');
  if (!actor) redirect('/admin');
  const [invoices, catalog] = await Promise.all([listWholesale(), variantCatalog()]);
  return <WholesaleManager initial={invoices} catalog={catalog.filter(v => v.published || v.available > 0)} />;
}
