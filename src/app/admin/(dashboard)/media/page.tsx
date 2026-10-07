import { redirect } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { requireAdminSection } from '@/lib/admin-auth';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { media } from '@/db/schema';
import { MediaLibrary } from '@/components/admin/media-library';

export const metadata = { title: 'Media Library' };

export default async function AdminMediaPage() {
  const actor = await requireAdminSection('storefront', 'view');
  if (!actor) redirect('/admin');
  const rows = await db.select({ id: media.id, filename: media.filename, mimeType: media.mimeType, size: media.size, createdAt: media.createdAt }).from(media).orderBy(desc(media.createdAt)).limit(500);
  return <main className="admin-page"><AdminPageHeader section="Storefront" title="Media Library" description="Manage every uploaded image used by products, banners, pages and storefront content." /><MediaLibrary initialItems={rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() }))} /></main>;
}
