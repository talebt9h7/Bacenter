'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { mediaSrc, type Product } from '@/lib/types';
import { ProductCard } from './product-card';
import { OwlMark } from './footer';
import { BrandStory } from './responsible-section';
import { useStore } from './store-provider';
import { useLanguage } from './language-provider';
import { storeT } from '@/lib/i18n';
import { VideoStories } from './video-stories';
import { BundlesSection } from './bundle-card';
import type { BundleView } from '@/lib/bundles';
import type { HomepageConfig } from '@/lib/settings';
import type { Category } from '@/lib/categories';

// With no hero slides or highlight cards in the admin, the homepage shows the UR brand panel instead.
const defaultSlides: { key: string; image: string; mobileImage: string; lines: string[]; cta: string; href: string; alt: string }[] = [];
const defaultHighlights: { key: string; image: string; title: string; href: string; badge?: string | null }[] = [];
export type Banner = { id: number; title: string; titleAr: string | null; subtitle: string | null; subtitleAr: string | null; ctaLabel: string | null; ctaLabelAr: string | null; href: string; image: string; mobileImage: string | null; badge: string | null; badgeAr: string | null };
export function Homepage({ products, heroBanners, highlightBanners, homepage, categories: catalogCategories, bundles = [] }: { products: Product[]; heroBanners: Banner[]; highlightBanners: Banner[]; homepage: HomepageConfig; categories: Category[]; bundles?: BundleView[] }) {
  const { settings } = useStore();
  const { language } = useLanguage();
  const t = (label: string) => storeT(label, language);
  const bannerArabic: Record<string, { title: string; cta?: string }> = {};
  const slides = heroBanners.length ? heroBanners.map(banner => { const arBanner = bannerArabic[banner.title]; const title = language === 'ar' ? (banner.titleAr || arBanner?.title || banner.title) : banner.title; return { key: String(banner.id), image: banner.image, mobileImage: banner.mobileImage || banner.image, lines: title.split('\n').filter(Boolean), cta: language === 'ar' ? (banner.ctaLabelAr || arBanner?.cta || banner.ctaLabel || t('Shop now')) : (banner.ctaLabel || t('Shop now')), href: banner.href, alt: language === 'ar' ? (banner.subtitleAr || banner.subtitle || title) : (banner.subtitle || banner.title) }; }) : defaultSlides.map(item => ({ ...item, lines: language === 'ar' ? (bannerArabic[item.lines.join('\n')]?.title?.split('\n') || item.lines) : item.lines, cta: t(item.cta) }));
  const highlightArabic: Record<string, string> = {};
  const highlights = highlightBanners.length ? highlightBanners.map(banner => ({ key: String(banner.id), image: banner.image, title: language === 'ar' ? (banner.titleAr || highlightArabic[banner.title] || banner.title) : banner.title, href: banner.href, badge: language === 'ar' ? (banner.badgeAr || (banner.badge === 'NEW' ? 'جديد' : banner.badge === 'SAVE' ? 'وفر' : banner.badge)) : banner.badge })) : defaultHighlights.map(item => ({ ...item, title: language === 'ar' ? (highlightArabic[item.title] || item.title) : item.title, badge: language === 'ar' ? (item.badge === 'NEW' ? 'جديد' : item.badge === 'SAVE' ? 'وفر' : item.badge) : item.badge }));
  const blockState = new Map(homepage.blocks.map(block => [block.key, block]));
  const enabled = (key: string) => blockState.get(key)?.enabled !== false;
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const productRail = useRef<HTMLDivElement>(null);
  const highlightRail = useRef<HTMLDivElement>(null);
  const collectionRail = useRef<HTMLDivElement>(null);
  const categories = useMemo(() => [...catalogCategories].filter(item => item.active).sort((a, b) => a.sortOrder - b.sortOrder), [catalogCategories]);
  const [chosenCategory, setCategory] = useState('');
  // Falls back to the first active category when the chosen one is not (or no longer) listed.
  const category = categories.some(item => item.id === chosenCategory) ? chosenCategory : (categories[0]?.id ?? '');
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setSlide(value => (value + 1) % slides.length), 11000);
    return () => clearInterval(timer);
  }, [paused, slide, slides.length]);
  function changeSlide(next: number) { setSlide((next + slides.length) % slides.length); }
  const categoryProducts = products.filter(product => product.category === category);
  const copy = homepage.copy;
  const ar = language === 'ar';
  const homepageArabic: Record<string, string> = {
    'Accessories': 'الإكسسوارات',
    'Work bags': 'حقائب العمل',
    'Luggage': 'أمتعة السفر',
    'Phone cases': 'أغطية الهواتف',
    'Crossbody bags': 'حقائب كروس بودي',
    'Backpacks': 'حقائب الظهر',
    'Wallets': 'المحافظ',
  };
  const text = (en: string, arValue?: string) => ar ? (arValue || homepageArabic[en] || en) : en;
  const intents = [...homepage.intents].filter(item => item.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const collections = [...homepage.collections].filter(item => item.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const socialItems = [...homepage.social].filter(item => item.active).sort((a, b) => a.sortOrder - b.sortOrder);

  const trending = products.slice(0, 8);
  return <main>
    {enabled('hero') && <section className="hero" aria-roledescription="carousel" aria-label={language === 'ar' ? 'اكتشف المتجر' : `Discover ${settings.storeName}`} onTouchStart={event => { event.currentTarget.dataset.touchX = String(event.touches[0].clientX); }} onTouchEnd={event => { const start = Number(event.currentTarget.dataset.touchX); const delta = start - event.changedTouches[0].clientX; if (Math.abs(delta) > 50) changeSlide(slide + (delta > 0 ? 1 : -1)); }}>
      {!slides.length && <div className="hero-brand"><div><h1>أور للجلود</h1><p>{language === 'ar' ? 'جلد طبيعي عراقي — إرث سومري بروح معاصرة' : 'Natural Iraqi leather — Sumerian heritage, made for today'}</p><Link href="/products/category/all" className="button button-orange hero-cta">{language === 'ar' ? 'تسوق الآن' : 'Shop now'}<ArrowRight size={17} strokeWidth={1.5} /></Link></div></div>}
      {slides.map((item, index) => <div key={item.key} className={`hero-slide ${slide === index ? 'hero-slide-active' : ''}`} aria-hidden={slide !== index}>
        <picture><source media="(max-width: 600px)" srcSet={mediaSrc(item.mobileImage || item.image, 960)} /><img src={mediaSrc(item.image, 1600)} alt={item.alt} fetchPriority={index === 0 ? 'high' : 'auto'} /></picture>
        <div className="hero-shade" />
        <div className="hero-content"><div className="hero-heading">{index === 0 ? <h1>{item.lines.map(line => <span key={line}>{line}</span>)}</h1> : <h2>{item.lines.map(line => <span key={line}>{line}</span>)}</h2>}<Link href={item.href} tabIndex={slide === index ? 0 : -1} className="button button-orange hero-cta">{item.cta}<ArrowRight size={17} strokeWidth={1.5} /></Link></div></div>
      </div>)}
      {slides.length > 1 && <div className="hero-bottom"><span className="hero-position">0{slide + 1}<i />0{slides.length}</span><div className="hero-dots">{slides.map((item, index) => <button key={item.key} aria-label={`Show slide ${index + 1}: ${item.cta}`} aria-current={slide === index} className={slide === index ? 'active' : ''} onClick={() => changeSlide(index)} />)}</div><div className="hero-controls"><button aria-label={t(paused ? 'Play slideshow' : 'Pause slideshow')} onClick={() => setPaused(!paused)}>{paused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}</button><button aria-label={t('Previous slide')} onClick={() => changeSlide(slide - 1)}><ChevronLeft size={23} strokeWidth={1.2} /></button><button aria-label={t('Next slide')} onClick={() => changeSlide(slide + 1)}><ChevronRight size={23} strokeWidth={1.2} /></button></div></div>}
    </section>}

    {enabled('responsible') && <BrandStory showName={slides.length > 0} />}

    {enabled('highlights') && highlights.length > 0 && <section className="highlights-section" aria-label={t('Explore what’s new')}><div className="highlights-rail" ref={highlightRail}>{highlights.map(item => <Link className="highlight-card" key={item.key} href={item.href}><div className="highlight-image"><img src={mediaSrc(item.image, 480)} alt={item.title} loading="lazy" />{item.badge && <span>{item.badge}</span>}</div><h2>{item.title}<ArrowRight size={14} /></h2></Link>)}</div><button className="rail-edge-button" aria-label={t('More highlights')} onClick={() => highlightRail.current?.scrollBy({ left: 470, behavior: 'smooth' })}><ChevronRight size={21} strokeWidth={1.3} /></button></section>}

    {enabled('trending') && <section className="section trending-section"><div className="section-heading"><div><span className="eyebrow">{text(copy.trendingEyebrow, copy.trendingEyebrowAr)}</span><h2>{text(copy.trendingTitle, copy.trendingTitleAr)}</h2></div><div className="section-heading-actions"><Link href={copy.trendingHref} className="text-link">{text(copy.trendingLink, copy.trendingLinkAr)} <ArrowRight size={17} /></Link><div className="rail-controls"><button aria-label={t('Previous trending products')} onClick={() => productRail.current?.scrollBy({ left: -650, behavior: 'smooth' })}><ArrowLeft size={19} strokeWidth={1.3} /></button><button aria-label={t('Next trending products')} onClick={() => productRail.current?.scrollBy({ left: 650, behavior: 'smooth' })}><ArrowRight size={19} strokeWidth={1.3} /></button></div></div></div><div className="product-rail" ref={productRail}>{trending.map(product => <ProductCard key={product.id} product={product} />)}</div></section>}

    {enabled('bundles') && <BundlesSection bundles={bundles.slice(0, 3)} />}

    {enabled('purpose') && <section className="purpose-section"><div className="intent-grid">{intents.map(item => <Link href={item.href} className="intent-card" key={item.image}><img src={item.image.startsWith('/') || item.image.startsWith('http') ? mediaSrc(item.image, 960) : `/images/${item.image}.jpg`} alt={item.title} loading="lazy" /><div><h3>{text(item.title, item.titleAr)}</h3><p>{text(item.subtitle, item.subtitleAr)}<ArrowRight size={17} /></p></div></Link>)}</div></section>}

    {enabled('categories') && <section className="section category-section"><div className="section-heading"><h2>{text(copy.categoryTitle, copy.categoryTitleAr)}</h2></div><div className="category-tabs" role="tablist" aria-label={t('Shop by category')}>{categories.map(item => <button key={item.id} role="tab" aria-selected={category === item.id} aria-controls="category-products" id={`tab-${item.id}`} className={category === item.id ? 'active' : ''} onClick={() => setCategory(item.id)}>{language === 'ar' ? item.nameAr : item.name}</button>)}</div><div className="category-products" id="category-products" role="tabpanel" aria-labelledby={`tab-${category}`}>{categoryProducts.map(product => <ProductCard key={product.id} product={product} />)}<Link href={`/products/category/${category}`} className="category-discover"><OwlMark size={38} /><h3>{text(copy.categoryDiscoverTitle, copy.categoryDiscoverTitleAr)}<br />{text(copy.categoryDiscoverLine2, copy.categoryDiscoverLine2Ar)}</h3><span>{text(copy.categoryDiscoverLink, copy.categoryDiscoverLinkAr)} <ArrowRight size={18} /></span></Link></div><div className="section-bottom-link"><Link className="button button-outline" href={`/products/category/${category}`}>{text(copy.categoryLinkPrefix, copy.categoryLinkPrefixAr)} {language === 'ar' ? (categories.find(item => item.id === category)?.nameAr || '') : (categories.find(item => item.id === category)?.name || '')} <ArrowRight size={16} /></Link></div></section>}


    {enabled('collections') && <section className="section collections-section"><div className="section-heading"><h2>{text(copy.collectionsTitle, copy.collectionsTitleAr)}</h2><div className="section-heading-actions"><Link className="text-link" href={copy.collectionsHref}>{text(copy.collectionsLink, copy.collectionsLinkAr)} <ArrowRight size={17} /></Link><div className="rail-controls"><button aria-label={t('Previous collections')} onClick={() => collectionRail.current?.scrollBy({ left: -450, behavior: 'smooth' })}><ArrowLeft size={19} /></button><button aria-label={t('Next collections')} onClick={() => collectionRail.current?.scrollBy({ left: 450, behavior: 'smooth' })}><ArrowRight size={19} /></button></div></div></div><div className="collections-rail" ref={collectionRail}>{collections.map(item => <Link className="collection-card" key={item.id} href={item.href}><div><img src={mediaSrc(item.image, 640)} alt={language === 'ar' ? `مجموعة ${item.title}` : `The ${item.title} collection`} loading="lazy" /><h3>{language === 'ar' ? (item.titleAr || item.title) : item.title}<ArrowRight size={20} /></h3></div><p>{language === 'ar' ? (item.descriptionAr || item.description) : item.description}</p></Link>)}</div></section>}

    {enabled('videos') && <VideoStories stories={homepage.videoStories} />}
    {enabled('social') && socialItems.length > 0 && <section className="social-section"><div className="section-heading"><div><span className="eyebrow">{text(copy.socialEyebrow, copy.socialEyebrowAr)}</span><h2>{text(copy.socialTitle, copy.socialTitleAr)}</h2></div><a className="text-link" href={settings.instagram} target="_blank" rel="noreferrer">{copy.socialHandle} <ArrowRight size={17} /></a></div><div className="social-grid">{socialItems.map((item, index) => <a href={item.href} key={`${item.image}-${index}`} target="_blank" rel="noreferrer" aria-label={item.caption || `${t('Community photo')} ${index + 1}`}><img src={mediaSrc(item.image, 480)} alt={text(item.caption, item.captionAr) || `Community photo ${index + 1}`} loading="lazy" /><span>{text(item.caption, item.captionAr) || (language === 'ar' ? 'تابعنا في الرحلة' : 'Come along for the ride')} <ArrowRight size={17} /></span></a>)}</div></section>}
  </main>;
}
