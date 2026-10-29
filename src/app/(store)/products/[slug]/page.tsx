import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/product-detail';
import { getAllProducts, getProductById } from '@/lib/products';
import { getSettings } from '@/lib/settings';
import { cleanDetails } from '@/lib/product-details';
import { getProductPageBanner } from '@/lib/product-page-banner';
import { getStoreBundles } from '@/lib/bundles';
import { getProductReviews } from '@/lib/reviews';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ color?: string; size?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductById(slug), getSettings()]);
  if (!product) return { title: 'Product', robots: { index: false, follow: false } };
  const image = product.colors.find(c => c.images.length)?.images[0] || settings.ogImage;
  const base = settings.canonicalBaseUrl?.replace(/\/$/, '');
  const url = base ? `${base}/products/${encodeURIComponent(product.id)}` : undefined;
  return {
    title: product.name,
    description: product.description || product.subtitle,
    alternates: url ? { canonical: url } : undefined,
    openGraph: { title: product.name, description: product.description || product.subtitle, url, images: image ? [image] : undefined, type: 'website' },
    twitter: { card: 'summary_large_image', title: product.name, description: product.description || product.subtitle, images: image ? [image] : undefined },
  };
}
export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params; const { color, size } = await searchParams;
  // Both reads come from the shared catalog cache, so they cost no extra database trips.
  const [product, all, banner, allBundles, reviews] = await Promise.all([getProductById(slug), getAllProducts(), getProductPageBanner(), getStoreBundles(), getProductReviews(slug)]);
  if (!product) notFound();
  // Related cards only need card fields; dropping the long page content keeps the page payload small.
  const related = all.filter(item => item.id !== product.id).sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category)).slice(0, 4)
    .map(item => ({ ...item, description: '', descriptionAr: '', features: [], specifications: [], warranty: '', materials: '', storyImages: [], details: cleanDetails({}) }));
  const settings = await getSettings();
  const base = (settings.canonicalBaseUrl || '').replace(/\/$/, '');
  const inStock = product.colors.some(c => c.stock > 0);
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Product', name: product.nameAr || product.name, description: product.descriptionAr || product.description || product.subtitle, image: product.colors.flatMap(c => c.images).slice(0, 6).map(i => i.startsWith('http') ? i : `${base}${i}`), brand: { '@type': 'Brand', name: settings.storeName || 'UR' }, sku: product.id, offers: { '@type': 'Offer', priceCurrency: 'IQD', price: product.salePriceIqd, availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: base ? `${base}/products/${product.id}` : undefined }, ...(reviews.count ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: reviews.average, reviewCount: reviews.count }, review: reviews.reviews.slice(0, 5).map(r => ({ '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: r.rating }, author: { '@type': 'Person', name: r.name }, reviewBody: r.body, datePublished: r.createdAt.slice(0, 10) })) } : {}) };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} /><ProductDetail key={`${slug}-${color ?? ''}`} product={product} related={related} initialColor={color} initialSize={size} banner={banner} bundles={allBundles.filter(b => b.parts.some(p => p.productId === product.id))} reviews={reviews} /></>;
}
