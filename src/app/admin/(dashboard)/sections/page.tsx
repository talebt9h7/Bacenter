import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { normalizeLanguage, storefrontT } from '@/lib/i18n';
import { requireAdminSection } from '@/lib/admin-auth';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { banners } from '@/db/schema';
import { categories } from '@/lib/catalog';
import { ensureStoreSeeded } from '@/lib/settings';
import { SectionManager } from '@/components/admin/section-manager';

export const metadata = { title: 'Store Sections' };
export const dynamic = 'force-dynamic';

export default async function AdminSectionsPage() {
  const language = normalizeLanguage((await cookies()).get('UR_lang')?.value);
  const actor = await requireAdminSection('storefront', 'view');
  if (!actor) redirect('/admin');
  await ensureStoreSeeded();
  const rows = await db.select().from(banners).where(eq(banners.kind, 'category')).orderBy(banners.sortOrder, banners.id);
  const initial = rows.map(row => ({ ...row, startsAt: row.startsAt?.toISOString() ?? null, endsAt: row.endsAt?.toISOString() ?? null }));
  return <main className="admin-page"><div className="admin-page-heading"><div><span className="admin-eyebrow">{storefrontT('Storefront', language)}</span><h1>{storefrontT('Sections & category banners', language)}</h1><p>{storefrontT('Manage the visual content for sections such as Wallets, Backpacks, Bags and Accessories.', language)}</p></div></div><SectionManager categories={categories} banners={initial} /></main>;
}
