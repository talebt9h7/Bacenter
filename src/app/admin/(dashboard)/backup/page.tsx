import { PageKpis } from '@/components/admin/page-kpis';
import { pageStats } from '@/lib/admin-page-stats';
import { AdminHeading } from '@/components/admin/admin-heading';
import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { BackupManager } from '@/components/admin/backup-manager';
export const metadata = { title: 'Backup & Restore' };
export default async function BackupPage() {
  const actor = await requireAdminSection('configuration', 'manage');
  if (!actor || actor.type !== 'owner') redirect('/admin');
  return <main className="admin-page"><AdminHeading eyebrow={{ en: 'Configuration', ar: 'الإعدادات' }} title={{ en: 'Backup & Restore', ar: 'النسخ الاحتياطي والاستعادة' }} description={{ en: 'Create a full database backup and restore it later from a verified backup file.', ar: 'سوِّ نسخة احتياطية كاملة من قاعدة البيانات واسترجعها لاحقاً من ملف موثوق.' }} /><PageKpis items={await pageStats('backup')} /><BackupManager /></main>;
}
