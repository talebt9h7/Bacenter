import { notFound, redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { getWholesale } from '@/lib/wholesale-data';
import { getWholesaleReceiptSettings } from '@/lib/wholesale-receipt-settings';
import { WholesaleReceipt } from '@/components/admin/wholesale-receipt';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'وصل الجملة', robots: { index: false } };
export default async function WholesaleInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdminSection('sales', 'view');
  if (!actor) redirect('/admin');
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const [invoice, settings] = await Promise.all([getWholesale(id), getWholesaleReceiptSettings()]);
  if (!invoice) notFound();
  return <WholesaleReceipt invoice={invoice} initialSettings={settings} canManage={actor.type === 'owner' || !!actor.permissions.sales?.manage} />;
}
