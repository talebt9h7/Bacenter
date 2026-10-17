import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStoreBundles } from '@/lib/bundles';
import { getProductById } from '@/lib/products';
import { getSettings } from '@/lib/settings';
import { BundleDetail, type BundlePartProduct } from '@/components/bundle-detail';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
async function find(slug: string) {
  const all = await getStoreBundles();
  const wanted = decodeURIComponent(slug);
  return { bundle: all.find(b => b.slug === wanted) ?? null, all };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bundle } = await find((await params).slug);
  if (!bundle) return { title: 'Bundle', robots: { index: false } };
  const title = bundle.nameAr || bundle.name;
  const image = bundle.image ?? bundle.parts[0]?.image ?? undefined;
  return { title, description: bundle.descriptionAr || bundle.description || bundle.parts.map(p => p.nameAr || p.name).join(' + '), openGraph: { title, images: image ? [image] : undefined } };
}
/** One page for a bundle: every item in it with its photos and details, one price, one button. */
export default async function BundlePage({ params }: Props) {
  const { bundle, all } = await find((await params).slug);
  if (!bundle) notFound();
  const products = await Promise.all([...new Set(bundle.parts.map(p => p.productId))].map(id => getProductById(id)));
  const byId = new Map(products.filter(Boolean).map(p => [p!.id, p!]));
  const parts: BundlePartProduct[] = bundle.parts.map(part => {
    const product = byId.get(part.productId);
    return { ...part, subtitle: product?.subtitle ?? '', subtitleAr: product?.subtitleAr ?? '', description: product?.description ?? '', descriptionAr: product?.descriptionAr ?? '', features: product?.details ? product.details.features : [], featuresAr: product?.details ? product.details.featuresAr : [] };
  });
  const settings = await getSettings();
  const base = (settings.canonicalBaseUrl || '').replace(/\/$/, '');
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Product', name: bundle.nameAr || bundle.name, description: bundle.descriptionAr || bundle.description || undefined, image: parts.flatMap(p => p.images).slice(0, 6).map(i => i.startsWith('http') ? i : `${base}${i}`), brand: { '@type': 'Brand', name: settings.storeName || 'UR' }, offers: { '@type': 'Offer', priceCurrency: 'IQD', price: bundle.priceIqd, availability: bundle.available > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} /><BundleDetail bundle={bundle} parts={parts} others={all.filter(b => b.id !== bundle.id).slice(0, 3)} /></>;
}
