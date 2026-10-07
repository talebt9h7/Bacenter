'use client';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { productT } from '@/lib/i18n';

export function ProductsPageHeader() {
  const { language } = useLanguage();
  const tr = (label: keyof typeof import('@/lib/i18n').productTranslations) => productT(label, language);
  return <div className="admin-page-heading"><div><span className="admin-eyebrow">{tr('Catalog')}</span><h1>{tr('Products')}</h1><p>{tr('Every color has its own stock, photo set and hero image. Click a product to manage its variants.')}</p></div><Link href="/admin/products/new" className="admin-btn admin-btn-primary"><Plus size={16} /> {tr('New product')}</Link></div>;
}
