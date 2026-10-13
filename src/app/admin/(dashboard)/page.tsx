import { canView, getAdminActor, requireAdminSection } from '@/lib/admin-auth';
import { DASHBOARD_PERIODS, loadDashboard, type DashboardPeriod } from '@/lib/dashboard-data';
import { DashboardView } from '@/components/admin/dashboard-view';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const actor = await requireAdminSection('overview', 'view');
  if (!actor) {
    // No dashboard access: show a plain welcome (redirecting could loop with other pages that send people here).
    const who = await getAdminActor();
    return <main className="admin-page"><div className="admin-page-heading"><div><h1>{who?.name ?? 'Admin'}</h1><p>Use the menu to open the sections you have access to.</p></div></div></main>;
  }
  const { period: requested } = await searchParams;
  const period = (DASHBOARD_PERIODS as readonly string[]).includes(requested ?? '') ? requested as DashboardPeriod : '30d';
  // Cost, profit and expenses are only shown to people with finance access.
  const data = await loadDashboard(period, { finance: canView(actor, 'finance') });
  return <DashboardView data={data} adminName={actor.type === 'owner' ? undefined : actor.name} />;
}
