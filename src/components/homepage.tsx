'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import type { Product } from '@/lib/types';
import { ProductCard } from './product-card';
import { OwlMark } from './footer';
import { useStore } from './store-provider';
import { useLanguage } from './language-provider';
import { storeT } from '@/lib/i18n';
import { VideoStories } from './video-stories';
import type { HomepageConfig } from '@/lib/settings';
import type { Category } from '@/lib/categories';

const defaultSlides = [
  { key: 'tech', image: '/images/hero-tech.jpg', mobileImage: '/images/hero-tech-mobile.jpg', lines: ['For all the ways you move.'], cta: 'Shop tech', href: '/collection/for-tech-lovers', alt: 'Four Bellroy phone cases, crafted for all the ways you move' },
  { key: 'carry', image: '/images/hero-carry.jpg', mobileImage: '/images/hero-carry-mobile.jpg', lines: ['Carry smart.', 'Move free.', 'Go far.'], cta: 'Shop bestsellers', href: '/collection/bestsellers', alt: 'Considered carry essentials out in the world' },
  { key: 'backpacks', image: '/images/hero-backpacks.jpg', mobileImage: '/images/hero-backpacks-mobile.jpg', lines: ['We’ve got', 'your back.'], cta: 'Shop backpacks', href: '/products/category/backpacks', alt: 'Bellroy backpacks designed for every kind of day' },
];
const defaultHighlights: { key: string; image: string; title: string; href: string; badge?: string | null }[] = [
  { key: 'phone', image: '/images/highlight-phone.jpg', title: 'New cases for iPhone 18', href: '/products/category/phone-cases', badge: 'NEW' },
  { key: 'gaming', image: '/images/highlight-gaming.jpg', title: 'Gear for the gamers', href: '/products/classic-messenger' },
  { key: 'pouches', image: '/images/highlight-pouches.jpg', title: 'Packing Cubes, Pouches & Caddies', href: '/products/category/accessories' },
  { key: 'travel', image: '/images/highlight-travel.jpg', title: 'Build your perfect travel setup', href: '/collection/travel' },
  { key: 'laneway', image: '/images/highlight-laneway.jpg', title: 'Two new Laneway hues', href: '/collection/laneway' },
  { key: 'venture', image: '/images/highlight-venture.jpg', title: 'Gear up, go far, with Venture', href: '/collection/venture' },
  { key: 'sets', image: '/images/highlight-sets.jpg', title: 'Save up to 20% with Value Sets', href: '/collection/value-sets', badge: 'SAVE' },
  { key: 'luggage', image: '/images/highlight-luggage.jpg', title: 'Luggage made for the long haul', href: '/products/category/luggage' },
];
export type Banner = { id: number; title: string; titleAr: string | null; subtitle: string | null; subtitleAr: string | null; ctaLabel: string | null; ctaLabelAr: string | null; href: string; image: string; mobileImage: string | null; badge: string | null; badgeAr: string | null };
export function Homepage({ products, heroBanners, highlightBanners, homepage, categories: catalogCategories }: { products: Product[]; heroBanners: Banner[]; highlightBanners: Banner[]; homepage: HomepageConfig; categories: Category[] }) {
  const { settings } = useStore();
  const { language } = useLanguage();
  const t = (label: string) => storeT(label, language);
  const bannerArabic: Record<string, { title: string; cta?: string }> = { 'For all the ways you move.': { title: 'لكل الطرق التي تتحرك بها.', cta: 'تسوق المنتجات التقنية' }, 'Carry smart.\nMove free.\nGo far.': { title: 'احمل بذكاء.\nتحرك بحرية.\nاذهب بعيداً.', cta: 'تسوق الأكثر مبيعاً' }, 'We’ve got\nyour back.': { title: 'نحن نهتم بك.', cta: 'تسوق الحقائب' } };
  const slides = heroBanners.length ? heroBanners.map(banner => { const arBanner = bannerArabic[banner.title]; const title = language === 'ar' ? (banner.titleAr || arBanner?.title || banner.title) : banner.title; return { key: String(banner.id), image: banner.image, mobileImage: banner.mobileImage || banner.image, lines: title.split('\n').filter(Boolean), cta: language === 'ar' ? (banner.ctaLabelAr || arBanner?.cta || banner.ctaLabel || t('Shop now')) : (banner.ctaLabel || t('Shop now')), href: banner.href, alt: language === 'ar' ? (banner.subtitleAr || banner.subtitle || title) : (banner.subtitle || banner.title) }; }) : defaultSlides.map(item => ({ ...item, lines: language === 'ar' ? (bannerArabic[item.lines.join('\n')]?.title?.split('\n') || item.lines) : item.lines, cta: t(item.cta) }));
  const highlightArabic: Record<string, string> = { 'New cases for iPhone 18': 'أغطية جديدة لـ iPhone 18', 'Gear for the gamers': 'معدات لعشاق الألعاب', 'Packing Cubes, Pouches & Caddies': 'مكعبات وأكياس ومنظمات السفر', 'Build your perfect travel setup': 'كوّن تجهيزات السفر المثالية', 'Two new Laneway hues': 'لونان جديدان من Laneway', 'Gear up, go far, with Venture': 'جهّز نفسك وانطلق مع Venture', 'Save up to 20% with Value Sets': 'وفّر حتى 20% مع المجموعات', 'Luggage made for the long haul': 'أمتعة مصممة للرحلات الطويلة' };
  const highlights = highlightBanners.length ? highlightBanners.map(banner => ({ key: String(banner.id), image: banner.image, title: language === 'ar' ? (banner.titleAr || highlightArabic[banner.title] || banner.title) : banner.title, href: banner.href, badge: language === 'ar' ? (banner.badgeAr || (banner.badge === 'NEW' ? 'جديد' : banner.badge === 'SAVE' ? 'وفر' : banner.badge)) : banner.badge })) : defaultHighlights.map(item => ({ ...item, title: language === 'ar' ? (highlightArabic[item.title] || item.title) : item.title, badge: language === 'ar' ? (item.badge === 'NEW' ? 'جديد' : item.badge === 'SAVE' ? 'وفر' : item.badge) : item.badge }));
  const blockState = new Map(homepage.blocks.map(block => [block.key, block]));
  const enabled = (key: string) => blockState.get(key)?.enabled !== false;
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const productRail = useRef<HTMLDivElement>(null);
  const highlightRail = useRef<HTMLDivElement>(null);
  const collectionRail = useRef<HTMLDivElement>(null);
  const categories = useMemo(() => [...catalogCategories].filter(item => item.active).sort((a, b) => a.sortOrder - b.sortOrder), [catalogCategories]);
  const [category, setCategory] = useState('');
  useEffect(() => {
    if (!categories.length) { setCategory(''); return; }
    setCategory(current => categories.some(item => item.id === current) ? current : categories[0].id);
  }, [categories]);
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setSlide(value => (value + 1) % slides.length), 11000);
    return () => clearInterval(timer);
  }, [paused, slide]);
  function changeSlide(next: number) { setSlide((next + slides.length) % slides.length); }
  const categoryProducts = products.filter(product => product.category === category);
  const copy = homepage.copy;
  const ar = language === 'ar';
  const homepageArabic: Record<string, string> = {
    'We’re committed to moving you through the world with confidence.': 'نصمم منتجات تساعدك على التحرك بثقة في كل يوم.',
    'So wherever you are, we’ll gear you up for...': 'أينما كنت، جهّز نفسك بما يناسب رحلتك.',
    'We’re committed to moving you through the world with confidence': 'نصمم منتجات تساعدك على التحرك بثقة في كل يوم.',
    'So wherever you are, we’ll gear you up for': 'أينما كنت، جهّز نفسك بما يناسب رحلتك.',
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

  const preferred = ['lite-travel-pack', 'transit-workpack', 'lite-sling', 'tech-kit', 'hide-and-seek', 'venture-sling', 'transit-carry-on'];
  const trending = [...products].sort((a, b) => { const ia = preferred.indexOf(a.id); const ib = preferred.indexOf(b.id); return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib); }).slice(0, 7);
  return <main>
    {enabled('hero') && <section className="hero" aria-roledescription="carousel" aria-label={t('Discover Bellroy')} onTouchStart={event => { event.currentTarget.dataset.touchX = String(event.touches[0].clientX); }} onTouchEnd={event => { const start = Number(event.currentTarget.dataset.touchX); const delta = start - event.changedTouches[0].clientX; if (Math.abs(delta) > 50) changeSlide(slide + (delta > 0 ? 1 : -1)); }}>
      {slides.map((item, index) => <div key={item.key} className={`hero-slide ${slide === index ? 'hero-slide-active' : ''}`} aria-hidden={slide !== index}>
        <picture><source media="(max-width: 600px)" srcSet={item.mobileImage} /><img src={item.image} alt={item.alt} fetchPriority={index === 0 ? 'high' : 'auto'} /></picture>
        <div className="hero-shade" />
        <div className="hero-content"><div className="hero-heading">{index === 0 ? <h1>{item.lines.map(line => <span key={line}>{line}</span>)}</h1> : <h2>{item.lines.map(line => <span key={line}>{line}</span>)}</h2>}<Link href={item.href} tabIndex={slide === index ? 0 : -1} className="button button-orange hero-cta">{item.cta}<ArrowRight size={17} strokeWidth={1.5} /></Link></div></div>
      </div>)}
      <div className="hero-bottom"><span className="hero-position">0{slide + 1}<i />0{slides.length}</span><div className="hero-dots">{slides.map((item, index) => <button key={item.key} aria-label={`Show slide ${index + 1}: ${item.cta}`} aria-current={slide === index} className={slide === index ? 'active' : ''} onClick={() => changeSlide(index)} />)}</div><div className="hero-controls"><button aria-label={t(paused ? 'Play slideshow' : 'Pause slideshow')} onClick={() => setPaused(!paused)}>{paused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}</button><button aria-label={t('Previous slide')} onClick={() => changeSlide(slide - 1)}><ChevronLeft size={23} strokeWidth={1.2} /></button><button aria-label={t('Next slide')} onClick={() => changeSlide(slide + 1)}><ChevronRight size={23} strokeWidth={1.2} /></button></div></div>
    </section>}

    {enabled('highlights') && <section className="highlights-section" aria-label={t('Explore what’s new')}><div className="highlights-rail" ref={highlightRail}>{highlights.map(item => <Link className="highlight-card" key={item.key} href={item.href}><div className="highlight-image"><img src={item.image} alt={item.title} loading="lazy" />{item.badge && <span>{item.badge}</span>}</div><h2>{item.title}<ArrowRight size={14} /></h2></Link>)}</div><button className="rail-edge-button" aria-label={t('More highlights')} onClick={() => highlightRail.current?.scrollBy({ left: 470, behavior: 'smooth' })}><ChevronRight size={21} strokeWidth={1.3} /></button></section>}

    {enabled('trending') && <section className="section trending-section"><div className="section-heading"><div><span className="eyebrow">{text(copy.trendingEyebrow, copy.trendingEyebrowAr)}</span><h2>{text(copy.trendingTitle, copy.trendingTitleAr)}</h2></div><div className="section-heading-actions"><Link href={copy.trendingHref} className="text-link">{text(copy.trendingLink, copy.trendingLinkAr)} <ArrowRight size={17} /></Link><div className="rail-controls"><button aria-label={t('Previous trending products')} onClick={() => productRail.current?.scrollBy({ left: -650, behavior: 'smooth' })}><ArrowLeft size={19} strokeWidth={1.3} /></button><button aria-label={t('Next trending products')} onClick={() => productRail.current?.scrollBy({ left: 650, behavior: 'smooth' })}><ArrowRight size={19} strokeWidth={1.3} /></button></div></div></div><div className="product-rail" ref={productRail}>{trending.map(product => <ProductCard key={product.id} product={product} />)}</div></section>}

    {enabled('purpose') && <section className="purpose-section"><div className="intent-grid">{intents.map(item => <Link href={item.href} className="intent-card" key={item.image}><img src={item.image.startsWith('/') || item.image.startsWith('http') ? item.image : `/images/${item.image}.jpg`} alt={item.title} loading="lazy" /><div><h3>{text(item.title, item.titleAr)}</h3><p>{text(item.subtitle, item.subtitleAr)}<ArrowRight size={17} /></p></div></Link>)}</div></section>}

    {enabled('categories') && <section className="section category-section"><div className="section-heading"><h2>{text(copy.categoryTitle, copy.categoryTitleAr)}</h2></div><div className="category-tabs" role="tablist" aria-label={t('Shop by category')}>{categories.map(item => <button key={item.id} role="tab" aria-selected={category === item.id} aria-controls="category-products" id={`tab-${item.id}`} className={category === item.id ? 'active' : ''} onClick={() => setCategory(item.id)}>{language === 'ar' ? item.nameAr : item.name}</button>)}</div><div className="category-products" id="category-products" role="tabpanel" aria-labelledby={`tab-${category}`}>{categoryProducts.map(product => <ProductCard key={product.id} product={product} />)}<Link href={`/products/category/${category}`} className="category-discover"><OwlMark size={38} /><h3>{text(copy.categoryDiscoverTitle, copy.categoryDiscoverTitleAr)}<br />{text(copy.categoryDiscoverLine2, copy.categoryDiscoverLine2Ar)}</h3><span>{text(copy.categoryDiscoverLink, copy.categoryDiscoverLinkAr)} <ArrowRight size={18} /></span></Link></div><div className="section-bottom-link"><Link className="button button-outline" href={`/products/category/${category}`}>{text(copy.categoryLinkPrefix, copy.categoryLinkPrefixAr)} {language === 'ar' ? (categories.find(item => item.id === category)?.nameAr || '') : (categories.find(item => item.id === category)?.name || '')} <ArrowRight size={16} /></Link></div></section>}


    {enabled('collections') && <section className="section collections-section"><div className="section-heading"><h2>{text(copy.collectionsTitle, copy.collectionsTitleAr)}</h2><div className="section-heading-actions"><Link className="text-link" href={copy.collectionsHref}>{text(copy.collectionsLink, copy.collectionsLinkAr)} <ArrowRight size={17} /></Link><div className="rail-controls"><button aria-label={t('Previous collections')} onClick={() => collectionRail.current?.scrollBy({ left: -450, behavior: 'smooth' })}><ArrowLeft size={19} /></button><button aria-label={t('Next collections')} onClick={() => collectionRail.current?.scrollBy({ left: 450, behavior: 'smooth' })}><ArrowRight size={19} /></button></div></div></div><div className="collections-rail" ref={collectionRail}>{collections.map(item => <Link className="collection-card" key={item.id} href={item.href}><div><img src={item.image} alt={language === 'ar' ? `مجموعة ${item.title}` : `The Bellroy ${item.title} collection`} loading="lazy" /><h3>{language === 'ar' ? (item.titleAr || item.title) : item.title}<ArrowRight size={20} /></h3></div><p>{language === 'ar' ? (item.descriptionAr || item.description) : item.description}</p></Link>)}</div></section>}

    {enabled('videos') && <VideoStories stories={homepage.videoStories} />}
    {enabled('social') && <section className="social-section"><div className="section-heading"><div><span className="eyebrow">{text(copy.socialEyebrow, copy.socialEyebrowAr)}</span><h2>{text(copy.socialTitle, copy.socialTitleAr)}</h2></div><a className="text-link" href={settings.instagram} target="_blank" rel="noreferrer">{copy.socialHandle} <ArrowRight size={17} /></a></div><div className="social-grid">{socialItems.map((item, index) => <a href={item.href} key={`${item.image}-${index}`} target="_blank" rel="noreferrer" aria-label={item.caption || `${t('Community photo')} ${index + 1}`}><img src={item.image} alt={text(item.caption, item.captionAr) || `Community photo ${index + 1}`} loading="lazy" /><span>{text(item.caption, item.captionAr) || (language === 'ar' ? 'تابعنا في الرحلة' : 'Come along for the ride')} <ArrowRight size={17} /></span></a>)}</div></section>}
  </main>;
}
