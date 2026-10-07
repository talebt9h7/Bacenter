import { requireAdminSection } from '@/lib/admin-auth';
import { ActivityLogManager } from '@/components/admin/activity-log-manager';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
  const actor = await requireAdminSection('configuration', 'view');
  if (!actor) redirect('/admin');
  return <main className="admin-page"><AdminPageHeader section="Configuration" title="Activity Log" description="Track important actions performed in the administration panel." /><ActivityLogManager /></main>;
}
