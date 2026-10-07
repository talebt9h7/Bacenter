import { redirect } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { requireAdminSection } from '@/lib/admin-auth';
import { getSettings } from '@/lib/settings';
import { FooterManager } from '@/components/admin/footer-manager';
export const metadata = { title: 'Footer' };
export const dynamic = 'force-dynamic';
export default async function AdminFooterPage(){
  const actor = await requireAdminSection('storefront', 'view');
  if (!actor) redirect('/admin'); const settings=await getSettings(); return <main className="admin-page"><AdminPageHeader section="Storefront" title="Footer" description="Control footer columns, links, trust messages and newsletter content without editing code." /><FooterManager initial={settings.footer}/></main>; }
