import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { normalizeLanguage, storefrontT } from '@/lib/i18n';
import { requireAdminSection } from '@/lib/admin-auth';
import { ensureStoreSeeded, getSettings } from '@/lib/settings';
import { NavigationManager } from '@/components/admin/navigation-manager';
export const metadata = { title: 'Header Navigation' };
export const dynamic = 'force-dynamic';
export default async function AdminNavigationPage() {
  const language = normalizeLanguage((await cookies()).get('UR_lang')?.value);
  const actor = await requireAdminSection('storefront', 'view');
  if (!actor) redirect('/admin'); await ensureStoreSeeded(); const settings = await getSettings(); return <main className="admin-page"><div className="admin-page-heading"><div><span className="admin-eyebrow">{storefrontT('Storefront', language)}</span><h1>{storefrontT('Header & navigation', language)}</h1><p>{storefrontT('Edit every main menu item shown in the website header, including its dropdown links, order and destination.', language)}</p></div></div><NavigationManager initial={settings.navigation} /></main>; }
