import { Homepage } from '@/components/homepage';
import { getAllProducts } from '@/lib/products';
import { getActiveBanners, getSettings } from '@/lib/settings';
import { getCategories } from '@/lib/categories';

export const revalidate = 60;
export default async function HomePage() {
  const [products, heroBanners, highlightBanners, settings, categories] = await Promise.all([getAllProducts(), getActiveBanners('hero'), getActiveBanners('highlight'), getSettings(), getCategories()]);
  return <Homepage products={products} heroBanners={heroBanners} highlightBanners={highlightBanners} homepage={settings.homepage} categories={categories} />;
}
