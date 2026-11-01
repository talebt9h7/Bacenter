import { getCatalogNav } from '@/lib/categories';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CatalogView } from '@/components/catalog-view';
import { getCategories, getCategoryPage } from '@/lib/categories';
import { getProductsFor } from '@/lib/products';
import { getActiveBanners, getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ category: string }> };
const descriptions: Record<string, string> = {
  all: 'Considered carry goods for all the ways you move. Find your everyday companion, and take it somewhere good.',
  backpacks: 'For workdays, weekends and everything in between. Clever organization, all-day comfort, and a place for everything.',
  bags: 'Big plans. Small adventures. A bag for every kind of day, thoughtfully designed from the inside out.',
  wallets: 'Slim silhouettes. Clever details. Responsibly sourced leather that only gets better with age.',
  'crossbody-bags': 'Keep your pockets light and your essentials close. Easy-access carry that moves with you.',
  'phone-cases': 'Big protection. Slim profile. Beautifully considered cases for the device you carry everywhere.',
  luggage: 'For the long haul. Considered luggage to take you from departure to discovery, and back again.',
  'work-bags': 'A smarter way to carry your working day. From first coffee to the last train home.',
  'tote-bags': 'Room for the unexpected. Versatile carry that adapts to your day.',
  accessories: 'Less rummaging. More doing. Give your little essentials a thoughtfully organized home.',
};
/** Heading + banner for a category page: what the admin set in Admin → Categories, with the built-in copy as fallback. */
async function resolvePage(category: string) {
  const [categories, page] = await Promise.all([getCategories(), getCategoryPage(category)]);
  const managed = categories.find(c => c.id === category);
  // A category page exists for 'all', the 'bags' group, and every switched-on category.
  const exists = category === 'all' || category === 'bags' || !!managed;
  if (!exists) return null;
  const fallbackTitle = category === 'bags' ? 'Bags & Luggage' : category === 'all' ? 'Considered carry. Endless possibility.' : managed?.name || 'Explore the collection';
  const fallbackTitleAr = category === 'bags' ? 'الحقائب والأمتعة' : category === 'all' ? 'اختيارات مدروسة لكل تنقلاتك' : managed?.nameAr || fallbackTitle;
  return {
    managed,
    title: page?.headline || fallbackTitle,
    titleAr: page?.headlineAr || fallbackTitleAr,
    eyebrow: page?.eyebrow || '',
    eyebrowAr: page?.eyebrowAr || '',
    description: page?.description || descriptions[category] || '',
    descriptionAr: page?.descriptionAr || page?.description || descriptions[category] || '',
    image: page?.image || null,
    banner: page?.banner ?? null,
  };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const [page, settings] = await Promise.all([resolvePage(category), getSettings()]);
  if (!page) return {};
  const base = settings.canonicalBaseUrl?.replace(/\/$/, '');
  const url = base ? `${base}/products/category/${encodeURIComponent(category)}` : undefined;
  const image = page.banner?.image || page.image || settings.ogImage;
  return { title: page.title, description: page.description, alternates: url ? { canonical: url } : undefined, openGraph: { title: page.title, description: page.description, url, images: image ? [image] : undefined } };
}
export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const page = await resolvePage(category);
  if (!page) notFound();
  // The category's own banner (Admin → Categories) comes first; older banners from Admin → Banners still work.
  const legacy = page.banner ? null : (await getActiveBanners('category', category))[0];
  const banner = page.banner
    ? { title: page.banner.title, titleAr: page.banner.titleAr, subtitle: page.banner.subtitle, subtitleAr: page.banner.subtitleAr, image: page.banner.image, mobileImage: page.banner.mobileImage, ctaLabel: page.banner.cta, ctaLabelAr: page.banner.ctaAr, href: page.banner.href, badge: null }
    : legacy ? { title: legacy.title, titleAr: legacy.title, subtitle: legacy.subtitle ?? '', subtitleAr: legacy.subtitle ?? '', image: legacy.image, mobileImage: legacy.mobileImage, ctaLabel: legacy.ctaLabel ?? '', ctaLabelAr: legacy.ctaLabel ?? '', href: legacy.href, badge: legacy.badge } : null;
  return <CatalogView navCategories={await getCatalogNav()} products={await getProductsFor(category)} category={category} title={page.title} titleAr={page.titleAr} eyebrow={page.eyebrow} eyebrowAr={page.eyebrowAr} description={page.description} descriptionAr={page.descriptionAr} categoryBanner={banner} />;
}
