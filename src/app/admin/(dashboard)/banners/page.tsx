import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { normalizeLanguage, storefrontT } from '@/lib/i18n';
import { requireAdminSection } from '@/lib/admin-auth';
import { resources } from '@/lib/admin-resources';
import { ensureStoreSeeded } from '@/lib/settings';
import { BannerManager, type BannerRow } from '@/components/admin/managers';

export const metadata = { title: 'Banners' };
export default async function AdminBannersPage() {
  const language = normalizeLanguage((await cookies()).get('UR_lang')?.value);
  const actor = await requireAdminSection('storefront', 'view');
  if (!actor) redirect('/admin');
  await ensureStoreSeeded();
  const rows = (await resources.banners.list()).map(row => ({ ...row, startsAt: row.startsAt ? (row.startsAt as Date).toISOString() : null, endsAt: row.endsAt ? (row.endsAt as Date).toISOString() : null })) as unknown as BannerRow[];
  return <main className="admin-page"><div className="admin-page-heading"><div><span className="admin-eyebrow">{storefrontT('Merchandising', language)}</span><h1>{storefrontT('Banners', language)}</h1><p>{storefrontT('Hero slides, highlight cards and promotional placements. Schedule campaigns with start and end dates.', language)}</p></div></div><BannerManager initial={rows} /></main>;
}
