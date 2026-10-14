'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Banknote, ChevronLeft, ChevronRight, CreditCard, Layers, LoaderCircle, LockKeyhole, ShieldCheck, ZoomIn } from 'lucide-react';
import { categories } from '@/lib/catalog';
import { hoverImage, mediaSrc, mediaSrcSet, primaryImage, PLACEHOLDER_IMAGE, type Product, type ProductColor } from '@/lib/types';
import { useStore } from './store-provider';
import { useLanguage } from './language-provider';
import { storeT } from '@/lib/i18n';
import { ProductCard } from './product-card';
import { PromoCountdown, usePromoLive } from './promo-price';
import { track } from '@/lib/track';
import { Modal, ModalHeading } from './modal';
import { ProductVideo } from './product-video';
import { BundleCard } from './bundle-card';
import { ProductReviews, RatingLink } from './product-reviews';
import type { ReviewSummary } from '@/lib/reviews';
import type { BundleView } from '@/lib/bundles';
import type { ProductPageBanner } from '@/lib/product-page-banner';
import { formatDimensions, formatWarranty, formatWeight, pick, pickList, type HighlightIcon } from '@/lib/product-details';
import { BadgeCheck, Coins, CreditCard as CardIcon, Droplets, Feather, Gift, Hand, KeyRound, Laptop, Lock, Magnet, Nfc, RulerDimensionLine, Smartphone, Zap } from 'lucide-react';

const HIGHLIGHT_ICON_COMPONENTS: Record<HighlightIcon, typeof CardIcon> = { cards: CardIcon, cash: Banknote, coins: Coins, rfid: Nfc, slim: Feather, size: RulerDimensionLine, leather: Layers, handmade: Hand, magnet: Magnet, lock: Lock, key: KeyRound, phone: Smartphone, laptop: Laptop, water: Droplets, weight: Feather, warranty: BadgeCheck, gift: Gift, quick: Zap };

export function ProductDetail({ product, related, initialColor, banner, bundles = [], reviews }: { product: Product; related: Product[]; initialColor?: string; banner?: ProductPageBanner | null; bundles?: BundleView[]; reviews?: ReviewSummary }) {
  const { language } = useLanguage();
  const displayColorName = (item: ProductColor) => language === 'ar' ? (item.nameAr || item.name) : item.name;
  // ?color= may hold the English or the Arabic colour name (links are built in either language).
  const wanted = initialColor?.trim().toLowerCase();
  const startColor = product.colors.find(item => wanted && (item.name.toLowerCase() === wanted || (item.nameAr || '').toLowerCase() === wanted)) || product.colors.find(item => item.stock > 0) || product.colors[0];
  const [color, setColor] = useState<ProductColor>(startColor);
  const [quantity, setQuantity] = useState(1);
  // Key of the main photo that has finished loading; until then a low-res copy shows behind it.
  const [loadedPhoto, setLoadedPhoto] = useState('');
  const [imageIndex, setImageIndex] = useState(startColor.primaryIndex);
  const [zoom, setZoom] = useState(false);
  const { moneyIqd, money, region, addToCart, busy, settings } = useStore();
  const displayName = language === 'ar' ? (product.nameAr || product.name) : product.name;
  const displaySubtitle = language === 'ar' ? (product.subtitleAr || product.subtitle) : product.subtitle;
  const displayDescription = language === 'ar' ? (product.descriptionAr || product.description) : product.description;
    const t = (label: string) => storeT(label, language);
  const images = color.images.length ? color.images : [PLACEHOLDER_IMAGE];
  const safeIndex = Math.min(imageIndex, images.length - 1);
  // Product-page content from the admin editor, in the shopper's language (falls back to the other language).
  const details = product.details;
  const headline = pick(language, details.headline, details.headlineAr);
  const features = pickList(language, details.features, details.featuresAr);
  const dimensions = formatDimensions(details, language);
  const weight = formatWeight(details, language);
  const specRows = [
    ...(dimensions ? [{ label: language === 'ar' ? 'الأبعاد الخارجية (الطول × العرض × السمك)' : 'External dimensions (L × W × D)', value: dimensions }] : []),
    ...(weight ? [{ label: language === 'ar' ? 'الوزن' : 'Weight', value: weight }] : []),
    ...(product.capacity ? [{ label: language === 'ar' ? 'السعة' : 'Capacity', value: product.capacity }] : []),
    ...details.specs.map(row => ({ label: pick(language, row.label, row.labelAr), value: pick(language, row.value, row.valueAr) })),
  ];
  const warrantyPeriod = formatWarranty(details.warrantyMonths, language);
  const warrantyText = pick(language, details.warranty, details.warrantyAr);
  const materials = pick(language, details.materials, details.materialsAr);
  const story = details.story;
  const categoryName = categories.find(item => item.id === product.category)?.name || 'Products';
  const promoLive = usePromoLive(product.promotion) && !!product.originalPriceIqd;
  useEffect(() => { track.viewItem({ id: product.id, name: product.name, price: product.salePriceIqd, category: product.category }); }, [product.id, product.name, product.salePriceIqd, product.category]);
  const soldOut = color.stock <= 0; const lowStock = color.stock > 0 && color.stock <= 5;
  const maxQuantity = Math.max(1, Math.min(10, color.stock));
  // The gallery position is shared by all colours: on photo 3 of one colour, switching colour
  // shows photo 3 of the other (or its last photo if it has fewer). The URL keeps the colour
  // and the photo as ?color=…#slide-N (zero-based), so a shared link opens on the same view.
  function syncUrl(nextColor: ProductColor, index: number) {
    const url = new URL(window.location.href);
    url.searchParams.set('color', nextColor.name);
    url.hash = `slide-${index}`;
    window.history.replaceState(window.history.state, '', url);
  }
  function showImage(index: number, count = images.length) {
    const next = (index + count) % count;
    setImageIndex(next);
    syncUrl(color, next);
  }
  function chooseColor(item: ProductColor) {
    const next = Math.min(safeIndex, Math.max(item.images.length - 1, 0));
    setColor(item);
    setImageIndex(next);
    setQuantity(current => Math.min(current, Math.max(1, Math.min(10, item.stock))));
    syncUrl(item, next);
  }
  // Open on the photo named in the link (#slide-N). Read after mount because the server never sees the hash.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const match = window.location.hash.match(/^#slide-(\d+)$/);
      if (match) setImageIndex(Math.min(Number(match[1]), Math.max(startColor.images.length - 1, 0)));
    });
    return () => cancelAnimationFrame(frame);
  }, [startColor]);
  // Swipe between photos on touch screens.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(event: React.TouchEvent) { const t0 = event.touches[0]; touchStart.current = { x: t0.clientX, y: t0.clientY }; }
  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStart.current; touchStart.current = null;
    if (!start || images.length < 2) return;
    const t1 = event.changedTouches[0]; const dx = t1.clientX - start.x; const dy = t1.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) showImage(safeIndex + (dx < 0 ? 1 : -1));
  }
  // Same-position photo of every other colour, fetched ahead so switching colour is instant.
  const neighbourImages = product.colors.filter(item => item.id !== color.id && item.images.length).map(item => item.images[Math.min(safeIndex, item.images.length - 1)]);
  return <main className="product-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <div className="product-detail-layout">
      <div className="product-gallery">
        <div className="product-main-image" style={loadedPhoto === `${color.id}-${safeIndex}` ? undefined : { backgroundImage: `url("${mediaSrc(images[safeIndex], 640)}")` }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onKeyDown={event => { if (event.key === 'ArrowRight') showImage(safeIndex + 1); if (event.key === 'ArrowLeft') showImage(safeIndex - 1); }}>
          <img key={`${color.id}-${safeIndex}`} onLoad={() => setLoadedPhoto(`${color.id}-${safeIndex}`)} src={mediaSrc(images[safeIndex], 1280)} srcSet={mediaSrcSet(images[safeIndex], [640, 960, 1280, 1600])} sizes="(max-width: 767px) 100vw, 60vw" fetchPriority="high" alt={`${displayName} in ${displayColorName(color)}, photo ${safeIndex + 1} of ${images.length}`} onClick={() => setZoom(true)} />
          {soldOut ? <span className="product-badge sold-out-badge">{t('Sold out')}</span> : product.badge && <span className="product-badge">{product.badge}</span>}

        </div>
        {neighbourImages.map(image => <link key={image} rel="prefetch" as="image" href={mediaSrc(image, 1280)} />)}
        <div className="product-thumbnails" aria-label={`${displayColorName(color)} photos`}>
          {images.map((image, index) => <button key={`${color.id}-${image}-${index}`} className={safeIndex === index ? 'selected' : ''} onClick={() => showImage(index)} aria-label={`${t('Show photo')} ${index + 1}`} aria-pressed={safeIndex === index}><img src={mediaSrc(image, 160)} alt={`${displayColorName(color)} photo ${index + 1}`} /></button>)}
        </div>
      </div>

      <div className="product-buy-box">
        <div className="product-heading">
          <h1>{displayName}</h1>
          {reviews && <RatingLink summary={reviews} />}
          {promoLive ? <div className="product-price on-sale"><span className="price-now">{moneyIqd(product.salePriceIqd)}</span><s className="price-was">{moneyIqd(product.originalPriceIqd!)}</s><span className="price-save">{language === 'ar' ? `وفّر ${moneyIqd(product.originalPriceIqd! - product.salePriceIqd)}` : `Save ${moneyIqd(product.originalPriceIqd! - product.salePriceIqd)}`}</span></div> : <div className="product-price">{moneyIqd(product.originalPriceIqd ?? product.salePriceIqd)}</div>}
          {promoLive && product.promotion && <div className="promo-panel"><span className="promo-panel-name">{(language === 'ar' ? product.promotion.badgeAr || product.promotion.nameAr : product.promotion.badge || product.promotion.name) || `−${product.promotion.percentOff}%`}</span>{product.promotion.showCountdown && <PromoCountdown endsAt={product.promotion.endsAt} language={language} refreshOnEnd />}</div>}
        </div>

        {product.capacity && <label className="capacity-field"><span>{t('Size')}</span><select value={product.capacity} aria-label={t('Size')} onChange={() => undefined}><option>{product.capacity}</option></select></label>}

        <div className="material-label">{language === 'ar' ? 'المادة واللون' : 'Material & color'}</div>
        <div className="detail-swatches" aria-label={t('Choose a color')}>
          {product.colors.map(item => <div className="detail-swatch-wrap" key={item.id}>
            <button
              type="button"
              title={item.stock > 0 ? displayColorName(item) : `${displayColorName(item)} — ${t('Sold out')}`}
              aria-label={`${t('Choose a color')}: ${displayColorName(item)}`}
              aria-pressed={color.id === item.id}
              className={`${color.id === item.id ? 'selected' : ''} ${item.stock <= 0 ? 'swatch-sold-out' : ''}`}
              style={{ '--swatch': item.hex } as React.CSSProperties}
              onClick={() => chooseColor(item)}
            >
              {item.images[0] ? <img src={mediaSrc(item.images[0], 160)} alt="" aria-hidden="true" /> : <span className="swatch-color-fill" aria-hidden="true" />}
            </button>
            <span>{displayColorName(item)}</span>
          </div>)}
        </div>

        <div className="buy-actions">
          <button className="button button-orange product-add-to-cart" disabled={soldOut} onClick={() => void addToCart(color.id, quantity, { variantId: color.id, productId: product.id, name: product.name, nameAr: product.nameAr || product.name, color: color.name, colorAr: color.nameAr || color.name, salePriceIqd: product.salePriceIqd, originalPriceIqd: product.originalPriceIqd, image: primaryImage(color), capacity: product.capacity ?? null, stock: color.stock })}>{soldOut ? t('Sold out in this color') : <>{language === 'ar' ? 'إضافة إلى السلة' : 'ADD TO CART'}</>}</button>
          <a
            className="button button-orange whatsapp-inquiry-button"
            href={`https://wa.me/${String(settings.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(language === 'ar' ? `مرحباً، أرغب بطلب:\n${displayName}\nالسعر: ${moneyIqd(product.salePriceIqd)}\nالكمية: ${quantity}\nاللون: ${displayColorName(color)}` : `Hello, I would like to place an order:\n${displayName}\nPrice: ${moneyIqd(product.salePriceIqd)}\nQuantity: ${quantity}\nColor: ${displayColorName(color)}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            <svg className="whatsapp-brand-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.075-.792.372-.273.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982 1-3.648-.235-.374a9.86 9.86 0 1 1 8.372 4.632m8.14-18.012A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.893c0 2.096.547 4.142 1.588 5.946L.057 24l6.304-1.654a11.893 11.893 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.751-8.128"/>
            </svg>
            <span>{language === 'ar' ? 'استفسر عبر الواتساب' : 'Ask via WhatsApp'}</span>
          </a>
        </div>
        {displayDescription && <p className="product-description">{displayDescription}</p>}
        {(headline || details.highlights.length > 0) && <section className="product-overview" aria-label={language === 'ar' ? 'نظرة سريعة على المنتج' : 'At a glance'}>
          {headline && <h2 className="product-headline">{headline}</h2>}
          {details.highlights.length > 0 && <ul className="product-highlights">
            {details.highlights.map((item, index) => { const Icon = HIGHLIGHT_ICON_COMPONENTS[item.icon]; return <li key={index}><Icon size={26} strokeWidth={1.3} aria-hidden="true" /><span>{pick(language, item.text, item.textAr)}</span></li>; })}
          </ul>}
        </section>}

        {features.length > 0 && <details className="product-accordion product-features-accordion" open>
          <summary>{language === 'ar' ? 'المميزات' : 'Features'}</summary>
          <div><ul className="product-feature-list">{features.map((feature, index) => <li key={index}>{feature}</li>)}</ul></div>
        </details>}
        {specRows.length > 0 && <details className="product-accordion product-specifications-accordion">
          <summary>{language === 'ar' ? 'المواصفات' : 'Specifications'}</summary>
          <div className="product-specifications-content">
            <dl className="product-spec-list">{specRows.map((row, index) => <div key={index}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
            {details.dimensionsImage && <img className="product-dimensions-image" src={mediaSrc(details.dimensionsImage, 1280)} alt={language === 'ar' ? 'رسم يوضح أبعاد المنتج' : 'Product dimensions diagram'} loading="lazy" />}
          </div>
        </details>}
        {(warrantyPeriod || warrantyText) && <details className="product-accordion">
          <summary>{warrantyPeriod ? (language === 'ar' ? `ضمان ${warrantyPeriod}` : `${warrantyPeriod} warranty`) : (language === 'ar' ? 'الضمان' : 'Warranty')}</summary>
          <div>{warrantyText && <p>{warrantyText}</p>}<Link href="/info/warranty">{language === 'ar' ? 'اقرأ سياسة الضمان' : 'Read our warranty policy'}</Link></div>
        </details>}
        {materials && <details className="product-accordion">
          <summary>{language === 'ar' ? 'المواد والمكونات' : 'Materials & composition'}</summary>
          <div><p>{materials}</p><Link href="/info/our-materials">{t('A closer look at our materials')}</Link></div>
        </details>}
        <details className="product-accordion"><summary>{t('Shipping & returns')}</summary><div>{language === 'ar' ? <>نوصل إلى جميع محافظات العراق مع الدفع عند الاستلام. يصل الطلب إلى بغداد عادة خلال 1–2 يوم عمل، وإلى باقي المحافظات خلال 2–5 أيام. الطلبات فوق {moneyIqd(settings.freeShippingThreshold)} تحصل على توصيل مجاني. <Link href="/info/shipping">{t('Find out more.')}</Link></> : <>We deliver to all 18 governorates of Iraq with cash on delivery. Baghdad usually arrives in 1–2 business days, other governorates in 2–5. Orders over {moneyIqd(settings.freeShippingThreshold)} ship free. <Link href="/info/shipping">{t('Find out more.')}</Link></>}</div></details>
        {bundles.length > 0 && <section className="product-bundles" aria-label={language === 'ar' ? 'وفّر ضمن بكج' : 'Save with a bundle'}><h3>{language === 'ar' ? 'وفّر أكثر ضمن بكج' : 'Save more with a bundle'}</h3>{bundles.map(b => <BundleCard key={b.id} bundle={b} compact />)}</section>}
      </div>
    </div>

    {story.length > 0 && <section className={`product-story ${story.length === 2 ? 'product-story-compare' : ''}`} aria-label={language === 'ar' ? 'المنتج أثناء الاستخدام' : 'See it out and about'}>
      <h2>{language === 'ar' ? 'شوفه بالاستخدام اليومي' : 'See it out and about'}</h2>
      <div className="product-story-items">{story.map((item, index) => <figure key={item.image + index}>
        {pick(language, item.caption, item.captionAr) && <figcaption>{pick(language, item.caption, item.captionAr)}</figcaption>}
        <img src={mediaSrc(item.image, 960)} alt={`${displayName} — ${pick(language, item.caption, item.captionAr) || (language === 'ar' ? `صورة ${index + 1}` : `photo ${index + 1}`)}`} loading="lazy" />
      </figure>)}</div>
    </section>}
    {details.videoId && <ProductVideo id={details.videoId} wide={details.videoWide} title={pick(language, details.videoTitle, details.videoTitleAr) || displayName} heading={pick(language, details.videoTitle, details.videoTitleAr)} language={language} />}
    {banner?.enabled && banner.image && (() => {
      const alt = pick(language, banner.alt, banner.altAr) || displayName;
      const picture = <picture>{banner.mobileImage && <source media="(max-width: 700px)" srcSet={mediaSrc(banner.mobileImage, 960)} />}<img src={mediaSrc(banner.image, 1920)} alt={alt} loading="lazy" /></picture>;
      return <section className="product-page-banner" aria-label={alt}>{banner.href ? <Link href={banner.href}>{picture}</Link> : picture}</section>;
    })()}
    {reviews && <ProductReviews productId={product.id} summary={reviews} />}
    {related.length > 0 && <><div className="section-heading"><h2>{language === 'ar' ? 'منتجات تكمل اختيارك' : 'In good company'}</h2><Link className="text-link" href="/products/category/all">{t('Explore all')} <ArrowRight size={16} /></Link></div><div className="related-products">{related.map(item => <ProductCard key={item.id} product={item} />)}</div></>}
    {zoom && <Modal title={`${displayName} image`} className="product-zoom-overlay" onClose={() => setZoom(false)}><ModalHeading title={`${displayName} — ${displayColorName(color)}`} onClose={() => setZoom(false)} /><img src={mediaSrc(images[safeIndex], 1600)} alt={`${displayName} in ${displayColorName(color)}, enlarged photo ${safeIndex + 1}`} /></Modal>}
    {product.colors.length > 0 && <link rel="prefetch" href={mediaSrc(primaryImage(color), 1280)} />}
  </main>;
}
