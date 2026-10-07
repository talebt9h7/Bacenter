import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/product-detail';
import { getAllProducts, getProductById } from '@/lib/products';
import { getSettings } from '@/lib/settings';

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
  const product = await getProductById(slug);
  if (!product) notFound();
  const all = await getAllProducts();
  const related = all.filter(item => item.id !== product.id).sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category)).slice(0, 4);
  return <ProductDetail key={`${slug}-${color ?? ''}`} product={product} related={related} initialColor={color} />;
}
