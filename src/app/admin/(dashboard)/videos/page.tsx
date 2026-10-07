import { redirect } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { requireAdminSection } from '@/lib/admin-auth';
import { getSettings } from '@/lib/settings';
import { VideoStoriesManager } from '@/components/admin/video-stories-manager';
export const dynamic = 'force-dynamic';
export default async function VideoStoriesPage() {
  const actor = await requireAdminSection('storefront', 'view');
  if (!actor) redirect('/admin');
  const settings = await getSettings();
  return <main className="admin-page"><AdminPageHeader section="Storefront" title="Video Stories" description="Manage homepage video stories, YouTube IDs, Arabic and English copy, calls to action and visibility." /><VideoStoriesManager initial={settings.homepage}/></main>;
}
