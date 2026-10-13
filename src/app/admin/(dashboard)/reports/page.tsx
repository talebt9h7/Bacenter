import { redirect } from 'next/navigation';
import { canView, requireAdminSection } from '@/lib/admin-auth';
import { loadReports, REPORT_SECTIONS, type ReportSection } from '@/lib/reports-data';
import { ReportsView } from '@/components/admin/reports-view';

export const metadata = { title: 'Reports' };
export const dynamic = 'force-dynamic';

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string; section?: string }> }) {
  // Reports show revenue and orders; cost and profit parts need finance access (as does the Excel export).
  const actor = await requireAdminSection('finance', 'view');
  if (!actor) redirect('/admin');
  const params = await searchParams;
  const finance = canView(actor, 'finance');
  const requested = (REPORT_SECTIONS as readonly string[]).includes(params.section ?? '') ? params.section as ReportSection : 'overview';
  const section = requested === 'profit' && !finance ? 'overview' : requested;
  const data = await loadReports({ period: params.period, from: params.from, to: params.to });
  return <ReportsView data={data} section={section} finance={finance} />;
}
