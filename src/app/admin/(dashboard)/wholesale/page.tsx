import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { listWholesale } from '@/lib/wholesale-data';
import { variantCatalog } from '@/lib/admin-catalog';
import { costLayersByVariant } from '@/lib/cost-layers';
import { getWholesaleReceiptSettings } from '@/lib/wholesale-receipt-settings';
import { WholesaleManager } from '@/components/admin/wholesale-manager';

export const metadata = { title: 'Wholesale' };
export const dynamic = 'force-dynamic';
export default async function WholesalePage() {
  const actor = await requireAdminSection('sales', 'view');
  if (!actor) redirect('/admin');
  const showProfit = actor.type === 'owner' || !!actor.permissions.finance?.view;
  const [invoices, catalog, receiptSettings, costLayers] = await Promise.all([listWholesale(), variantCatalog(), getWholesaleReceiptSettings(), showProfit ? costLayersByVariant() : Promise.resolve(undefined)]);
  return <WholesaleManager costLayers={costLayers} receiptSettings={receiptSettings} canManage={actor.type === 'owner' || !!actor.permissions.sales?.manage} initial={invoices} catalog={catalog.filter(v => v.published || v.available > 0)} />;
}
