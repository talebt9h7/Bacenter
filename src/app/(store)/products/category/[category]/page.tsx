import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CatalogView } from '@/components/catalog-view';
import { getCategories } from '@/lib/categories';
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
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const [categories, settings] = await Promise.all([getCategories(), getSettings()]);
  const managed = categories.find(c => c.id === category);
  const title = category === 'bags' ? 'Bags & Luggage' : category === 'all' ? 'Considered carry. Endless possibility.' : managed?.name || 'Explore Bellroy';
  const description = descriptions[category];
  const base = settings.canonicalBaseUrl?.replace(/\/$/, '');
  const url = base ? `${base}/products/category/${encodeURIComponent(category)}` : undefined;
  return { title, description, alternates: url ? { canonical: url } : undefined, openGraph: { title, description, url, images: managed?.image ? [managed.image] : settings.ogImage ? [settings.ogImage] : undefined } };
}
export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const categories = await getCategories();
  if (!descriptions[category]) notFound();
  const categoryBanner = (await getActiveBanners('category', category))[0];
  const managed = categories.find(c => c.id === category);
  const title = category === 'bags' ? 'Bags & Luggage' : category === 'all' ? 'Considered carry. Endless possibility.' : managed?.name || 'Explore Bellroy';
  return <CatalogView products={await getProductsFor(category)} category={category} title={title} titleAr={category === 'bags' ? 'الحقائب والأمتعة' : category === 'all' ? 'اختيارات مدروسة لكل تنقلاتك' : (managed?.nameAr || title)} description={descriptions[category]} descriptionAr={managed?.descriptionAr || descriptions[category]} categoryBanner={categoryBanner ? { title: categoryBanner.title, subtitle: categoryBanner.subtitle, image: categoryBanner.image, mobileImage: categoryBanner.mobileImage, ctaLabel: categoryBanner.ctaLabel, href: categoryBanner.href, badge: categoryBanner.badge } : null} />;
}
