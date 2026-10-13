import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/product-detail';
import { getAllProducts, getProductById } from '@/lib/products';
import { getSettings } from '@/lib/settings';
import { cleanDetails } from '@/lib/product-details';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ color?: string }> };
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
  const { slug } = await params; const { color } = await searchParams;
  // Both reads come from the shared catalog cache, so they cost no extra database trips.
  const [product, all] = await Promise.all([getProductById(slug), getAllProducts()]);
  if (!product) notFound();
  // Related cards only need card fields; dropping the long page content keeps the page payload small.
  const related = all.filter(item => item.id !== product.id).sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category)).slice(0, 4)
    .map(item => ({ ...item, description: '', descriptionAr: '', features: [], specifications: [], warranty: '', materials: '', storyImages: [], details: cleanDetails({}) }));
  return <ProductDetail key={`${slug}-${color ?? ''}`} product={product} related={related} initialColor={color} />;
}
