import { Homepage } from '@/components/homepage';
import { getAllProducts } from '@/lib/products';
import { getActiveBanners, getSettings } from '@/lib/settings';
import { getCategories } from '@/lib/categories';
import { getStoreBundles } from '@/lib/bundles';
import { getHeroRing, type RingItem, type RingView } from '@/lib/hero-ring';
import { primaryImage } from '@/lib/types';
import { priceFrom } from '@/lib/variants';

export const revalidate = 60;
export default async function HomePage() {
  const [products, heroBanners, highlightBanners, settings, categories, bundles, ringConfig] = await Promise.all([getAllProducts(), getActiveBanners('hero'), getActiveBanners('highlight'), getSettings(), getCategories(), getStoreBundles(), getHeroRing()]);
  // The product ring replaces the bestseller hero when it is switched on with at least 3 products.
  const ringItems: RingItem[] = ringConfig.enabled ? ringConfig.items.flatMap(item => {
    const product = products.find(p => p.id === item.productId);
    if (!product) return [];
    const color = product.colors.find(c => c.images.length);
    const photo = item.image || (color ? primaryImage(color) : '');
    if (!photo) return [];
    const from = priceFrom(product);
    return [{ id: product.id, name: product.name, nameAr: product.nameAr || product.name, priceIqd: from.min, priceVaries: from.varies, href: `/products/${product.id}`, image: photo, cutout: !!item.image && item.cut !== false }];
  }) : [];
  const ring: RingView | null = ringItems.length >= 3 ? { items: ringItems, secondsPerTurn: ringConfig.secondsPerTurn, heading: ringConfig.heading, caption: ringConfig.caption } : null;
  return <Homepage products={products} heroBanners={heroBanners} highlightBanners={highlightBanners} homepage={settings.homepage} categories={categories} bundles={bundles} ring={ring} />;
}
