import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { listWholesale } from '@/lib/wholesale-data';
import { variantCatalog } from '@/lib/admin-catalog';
import { getWholesaleReceiptSettings } from '@/lib/wholesale-receipt-settings';
import { WholesaleManager } from '@/components/admin/wholesale-manager';

export const metadata = { title: 'Wholesale' };
export const dynamic = 'force-dynamic';
export default async function WholesalePage() {
  const actor = await requireAdminSection('sales', 'view');
  if (!actor) redirect('/admin');
  const [invoices, catalog, receiptSettings] = await Promise.all([listWholesale(), variantCatalog(), getWholesaleReceiptSettings()]);
  return <WholesaleManager receiptSettings={receiptSettings} canManage={actor.type === 'owner' || !!actor.permissions.sales?.manage} initial={invoices} catalog={catalog.filter(v => v.published || v.available > 0)} />;
}
