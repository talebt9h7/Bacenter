'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { categories as builtInCategories } from '@/lib/catalog';
import { mediaSrc, type Product } from '@/lib/types';
import { ProductCard } from './product-card';
import { useStore } from './store-provider';
import { useLanguage } from './language-provider';
import { storeT } from '@/lib/i18n';

export type CategoryBanner = { title: string; titleAr?: string; subtitle: string | null; subtitleAr?: string | null; image: string; mobileImage: string | null; ctaLabel: string | null; ctaLabelAr?: string | null; href: string; badge: string | null };
export function CatalogView({ products, title, titleAr, eyebrow, eyebrowAr, description, descriptionAr, category = 'all', searchQuery, categoryBanner, navCategories }: { navCategories?: { id: string; name: string; nameAr: string }[]; products: Product[]; title: string; titleAr?: string; eyebrow?: string; eyebrowAr?: string; description: string; descriptionAr?: string; category?: string; searchQuery?: string; categoryBanner?: CategoryBanner | null }) {
  // Managed in Admin → Categories (active ones, admin order); built-in list only as a fallback.
  const categories = navCategories ?? builtInCategories;
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(400000);
  const [color, setColor] = useState('');
  const [sort, setSort] = useState('featured');
  const { money, moneyIqd } = useStore();
  const { language } = useLanguage();
  const t = (label: string) => storeT(label, language);
  const categoryArabic: Record<string, string> = { all: 'تسوق الكل', backpacks: 'حقائب الظهر', 'crossbody-bags': 'حقائب الكتف والكروس', 'tote-bags': 'حقائب اليد والكتف', wallets: 'المحافظ', 'phone-cases': 'أغطية الهواتف', luggage: 'حقائب السفر', 'work-bags': 'حقائب العمل', accessories: 'إكسسوارات' };
  const displayTitle = language === 'ar' ? (titleAr || title) : title;
  const displayDescription = language === 'ar' ? (descriptionAr || description) : description;
  function reset() { setSelectedCategories([]); setMaxPrice(400000); setColor(''); }
  const filtered = useMemo(() => {
    let result = products.filter(p => p.salePriceIqd <= maxPrice && (!selectedCategories.length || selectedCategories.includes(p.category)) && (!color || p.colors.some(c => c.name === color || c.nameAr === color)));
    if (sort === 'price-asc') result = [...result].sort((a, b) => a.salePriceIqd - b.salePriceIqd);
    if (sort === 'price-desc') result = [...result].sort((a, b) => b.salePriceIqd - a.salePriceIqd);
    if (sort === 'name') result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'newest') result = [...result].sort((a, b) => Number(b.tags.includes('new-releases')) - Number(a.tags.includes('new-releases')));
    return result;
  }, [products, maxPrice, selectedCategories, color, sort]);
  return <main className="catalog-page">
    {categoryBanner && <CategoryHero banner={categoryBanner} ar={language === 'ar'} />}
<nav className="breadcrumbs" aria-label={language === 'ar' ? 'مسار التنقل' : 'Breadcrumb'}><Link href="/">{t('Home')}</Link><ChevronRight size={10} /><span>{searchQuery !== undefined ? t('Search') : displayTitle}</span></nav><div className="catalog-intro"><span className="eyebrow">{searchQuery !== undefined ? (language === 'ar' ? 'اعثر على اختيارك المناسب' : 'Find your next companion') : (language === 'ar' ? (eyebrowAr || eyebrow || 'تصميم مدروس. صُنع لأجلك.') : (eyebrow || 'Thoughtfully designed. Made for you.'))}</span><h1>{displayTitle}</h1><p>{displayDescription}</p></div><nav className="catalog-category-links" aria-label={language === 'ar' ? 'تصنيفات المنتجات' : 'Product categories'}>{categories.map(item => <Link key={item.id} href={`/products/category/${item.id}`} className={category === item.id && searchQuery === undefined ? 'active' : ''}>{language === 'ar' ? (item.nameAr || categoryArabic[item.id] || item.name) : item.name}</Link>)}</nav><div className="catalog-toolbar"><div><button className="filter-toggle" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>{showFilters ? <X size={16} /> : <SlidersHorizontal size={16} />} {showFilters ? t('Hide filters') : t('Filter')}{(selectedCategories.length > 0 || maxPrice < 400000 || color) && <span>•</span>}</button><span className="catalog-count">{filtered.length} {language === 'ar' ? (filtered.length === 1 ? 'منتج' : 'منتجات') : `product${filtered.length !== 1 ? 's' : ''}`}</span></div><div><label className="sort-label" htmlFor="product-sort">{t('Sort by')}</label><select id="product-sort" value={sort} onChange={event => setSort(event.target.value)}><option value="featured">{language === 'ar' ? 'اختياراتنا' : 'Our favorites'}</option><option value="newest">{language === 'ar' ? 'الأحدث' : 'New arrivals'}</option><option value="price-asc">{t('Price: low to high')}</option><option value="price-desc">{t('Price: high to low')}</option><option value="name">{language === 'ar' ? 'الاسم: أ إلى ي' : 'Name: A to Z'}</option></select></div></div><div className={`catalog-layout ${showFilters ? 'with-filters' : ''}`}>
    {showFilters && <aside className="catalog-filters" aria-label={language === 'ar' ? 'فلاتر المنتجات' : 'Product filters'}><div className="filter-heading"><h2>{language === 'ar' ? 'تصفية المنتجات' : 'Refine your carry'}</h2><button onClick={reset}>{language === 'ar' ? 'مسح الكل' : 'Clear all'}</button></div><div className="filter-group"><h3>{language === 'ar' ? 'نوع المنتج' : 'Product type'}</h3>{categories.filter(c => c.id !== 'all' && products.some(p => p.category === c.id)).map(item => <label className="filter-check" key={item.id}><input type="checkbox" checked={selectedCategories.includes(item.id)} onChange={() => setSelectedCategories(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])} />{language === 'ar' ? (item.nameAr || categoryArabic[item.id] || item.name) : item.name}</label>)}</div><div className="filter-group"><h3>{language === 'ar' ? 'الحد الأعلى للسعر' : 'Maximum price'}</h3><input className="price-range" aria-label={language === 'ar' ? 'الحد الأعلى لسعر المنتج' : 'Maximum product price'} type="range" min="25000" max="400000" step="5000" value={maxPrice} onChange={event => setMaxPrice(Number(event.target.value))} /><div className="price-range-values"><span>{moneyIqd(0)}</span><span>{moneyIqd(maxPrice)}</span></div></div><div className="filter-group"><h3>{t('Color')} {color && `— ${color}`}</h3><div className="color-filter">{[{ name: 'Black', hex: '#343934' }, { name: 'Navy', hex: '#334c5f' }, { name: 'Bronze', hex: '#8b815b' }, { name: 'Caramel', hex: '#b8804f' }, { name: 'Saltbush', hex: '#b5b9a9' }].map(item => <button key={item.name} aria-label={`${language === 'ar' ? 'تصفية حسب' : 'Filter'} ${item.name}`} title={item.name} aria-pressed={color === item.name} className={color === item.name ? 'active' : ''} style={{ '--swatch': item.hex } as React.CSSProperties} onClick={() => setColor(color === item.name ? '' : item.name)} />)}</div></div></aside>}
    {filtered.length ? <div className="catalog-grid">{filtered.map(product => <ProductCard key={product.id} product={product} />)}</div> : <div className="catalog-empty"><h2>{language === 'ar' ? 'لنبدأ من جديد؟' : 'A fresh start?'}</h2><p>{searchQuery ? t('No products match your search. Try a broader term or explore the full collection.') : t('No products match those filters. Let’s try something a little different.')}</p>{selectedCategories.length > 0 || maxPrice < 400000 || color ? <button className="button button-outline" onClick={reset}>{language === 'ar' ? 'مسح الفلاتر' : 'Clear filters'} <ArrowRight size={16} /></button> : <Link href="/products/category/all" className="button button-outline">{language === 'ar' ? 'استعرض كل المنتجات' : 'Explore all products'} <ArrowRight size={16} /></Link>}</div>}
    </div><p className="catalog-bottom-note">{language === 'ar' ? 'منتجات مصممة بعناية، ومدعومة بضماننا. نتمنى لك أياماً جميلة معها.' : 'Considered carry, backed by our warranty. Here’s to many good days together.'}</p></main>;
}

/** Category banner from Admin → Categories: full-width image (separate phone image), title, line and button. */
function CategoryHero({ banner, ar }: { banner: CategoryBanner; ar: boolean }) {
  const title = ar ? banner.titleAr || banner.title : banner.title;
  const subtitle = ar ? banner.subtitleAr || banner.subtitle : banner.subtitle;
  const cta = ar ? banner.ctaLabelAr || banner.ctaLabel : banner.ctaLabel;
  const body = <>
    <picture>
      {banner.mobileImage && <source media="(max-width: 700px)" srcSet={mediaSrc(banner.mobileImage, 960)} />}
      <img src={mediaSrc(banner.image, 1920)} alt={title || subtitle || ''} fetchPriority="high" />
    </picture>
    {(title || subtitle || cta || banner.badge) && <div className="cat-hero-copy">
      {banner.badge && <small>{banner.badge}</small>}
      {title && <h2>{title}</h2>}
      {subtitle && <p>{subtitle}</p>}
      {cta && banner.href && <span className="cat-hero-cta">{cta} <ArrowRight size={16} /></span>}
    </div>}
  </>;
  return banner.href ? <Link href={banner.href} className="cat-hero">{body}</Link> : <section className="cat-hero">{body}</section>;
}
