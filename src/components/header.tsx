'use client';
import Link from 'next/link';
import { mediaSrc } from '@/lib/types';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Globe2, Mail, MapPin, Menu, Search, ShoppingCart, X } from 'lucide-react';
import type { Product } from '@/lib/types';
import { categories } from '@/lib/catalog';
import { useStore } from './store-provider';
import { useLanguage } from './language-provider';
import { storeT } from '@/lib/i18n';
import { Modal, ModalHeading } from './modal';
import { ProductCard } from './product-card';
import { CartDrawer } from './cart-drawer';
import { Newsletter } from './footer';


const navArabicLabels: Record<string, string> = {
  Featured: 'مختارات', Bestsellers: 'الأكثر مبيعاً', 'New releases': 'وصل حديثاً', 'Students & graduates': 'الطلاب والخريجون', 'The Outlet': 'العروض', 'Value sets': 'المجموعات الاقتصادية',
  'Bags & Luggage': 'الحقائب والأمتعة', Backpacks: 'حقائب الظهر', 'Crossbody bags': 'حقائب الكروس بودي', 'Tote bags': 'حقائب اليد', 'Work bags': 'حقائب العمل', Luggage: 'أمتعة السفر',
  Travel: 'السفر', 'Travel backpacks': 'حقائب ظهر للسفر', 'Travel slings': 'حقائب كتف للسفر', 'RFID & travel wallets': 'محافظ RFID والسفر', 'Packing cubes & pouches': 'منظمات وحقائب السفر',
  Wallets: 'المحافظ', 'All wallets': 'جميع المحافظ', Billfolds: 'محافظ تقليدية', 'Slim wallets': 'محافظ نحيفة', 'RFID protected': 'محافظ محمية بتقنية RFID',
  'Phone Cases & Tech': 'أغطية الهواتف والتقنيات', 'Phone cases': 'أغطية الهواتف', 'Tech organizers': 'منظمات التقنية', 'Laptop & tablet bags': 'حقائب اللابتوب والتابلت', 'All tech': 'كل منتجات التقنية',
  Accessories: 'الإكسسوارات', 'Pouches & organizers': 'الحقائب والمنظمات', 'Tech Kit': 'حقيبة التقنية', 'Travel accessories': 'إكسسوارات السفر', 'All accessories': 'كل الإكسسوارات',
  'About Us': 'من نحن', 'Our story': 'قصتنا', 'Our materials': 'خاماتنا', 'Responsible business': 'أعمال مسؤولة', 'The journal': 'المجلة', 'Shipping & delivery': 'الشحن والتوصيل'
};

const defaultNavGroups = [
  { name: 'Featured', nameAr: 'مختارات', href: '/collection/bestsellers', links: [{ label: 'Bestsellers', href: '/collection/bestsellers' }, { label: 'New releases', href: '/collection/new-releases' }, { label: 'Students & graduates', href: '/collection/campus' }, { label: 'The Outlet', href: '/collection/outlet' }, { label: 'Value sets', href: '/collection/value-sets' }], image: 'highlight-laneway.jpg', caption: 'Good design. Great company.' },
  { name: 'Bags & Luggage', nameAr: 'الحقائب والأمتعة', href: '/products/category/bags', links: categories.filter(c => ['backpacks', 'crossbody-bags', 'tote-bags', 'work-bags', 'luggage'].includes(c.id)).map(c => ({ label: c.name, href: `/products/category/${c.id}` })), image: 'hero-backpacks.jpg', caption: 'We’ve got your back.' },
  { name: 'Travel', nameAr: 'السفر', href: '/collection/travel', links: [{ label: 'Luggage', href: '/products/category/luggage' }, { label: 'Travel backpacks', href: '/products/category/backpacks' }, { label: 'Travel slings', href: '/products/category/crossbody-bags' }, { label: 'RFID & travel wallets', href: '/products/category/wallets' }, { label: 'Packing cubes & pouches', href: '/products/category/accessories' }], image: 'highlight-travel.jpg', caption: 'A world of possibility.' },
  { name: 'Wallets', nameAr: 'المحافظ', href: '/products/category/wallets', links: [{ label: 'All wallets', href: '/products/category/wallets' }, { label: 'Billfolds', href: '/products/hide-and-seek' }, { label: 'Slim wallets', href: '/products/note-sleeve' }, { label: 'RFID protected', href: '/products/category/wallets' }], image: 'hide-and-seek.jpg', caption: 'Less bulk. More possibility.' },
  { name: 'Phone Cases & Tech', nameAr: 'أغطية الهواتف والتقنيات', href: '/collection/for-tech-lovers', links: [{ label: 'Phone cases', href: '/products/category/phone-cases' }, { label: 'Tech organizers', href: '/products/tech-kit' }, { label: 'Laptop & tablet bags', href: '/collection/work' }, { label: 'All tech', href: '/collection/tech' }], image: 'highlight-phone.jpg', caption: 'For all the ways you move.' },
  { name: 'Accessories', nameAr: 'الإكسسوارات', href: '/products/category/accessories', links: [{ label: 'Pouches & organizers', href: '/products/category/accessories' }, { label: 'Tech Kit', href: '/products/tech-kit' }, { label: 'Travel accessories', href: '/collection/travel' }, { label: 'All accessories', href: '/products/category/accessories' }], image: 'highlight-pouches.jpg', caption: 'Little things. Big difference.' },
  { name: 'About Us', nameAr: 'من نحن', href: '/info/our-story', links: [{ label: 'Our story', href: '/info/our-story' }, { label: 'Our materials', href: '/info/our-materials' }, { label: 'Responsible business', href: '/info/responsible-business' }, { label: 'The journal', href: '/info/journal' }, { label: 'Shipping & delivery', href: '/info/shipping' }], image: 'intent-outdoor.jpg', caption: 'Designed for a better world.' },
];
function SearchPanel({ onClose, suggestions }: { onClose: () => void; suggestions: { label: string; href: string }[] }) {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState<{ query: string; products: Product[] } | null>(null);
  const [featured, setFeatured] = useState<Product[]>([]);
  const { settings } = useStore();
  const router = useRouter();
  const { language } = useLanguage();
  const t = (label: string) => storeT(label, language);
  useEffect(() => { fetch('/api/products?collection=bestsellers').then(r => r.json()).then(data => setFeatured(data.products.slice(0, 4))).catch(() => {}); }, []);
  const trimmed = query.trim();
  useEffect(() => {
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try { const response = await fetch(`/api/products?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal }); const data = await response.json(); setSearched({ query: trimmed, products: data.products }); }
      catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) setSearched({ query: trimmed, products: [] }); }
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [trimmed]);
  // With an empty box the panel shows favourites; otherwise the results for the current text.
  const loading = !!trimmed && searched?.query !== trimmed;
  const results = !trimmed ? featured : searched?.query === trimmed ? searched.products : [];
  return <Modal title={language === 'ar' ? 'البحث في المتجر' : `Search ${settings.storeName}`} className="search-overlay" onClose={onClose}>
    <div className="search-top"><form onSubmit={event => { event.preventDefault(); router.push(`/search?q=${encodeURIComponent(query.trim())}`); onClose(); }}><Search size={25} strokeWidth={1.4} /><input data-autofocus aria-label={t('Search products')} placeholder={t('What are you looking for?')} value={query} onChange={event => setQuery(event.target.value)} /><button type="submit" className="icon-button" aria-label={language === 'ar' ? 'عرض كل نتائج البحث' : 'Show all search results'}>{language === 'ar' ? <ArrowLeft size={22} /> : <ArrowRight size={22} />}</button></form><button className="icon-button" onClick={onClose} aria-label={t('Close search')}><X size={24} strokeWidth={1.5} /></button></div>
    <div className="search-body"><div className="search-label">{loading ? (language === 'ar' ? 'جارٍ البحث…' : 'Finding your next companion…') : query ? (language === 'ar' ? `${results.length} نتيجة لـ “${query}”` : `${results.length} result${results.length === 1 ? '' : 's'} for “${query}”`) : (language === 'ar' ? 'بعض الاختيارات المفضلة' : 'A few crowd favorites')}</div>
      {!query && suggestions.length > 0 && <div className="search-suggestions">{suggestions.map(item => <button key={item.href} onClick={() => { router.push(item.href); onClose(); }}>{item.label}{language === 'ar' ? <ArrowLeft size={13} /> : <ArrowRight size={13} />}</button>)}</div>}
      {results.length ? <div className="search-products" onClick={event => { if ((event.target as HTMLElement).closest('a')) onClose(); }}>{results.slice(0, 4).map(product => <ProductCard key={product.id} product={product} compact />)}</div> : !loading && <div className="search-empty"><Search size={32} strokeWidth={1} /><h3>{language === 'ar' ? 'لم نجد نتائج بعد.' : 'No matches just yet.'}</h3><p>{language === 'ar' ? 'جرّب كلمة أخرى مثل حقيبة أو محفظة أو تقنيات.' : 'Try a different word, like “backpack”, “wallet” or “tech”.'}</p><Link href="/products/category/all" className="text-link" onClick={onClose}>{language === 'ar' ? 'استعرض كل المنتجات' : 'Explore all products'} <ArrowRight size={16} /></Link></div>}
      {query && results.length > 0 && <Link className="button button-outline search-all" href={`/search?q=${encodeURIComponent(query)}`} onClick={onClose}>{language === 'ar' ? 'عرض كل النتائج' : 'See all results'} <ArrowRight size={16} /></Link>}
    </div>
  </Modal>;
}
export function Header() {
  const { count, setCartOpen, region, setRegion, regions, settings } = useStore();
  const { language, setLanguage } = useLanguage();
  const t = (label: string) => storeT(label, language);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const [newsletterOpen, setNewsletterOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(region.name);
  const pathname = usePathname();
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) { setMenuPath(pathname); setActiveMenu(null); setMobileMenu(false); setSearchOpen(false); }
  const navGroups = settings.navigation?.length ? settings.navigation : defaultNavGroups;
  const localizedNavGroups = navGroups.map(nav => ({ ...nav, displayName: language === 'ar' ? (nav.nameAr || navArabicLabels[nav.name] || storeT(nav.name, language)) : nav.name, displayCaption: language === 'ar' ? (('captionAr' in nav ? nav.captionAr : undefined) || ({ 'Good design. Great company.': 'تصميم متقن. جودة تدوم.', 'We’ve got your back.': 'رفيقك في كل رحلة.', 'A world of possibility.': 'افتح آفاقاً جديدة.', 'Less bulk. More possibility.': 'أقل حجماً. أكثر حرية.', 'For all the ways you move.': 'لكل خطوة تخطوها.', 'Little things. Big difference.': 'تفاصيل صغيرة، تصنع فرقاً كبيراً.', 'Designed for a better world.': 'صناعة واعية لمستقبل أفضل.' } as Record<string,string>)[nav.caption] || storeT(nav.caption, language)) : nav.caption, links: nav.links.map(link => ({ ...link, displayLabel: language === 'ar' ? (('labelAr' in link ? link.labelAr : undefined) || navArabicLabels[link.label] || storeT(link.label, language)) : link.label })) }));
  const group = localizedNavGroups.find(nav => nav.displayName === activeMenu);
  const flags: Record<string, string> = { Iraq: '🇮🇶', 'United States': '🇺🇸' };
  return <>
    <header className="site-header" onMouseLeave={() => setActiveMenu(null)}>
      <div className="utility-bar"><Link href={settings.announcementHref || "/info/shipping"} className="shipping-link">{language === 'ar' && settings.announcement === 'Free delivery across Iraq on orders over 150,000 IQD · Cash on delivery' ? 'توصيل مجاني داخل العراق للطلبات التي تتجاوز 150,000 د.ع · الدفع عند الاستلام' : settings.announcement}</Link><div className="utility-right"><button aria-label={t('Choose your region')} title={`${region.name} · ${region.currency}`} onClick={() => { setSelectedRegion(region.name); setRegionOpen(true); }}><span>{flags[region.name]}</span><ChevronDown size={9} /></button><span className="utility-divider">|</span><button className="language-switch" type="button" aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'} onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}>{language === 'ar' ? 'EN' : 'العربية'}</button><span className="utility-divider">|</span><Link href="/info/contact">{t('Need help?')}</Link></div></div>
      <div className="main-navigation"><div className="navigation-left"><button className="icon-button mobile-menu-button" aria-label={t('Open menu')} onClick={() => setMobileMenu(true)}><Menu size={24} strokeWidth={1.3} /></button></div>
        <Link href="/" className="brand-logo" aria-label={`${settings.storeName} home`}><img src={settings.logoUrl ? mediaSrc(settings.logoUrl, 320) : "/images/UR-logo.svg"} alt={settings.logoAlt || settings.storeName} width="110" height="65" /></Link>
        <nav className="desktop-navigation" aria-label={language === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}>{localizedNavGroups.map(nav => <Link key={nav.displayName} href={nav.href} className={activeMenu === nav.displayName ? 'nav-active' : ''} aria-expanded={activeMenu === nav.displayName} onMouseEnter={() => setActiveMenu(nav.displayName)} onFocus={() => setActiveMenu(nav.displayName)}>{nav.displayName}<ChevronDown size={10} strokeWidth={1.3} /></Link>)}</nav>
        <Link className="nav-stockists" href="/info/stores">{t('Stores & stockists')}</Link><div className="navigation-actions"><button className="icon-button search-trigger" aria-label={t('Search products')} title={t('Search products')} onMouseEnter={() => setActiveMenu(null)} onClick={() => setSearchOpen(true)}><Search size={25} strokeWidth={1.35} /></button><button className="icon-button newsletter-trigger desktop-newsletter-trigger" aria-label={t('Sign up for new releases')} onMouseEnter={() => setActiveMenu(null)} onClick={() => setNewsletterOpen(true)}><Mail size={25} strokeWidth={1.4} /><i /></button><button className="icon-button bag-trigger" aria-label={`Open shopping bag, ${count} items`} onMouseEnter={() => setActiveMenu(null)} onClick={() => setCartOpen(true)}><ShoppingCart size={25} strokeWidth={1.5} />{count > 0 && <span className="bag-count">{count}</span>}</button></div>
      </div>
      
      {group && <div className="mega-menu" onKeyDown={event => { if (event.key === 'Escape') setActiveMenu(null); }}><div className="mega-inner"><div className="mega-links"><span className="eyebrow">{language === 'ar' ? 'استكشف' : 'Explore'} {group.displayName}</span>{group.links.map(link => <Link key={link.displayLabel} href={link.href} onClick={() => setActiveMenu(null)}>{link.displayLabel}<ArrowRight size={14} /></Link>)}<Link className="mega-shop-all" href={group.href} onClick={() => setActiveMenu(null)}>{t('Explore all')} <ArrowRight size={15} /></Link></div><div className="mega-links mega-activities"><p>{language === 'ar' ? <>جلد طبيعي.<br />صناعة يدوية عراقية.</> : <>Natural leather.<br />Handmade in Iraq.</>}</p></div><Link href={group.href} className="mega-feature" onClick={() => setActiveMenu(null)}>{group.image && <img src={group.image.startsWith('/') || group.image.startsWith('http') ? mediaSrc(group.image, 640) : `/images/${group.image}`} alt={group.displayCaption} />}<span>{group.displayCaption}<ArrowRight size={21} /></span></Link><Link href="/collection/new-releases" className="mega-feature secondary-feature" onClick={() => setActiveMenu(null)}><img src="/images/highlight-laneway.jpg" alt="New carry essentials" /><span>{language === 'ar' ? 'أشياء جديدة ستحبها' : 'New things to love'}<ArrowRight size={21} /></span></Link></div></div>}
    </header>
    {group && <div className="menu-backdrop" onMouseEnter={() => setActiveMenu(null)} onClick={() => setActiveMenu(null)} />}
    {mobileMenu && <Modal title={(language === 'ar' ? 'تصفّح المتجر' : `Explore ${settings.storeName}`)} className="drawer-overlay mobile-navigation-overlay" onClose={() => setMobileMenu(false)}><ModalHeading title={(language === 'ar' ? 'تصفّح المتجر' : `Explore ${settings.storeName}`)} onClose={() => setMobileMenu(false)} /><nav className="mobile-navigation" aria-label={language === 'ar' ? 'التنقل في المتجر' : 'Mobile navigation'}>{localizedNavGroups.map(nav => <div className="mobile-nav-group" key={nav.displayName}><button onClick={() => setMobileSection(mobileSection === nav.displayName ? null : nav.displayName)} aria-expanded={mobileSection === nav.displayName}>{nav.displayName}<ChevronDown size={18} className={mobileSection === nav.displayName ? 'rotated' : ''} /></button>{mobileSection === nav.displayName && <div>{nav.links.map(link => <Link key={link.displayLabel} href={link.href} onClick={() => setMobileMenu(false)}>{link.displayLabel}</Link>)}<Link className="mobile-shop-all" href={nav.href} onClick={() => setMobileMenu(false)}>{t('Explore all')} <ArrowRight size={14} /></Link></div>}</div>)}<div className="mobile-navigation-bottom"><Link href="/info/contact" onClick={() => setMobileMenu(false)}>{language === 'ar' ? 'هل تحتاج مساعدة؟' : 'Need a hand?'} <ChevronRight size={16} /></Link><Link href="/info/stores" onClick={() => setMobileMenu(false)}>{t('Stores & stockists')} <MapPin size={16} /></Link><button className="text-link" onClick={() => { setMobileMenu(false); setSelectedRegion(region.name); setRegionOpen(true); }}><Globe2 size={15} /> {region.name} · {region.currency}</button><span>{language === 'ar' ? 'مصمم بعناية. مناسب لكل مكان.' : 'Designed in Australia. Carried everywhere.'}</span></div></nav></Modal>}
    {searchOpen && <SearchPanel onClose={() => setSearchOpen(false)} suggestions={localizedNavGroups.filter(nav => nav.href.startsWith('/products/category/') || nav.href.startsWith('/collection/')).map(nav => ({ label: nav.displayName, href: nav.href }))} />}
    {newsletterOpen && <Modal title={t('New releases and subscriber exclusives')} className="newsletter-overlay" onClose={() => setNewsletterOpen(false)}><ModalHeading title={t('A little good in your inbox.')} onClose={() => setNewsletterOpen(false)} /><Newsletter id="popup-newsletter-email" /></Modal>}
    {regionOpen && <Modal title={t('Choose your region')} className="region-overlay" onClose={() => setRegionOpen(false)}><ModalHeading title={language === 'ar' ? 'من أين تتصفح؟' : 'Where are you exploring from?'} onClose={() => setRegionOpen(false)} /><div className="region-content"><Globe2 size={40} strokeWidth={1} /><p>{language === 'ar' ? 'اختر طريقة عرض الأسعار. التوصيل متاح إلى جميع محافظات العراق.' : 'Choose how prices are displayed. Delivery is available across all governorates of Iraq.'}</p><label htmlFor="region">{t('Country / region')}</label><select id="region" value={selectedRegion} onChange={event => setSelectedRegion(event.target.value)}>{regions.map(item => <option key={item.name} value={item.name}>{item.name} ({item.currency})</option>)}</select><button className="button button-orange button-full" onClick={() => { setRegion(regions.find(item => item.name === selectedRegion) || regions[0]); setRegionOpen(false); }}>{t('Save preferences')} <ArrowRight size={16} /></button><small>{language === 'ar' ? 'نوصل إلى جميع محافظات العراق. الطلبات تُحسب بالدينار العراقي، والدولار يظهر كمرجع فقط.' : 'We deliver within Iraq only. Orders are placed in Iraqi dinars (IQD); USD is shown for reference.'}</small></div></Modal>}
    <CartDrawer />
  </>;
}
