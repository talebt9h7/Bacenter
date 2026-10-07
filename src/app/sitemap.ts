import type { MetadataRoute } from 'next';
import { getAllProducts } from '@/lib/products';
import { getCategories } from '@/lib/categories';
import { getSettings } from '@/lib/settings';
import { infoPages } from '@/lib/info';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [settings, products, categories] = await Promise.all([getSettings(), getAllProducts(), getCategories()]);
  const base = (settings.canonicalBaseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const now = new Date();
  const urls: MetadataRoute.Sitemap = [{ url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 }];
  for (const product of products) urls.push({ url: `${base}/products/${encodeURIComponent(product.id)}`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 });
  for (const category of categories.filter(c => c.active)) urls.push({ url: `${base}/products/category/${encodeURIComponent(category.id)}`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 });
  for (const collection of settings.homepage.collections.filter(item => item.active)) {
    const slug = collection.slug;
    if (slug) urls.push({ url: `${base}/collection/${encodeURIComponent(slug)}`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 });
  }
  for (const slug of Object.keys(infoPages)) urls.push({ url: `${base}/info/${encodeURIComponent(slug)}`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 });
  return urls;
}
