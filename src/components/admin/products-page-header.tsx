'use client';
import Link from 'next/link';
import { Boxes, Eye, ImageOff, Layers, Package, PackageX, Plus } from 'lucide-react';
import { Kpi } from './dash-ui';
import { useLanguage } from '@/components/language-provider';
import { productT } from '@/lib/i18n';

export type ProductStats = { products: number; published: number; colors: number; soldOut: number; low: number; noPhotos: number; units: number; lowThreshold: number };
export function ProductsPageHeader({ stats }: { stats?: ProductStats }) {
  const { language } = useLanguage();
  const tr = (label: keyof typeof import('@/lib/i18n').productTranslations) => productT(label, language);
  const lang = language === 'ar' ? 'ar' : 'en'; const tt = (en: string, ar: string) => lang === 'ar' ? ar : en;
  return <><div className="admin-page-heading"><div><span className="admin-eyebrow">{tr('Catalog')}</span><h1>{tr('Products')}</h1><p>{tr('Every color has its own stock, photo set and hero image. Click a product to manage its variants.')}</p></div><Link href="/admin/products/new" className="admin-btn admin-btn-primary"><Plus size={16} /> {tr('New product')}</Link></div>
  {stats && <section className="dash-kpis">
    <Kpi lang={lang} icon={<Package size={17} />} tone="accent" label={tt('Products', 'المنتجات')} value={stats.products} note={tt(`${stats.published} live`, `${stats.published} منشور`)} />
    <Kpi lang={lang} delay={50} icon={<Layers size={17} />} tone="blue" label={tt('Colours', 'الألوان')} value={stats.colors} />
    <Kpi lang={lang} delay={100} icon={<Boxes size={17} />} tone="success" label={tt('Units available', 'قطع متاحة')} value={stats.units} />
    <Kpi lang={lang} delay={150} icon={<PackageX size={17} />} tone="danger" label={tt('Sold out colours', 'ألوان نافدة')} value={stats.soldOut} href="/admin/inventory" />
    <Kpi lang={lang} delay={200} icon={<Eye size={17} />} tone="gold" label={tt('Low stock colours', 'ألوان منخفضة')} value={stats.low} note={`≤ ${stats.lowThreshold}`} href="/admin/inventory" />
    <Kpi lang={lang} delay={250} icon={<ImageOff size={17} />} tone="violet" label={tt('Colours without photos', 'ألوان بدون صور')} value={stats.noPhotos} />
  </section>}</>;
}
