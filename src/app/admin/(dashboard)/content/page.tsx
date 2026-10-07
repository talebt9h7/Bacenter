import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { normalizeLanguage, storefrontT } from '@/lib/i18n';
import { requireAdminSection } from '@/lib/admin-auth';
import { resources } from '@/lib/admin-resources';
import { ensureStoreSeeded, getSettings } from '@/lib/settings';
import { ContentManager, type ContentRow } from '@/components/admin/managers';

export const metadata = { title: 'Content' };
export default async function AdminContentPage() {
  const language = normalizeLanguage((await cookies()).get('UR_lang')?.value);
  const actor = await requireAdminSection('storefront', 'view');
  if (!actor) redirect('/admin');
  await ensureStoreSeeded();
  const [pages, settings] = await Promise.all([resources.content.list(), getSettings()]);
  const rows = pages.map(page => ({ ...page, updatedAt: (page.updatedAt as Date).toISOString() })) as unknown as ContentRow[];
  return <main className="admin-page"><div className="admin-page-heading"><div><span className="admin-eyebrow">{storefrontT('Content', language)}</span><h1>{storefrontT('Pages & messaging', language)}</h1><p>{storefrontT('Edit the storefront’s information pages, FAQs and homepage messaging without touching code.', language)}</p></div></div><ContentManager pages={rows} home={{ homeHeadline: settings.homeHeadline, homeHeadlineAr: settings.homeHeadlineAr ?? '', homeSubheadline: settings.homeSubheadline, homeSubheadlineAr: settings.homeSubheadlineAr ?? '', homeValues: settings.homeValues }} site={{ storeName: settings.storeName, tagline: settings.tagline, logoUrl: settings.logoUrl, logoAlt: settings.logoAlt, faviconUrl: settings.faviconUrl, metaTitle: settings.metaTitle, metaDescription: settings.metaDescription, footerTagline: settings.footerTagline, copyrightText: settings.copyrightText, instagram: settings.instagram, youtube: settings.youtube, facebook: settings.facebook }} /></main>;
}
