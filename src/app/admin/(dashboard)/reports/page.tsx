import { redirect } from 'next/navigation';
import { canView, requireAdminSection } from '@/lib/admin-auth';
import { loadReports } from '@/lib/reports-data';
import { baghdadDayKey } from '@/lib/report-period';
import { ReportsNasaq } from '@/components/admin/reports-nasaq';

export const metadata = { title: 'Reports' };
export const dynamic = 'force-dynamic';

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  // Reports show revenue and orders; cost and profit parts need finance access (as does the Excel export).
  const actor = await requireAdminSection('finance', 'view');
  if (!actor) redirect('/admin');
  const params = await searchParams;
  const finance = canView(actor, 'finance');
  const today = baghdadDayKey(new Date());
  // Opens on the current month, as Nasaq does; links pick another range with from/to (or a period).
  const range = params.period || params.from || params.to ? params : { from: `${today.slice(0, 7)}-01`, to: today };
  const data = await loadReports(range);
  return <ReportsNasaq data={data} finance={finance} today={today} />;
}
