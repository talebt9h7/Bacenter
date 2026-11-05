import { PageKpis } from '@/components/admin/page-kpis';
import { pageStats } from '@/lib/admin-page-stats';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { normalizeLanguage, storefrontT } from '@/lib/i18n';
import { requireAdminSection } from '@/lib/admin-auth';
import { getSettings } from '@/lib/settings';
import { HomepageManager } from '@/components/admin/homepage-manager';
import { HeroRingManager } from '@/components/admin/hero-ring-manager';
import { getHeroRing, RING_LIMITS } from '@/lib/hero-ring';
import { getAllProducts } from '@/lib/products';
import { mediaSrc, primaryImage } from '@/lib/types';

export const metadata = { title: 'Homepage' };

export default async function AdminHomepagePage() {
  const language = normalizeLanguage((await cookies()).get('UR_lang')?.value);
  const actor = await requireAdminSection('storefront', 'view');
  if (!actor) redirect('/admin');
  const [settings, ring, products] = await Promise.all([getSettings(), getHeroRing(), getAllProducts({ includeUnpublished: true })]);
  const productOptions = products.map(p => { const img = primaryImage(p.colors.find(c => c.images.length) ?? p.colors[0]); return { id: p.id, name: p.nameAr || p.name, image: img ? mediaSrc(img, 160) : '' }; });
  return <main className="admin-page"><div className="admin-page-heading"><div><span className="admin-eyebrow">{storefrontT('Storefront', language)}</span><h1>{storefrontT('Homepage', language)}</h1><p>{storefrontT('Control the homepage sections, cards, category tabs, collections and social content without editing code.', language)}</p></div></div><PageKpis items={await pageStats('homepage')} /><HeroRingManager initial={ring} products={productOptions} limits={RING_LIMITS} /><HomepageManager initial={settings.homepage} /></main>;
}
