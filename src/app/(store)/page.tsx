import { Homepage } from '@/components/homepage';
import { getAllProducts } from '@/lib/products';
import { getActiveBanners, getSettings } from '@/lib/settings';
import { getCategories } from '@/lib/categories';
import { getStoreBundles } from '@/lib/bundles';
import { getHeroRing } from '@/lib/hero-ring';
import { primaryImage } from '@/lib/types';

export const revalidate = 60;
export default async function HomePage() {
  const [products, heroBanners, highlightBanners, settings, categories, bundles, ringConfig] = await Promise.all([getAllProducts(), getActiveBanners('hero'), getActiveBanners('highlight'), getSettings(), getCategories(), getStoreBundles(), getHeroRing()]);
  // The product ring replaces the bestseller hero when it is switched on with at least 3 products.
  const ringItems = ringConfig.enabled ? ringConfig.items.flatMap(item => {
    const product = products.find(p => p.id === item.productId);
    if (!product) return [];
    const photo = item.image || primaryImage(product.colors.find(c => c.images.length) ?? product.colors[0]);
    return photo ? [{ id: product.id, name: product.nameAr || product.name, href: `/products/${product.id}`, image: photo, cutout: !!item.image }] : [];
  }) : [];
  const ring = ringItems.length >= 3 ? { items: ringItems, secondsPerTurn: ringConfig.secondsPerTurn } : null;
  return <Homepage products={products} heroBanners={heroBanners} highlightBanners={highlightBanners} homepage={settings.homepage} categories={categories} bundles={bundles} ring={ring} />;
}
