import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { normalizeLanguage, storefrontT } from '@/lib/i18n';
import { requireAdminSection } from '@/lib/admin-auth';
import { getSettings } from '@/lib/settings';
import { HomepageManager } from '@/components/admin/homepage-manager';

export const metadata = { title: 'Homepage' };

export default async function AdminHomepagePage() {
  const language = normalizeLanguage((await cookies()).get('UR_lang')?.value);
  const actor = await requireAdminSection('storefront', 'view');
  if (!actor) redirect('/admin');
  const settings = await getSettings();
  return <main className="admin-page"><div className="admin-page-heading"><div><span className="admin-eyebrow">{storefrontT('Storefront', language)}</span><h1>{storefrontT('Homepage', language)}</h1><p>{storefrontT('Control the homepage sections, cards, category tabs, collections and social content without editing code.', language)}</p></div></div><HomepageManager initial={settings.homepage} /></main>;
}
