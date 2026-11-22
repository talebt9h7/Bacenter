import { canView, getAdminActor, requireAdminSection } from '@/lib/admin-auth';
import { DASHBOARD_PERIODS, loadDashboard, type DashboardPeriod } from '@/lib/dashboard-data';
import { DashboardView } from '@/components/admin/dashboard-view';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const actor = await requireAdminSection('overview', 'view');
  if (!actor) {
    // No dashboard access: show a plain welcome (redirecting could loop with other pages that send people here).
    const who = await getAdminActor();
    return <main className="admin-page"><div className="admin-page-heading"><div><h1>{who?.name ?? 'Admin'}</h1><p>Use the menu to open the sections you have access to.</p></div></div></main>;
  }
  const { period: requested, from, to } = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/;
  // Any day or span (?from=YYYY-MM-DD&to=YYYY-MM-DD), otherwise one of the fixed periods.
  const custom = !!from && day.test(from) && (!to || day.test(to));
  const period = custom ? 'custom' : (DASHBOARD_PERIODS as readonly string[]).includes(requested ?? '') ? requested as DashboardPeriod : '30d';
  const fromDay = custom ? from : undefined;
  const toDay = custom ? (to && to >= from! ? to : from) : undefined;
  // Cost, profit and expenses are only shown to people with finance access.
  const data = await loadDashboard(period, { finance: canView(actor, 'finance'), fromDay, toDay });
  return <DashboardView data={data} adminName={actor.type === 'owner' ? undefined : actor.name} />;
}
