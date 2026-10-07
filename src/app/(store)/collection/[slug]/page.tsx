import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CatalogView } from '@/components/catalog-view';
import { collectionNames, collectionNamesAr } from '@/lib/catalog';
import { getProductsFor, getAllProducts } from '@/lib/products';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const settings = await getSettings();
  const managed = settings.homepage.collections.find(item => item.slug === slug);
  const title = managed?.title || collectionNames[slug] || 'Collections';
  const titleAr = managed?.titleAr || collectionNamesAr[slug] || 'المجموعات';
  const description = managed?.description || undefined;
  const base = settings.canonicalBaseUrl?.replace(/\/$/, '');
  const url = base ? `${base}/collection/${encodeURIComponent(slug)}` : undefined;
  return { title, description, alternates: url ? { canonical: url } : undefined, openGraph: { title, description, url, images: managed?.image ? [managed.image] : settings.ogImage ? [settings.ogImage] : undefined } };
}
export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const settings = await getSettings();
  const managed = settings.homepage.collections.find(item => item.slug === slug);
  if (managed && managed.active === false) notFound();
  if (!managed && !collectionNames[slug]) notFound();
  const descriptionsAr: Record<string, string> = { bestsellers: 'تصميم جميل يناسب الحياة اليومية. اكتشف المنتجات التي يختارها عملاؤنا مراراً.', 'new-releases': 'أفكار جديدة وتفاصيل مدروسة. اكتشف أحدث منتجات المجموعة.', travel: 'من عطلة نهاية الأسبوع إلى الرحلات الطويلة. خفة وتنظيم أينما اتجهت.', work: 'تنظيم مدروس وحمل مريح. اصطحب المزيد من الإمكانات إلى يوم عملك.', 'for-tech-lovers': 'من أجهزتك اليومية إلى ملحقاتها الصغيرة. امنح تقنيتك طريقة أفضل للتنقل.', outlet: 'اكتشف منتجاتنا المتاحة حالياً مع الأسعار والعروض الظاهرة لكل منتج.', 'value-sets': 'كوّن مجموعة الاستخدام اليومي الخاصة بك واكتشف المنتجات التي تعمل معاً بتناغم.' };
  const descriptions: Record<string, string> = { bestsellers: 'Good design gets around. Meet the carry companions our community reaches for, day after day.', 'new-releases': 'Fresh ideas. Considered details. Meet the newest members of the Bellroy family.', travel: 'From a weekend away to a journey of a lifetime. Less friction, more freedom, wherever you’re headed.', work: 'Thoughtfully organized, effortlessly carried. Bring a little more possibility to your working day.', 'for-tech-lovers': 'From your everyday devices to the little things that keep them going. Give your tech a better way to travel.', outlet: 'Explore considered carry from our current catalog. Available offers and final prices are shown on each product.', 'value-sets': 'Build your own everyday carry setup. Explore companions that work beautifully together.' };
  const products = managed?.productIds?.length ? (await getAllProducts()).filter(product => managed.productIds!.includes(product.id)) : await getProductsFor(undefined, slug === 'for-tech-lovers' ? 'tech' : slug);
  return <CatalogView products={products} title={managed?.title || collectionNames[slug]} titleAr={managed?.titleAr || collectionNamesAr[slug]} description={managed?.description || descriptions[slug] || 'Thoughtfully designed for the things you do and the places you go. Find the collection that feels like you.'} descriptionAr={managed?.descriptionAr || descriptionsAr[slug] || 'تصميم مدروس للأشياء التي تفعلها والأماكن التي تذهب إليها. اختر المجموعة التي تشبهك.'} />;
}
