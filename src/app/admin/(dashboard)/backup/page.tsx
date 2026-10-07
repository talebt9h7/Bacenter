import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { BackupManager } from '@/components/admin/backup-manager';
export const metadata = { title: 'Backup & Restore' };
export default async function BackupPage() {
  const actor = await requireAdminSection('configuration', 'manage');
  if (!actor || actor.type !== 'owner') redirect('/admin');
  return <main className="admin-page"><div className="admin-page-heading"><div><span className="admin-eyebrow">Configuration</span><h1>Backup & Restore</h1><p>Create a full database backup and restore it later from a verified Bellroy backup file.</p></div></div><BackupManager /></main>;
}
