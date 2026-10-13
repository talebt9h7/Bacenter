import { redirect } from 'next/navigation';
import { canView, requireAdminSection } from '@/lib/admin-auth';
import { loadReports } from '@/lib/reports-data';
import { RevenueView } from '@/components/admin/money-views';

export const metadata = { title: 'Revenue' };
export const dynamic = 'force-dynamic';

export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const actor = await requireAdminSection('finance', 'view');
  if (!actor) redirect('/admin');
  const { period = '30d' } = await searchParams;
  return <RevenueView data={await loadReports({ period })} finance={canView(actor, 'finance')} />;
}
