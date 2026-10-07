import { redirect } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { adminUsers } from '@/db/schema';
import { requireAdminSection, ROLE_DEFAULTS, SECTION_LABELS, type AdminSection } from '@/lib/admin-auth';
import { TeamManager } from '@/components/admin/team-manager';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const actor = await requireAdminSection('team', 'view');
  if (!actor) redirect('/admin');
  const users = await db.select({
    id: adminUsers.id, username: adminUsers.username, name: adminUsers.name,
    role: adminUsers.role, permissions: adminUsers.permissions, active: adminUsers.active,
    lastLoginAt: adminUsers.lastLoginAt, createdAt: adminUsers.createdAt,
  }).from(adminUsers).orderBy(asc(adminUsers.name));

  return <main className="admin-page">
    <AdminPageHeader section="System" title="Team & Permissions" description="Manage who can access the admin panel and exactly which sections they can view or manage." />
    <TeamManager initial={users} roles={Object.keys(ROLE_DEFAULTS)} sectionLabels={SECTION_LABELS} canManage={actor.type === 'owner' || !!actor.permissions.team?.manage} />
  </main>;
}
