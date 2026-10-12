'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Banknote, ChevronLeft, ChevronRight, CreditCard, Layers, LoaderCircle, LockKeyhole, RotateCcw, ShieldCheck, Truck, ZoomIn } from 'lucide-react';
import { categories } from '@/lib/catalog';
import { hoverImage, primaryImage, PLACEHOLDER_IMAGE, type Product, type ProductColor } from '@/lib/types';
import { useStore } from './store-provider';
import { useLanguage } from './language-provider';
import { storeT } from '@/lib/i18n';
import { ProductCard } from './product-card';
import { Modal, ModalHeading } from './modal';

export function ProductDetail({ product, related, initialColor }: { product: Product; related: Product[]; initialColor?: string }) {
  const { language } = useLanguage();
  const displayColorName = (item: ProductColor) => language === 'ar' ? (item.nameAr || item.name) : item.name;
  const startColor = product.colors.find(item => displayColorName(item).toLowerCase() === initialColor?.toLowerCase()) || product.colors.find(item => item.stock > 0) || product.colors[0];
  const [color, setColor] = useState<ProductColor>(startColor);
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(startColor.primaryIndex);
  const [zoom, setZoom] = useState(false);
  const { moneyIqd, money, region, addToCart, busy, freeShippingUsd, settings } = useStore();
  const displayName = language === 'ar' ? (product.nameAr || product.name) : product.name;
  const displaySubtitle = language === 'ar' ? (product.subtitleAr || product.subtitle) : product.subtitle;
  const displayDescription = language === 'ar' ? (product.descriptionAr || product.description) : product.description;
    const t = (label: string) => storeT(label, language);
  const images = color.images.length ? color.images : [PLACEHOLDER_IMAGE];
  const safeIndex = Math.min(imageIndex, images.length - 1);
  const categoryName = categories.find(item => item.id === product.category)?.name || 'Products';
  const soldOut = color.stock <= 0; const lowStock = color.stock > 0 && color.stock <= 5;
  const maxQuantity = Math.max(1, Math.min(10, color.stock));
  // Each color owns its own main image. Switching color jumps to that color's selected main photo.
  function chooseColor(item: ProductColor) {
    setColor(item);
    setImageIndex(item.primaryIndex);
    setQuantity(current => Math.min(current, Math.max(1, Math.min(10, item.stock))));
    const url = new URL(window.location.href); url.searchParams.set('color', displayColorName(item)); window.history.replaceState(null, '', url);
  }
  return <main className="product-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <div className="product-detail-layout">
      <div className="product-gallery">
        <div className="product-main-image">
          <img key={`${color.id}-${safeIndex}`} src={images[safeIndex]} alt={`${displayName} in ${displayColorName(color)}, photo ${safeIndex + 1} of ${images.length}`} onClick={() => setZoom(true)} />
          {soldOut ? <span className="product-badge sold-out-badge">{t('Sold out')}</span> : product.badge && <span className="product-badge">{product.badge}</span>}
        </div>
        <div className="product-thumbnails" aria-label={`${displayColorName(color)} photos`}>
          {images.map((image, index) => <button key={`${color.id}-${image}-${index}`} className={safeIndex === index ? 'selected' : ''} onClick={() => setImageIndex(index)} aria-label={`${t('Show photo')} ${index + 1}`} aria-pressed={safeIndex === index}><img src={image} alt={`${displayColorName(color)} photo ${index + 1}`} /></button>)}
        </div>
      </div>

      <div className="product-buy-box">
        <div className="product-heading">
          <h1>{displayName}</h1>
          <div className="product-price">{moneyIqd(product.salePriceIqd)}</div>
        </div>

        {product.capacity && <label className="capacity-field"><span>{t('Size')}</span><select value={product.capacity} aria-label={t('Size')} onChange={() => undefined}><option>{product.capacity}</option></select></label>}

        <div className="material-label">{language === 'ar' ? 'المادة واللون' : 'Material & color'}</div>
        <div className="color-label"><span>{displayColorName(color)}</span>{soldOut ? <em className="stock-note sold-out">{t('Sold out')}</em> : lowStock ? <em className="stock-note low">{t('Only')} {color.stock} {language === 'ar' ? 'متبقي' : 'left'}</em> : <em className="stock-note">{t('In stock')}</em>}</div>
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
              {item.images[0] ? <img src={item.images[0]} alt="" aria-hidden="true" /> : <span className="swatch-color-fill" aria-hidden="true" />}
            </button>
            <span>{displayColorName(item)}</span>
          </div>)}
        </div>

        {displayDescription && <p className="product-description">{displayDescription}</p>}
        <div className="buy-actions">
          <button className="button button-orange product-add-to-cart" disabled={busy || soldOut} onClick={() => void addToCart(color.id, quantity)}>{soldOut ? t('Sold out in this color') : busy ? <><LoaderCircle size={17} className="spin" /> {t('Adding to your bag')}</> : <>ADD TO CART</>}</button>
          <a
            className="button whatsapp-inquiry-button"
            href={`https://wa.me/${String(settings.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(language === 'ar' ? `مرحباً، أريد الاستفسار عن ${displayName} - لون ${displayColorName(color)}` : `Hello, I would like to ask about ${displayName} - ${displayColorName(color)}.`)}`}
            target="_blank"
            rel="noreferrer"
          >
            <svg className="whatsapp-brand-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.075-.792.372-.273.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982 1-3.648-.235-.374a9.86 9.86 0 1 1 8.372 4.632m8.14-18.012A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.893c0 2.096.547 4.142 1.588 5.946L.057 24l6.304-1.654a11.893 11.893 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.751-8.128"/>
            </svg>
            <span>{language === 'ar' ? 'استفسر عبر الواتساب' : 'Ask via WhatsApp'}</span>
          </a>
        </div>
        <section className="product-at-a-glance" aria-label={language === 'ar' ? 'نظرة سريعة على المنتج' : 'At a glance'}>
          <h2>{language === 'ar' ? 'نظرة سريعة' : 'At a glance'}</h2>
          {product.features.length > 0 ? <ul>
            {product.features.map((feature, index) => {
              const FeatureIcon = [CreditCard, Banknote, ShieldCheck, Layers, LockKeyhole][index % 5];
              return <li key={feature}>
                <span className="at-a-glance-icon" aria-hidden="true"><FeatureIcon size={25} strokeWidth={1.4} /></span>
                <span>{feature}</span>
              </li>;
            })}
          </ul> : <p>{language === 'ar' ? 'أضف مميزات المنتج من لوحة الإدارة لعرضها هنا.' : 'Add product features in the admin panel to show them here.'}</p>}
        </section>
        <div className="product-assurances"><span><Truck size={15} strokeWidth={1.4} />{product.salePriceIqd >= (freeShippingUsd * region.rate) ? t('Free delivery in Iraq') : language === 'ar' ? `توصيل مجاني للطلبات فوق ${moneyIqd(freeShippingUsd * region.rate)}` : `Free delivery over ${moneyIqd(freeShippingUsd * region.rate)}`}</span><span><RotateCcw size={14} strokeWidth={1.4} />{t('30-day returns')}</span></div>

        <details className="product-accordion product-features-accordion" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="text-xl font-medium text-neutral-700">{language === 'ar' ? 'المميزات' : 'Features'}</span>
            <ChevronRight size={20} className="shrink-0 transition-transform duration-200 open:rotate-90 group-open:rotate-90 rtl:rotate-180" aria-hidden="true" />
          </summary>
          <div className="py-4 md:py-6">
            <ul className="list-disc space-y-2 pl-6 text-base leading-7 text-neutral-700 sm:columns-2 sm:gap-x-8 sm:space-y-2">
              {product.features.map(feature => <li key={feature} className="break-inside-avoid pr-2">{feature}</li>)}
            </ul>
            {product.features.length === 0 && <p className="text-sm text-neutral-500">{language === 'ar' ? 'لا توجد مميزات مضافة لهذا المنتج حالياً.' : 'No features have been added for this product yet.'}</p>}
          </div>
        </details>
        <details className="product-accordion product-specifications-accordion">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="text-xl font-medium text-neutral-700">{language === 'ar' ? 'المواصفات' : 'Specifications'}</span>
            <ChevronRight size={20} className="shrink-0 transition-transform duration-200 group-open:rotate-90 rtl:rotate-180" aria-hidden="true" />
          </summary>
          <div className="product-specifications-content">
            {product.dimensions && <div className="product-dimensions-block">
              <h3>{language === 'ar' ? 'الأبعاد الخارجية' : 'External Dimensions'}</h3>
              <p className="product-dimensions-value">{product.dimensions}</p>
              {product.dimensionsImage && <img className="product-dimensions-image" src={product.dimensionsImage} alt={language === 'ar' ? 'رسم يوضح أبعاد المنتج' : 'Product dimensions diagram'} loading="lazy" />}
            </div>}
            {product.capacity && <div className="product-specification-item"><h3>{language === 'ar' ? 'السعة' : 'Capacity'}</h3><p>{product.capacity}</p></div>}
            {(product.specifications ?? []).map((spec, index) => { const separator = spec.indexOf(':'); const label = separator >= 0 ? spec.slice(0, separator).trim() : (language === 'ar' ? 'تفاصيل' : 'Detail'); const value = separator >= 0 ? spec.slice(separator + 1).trim() : spec; return <div className="product-specification-item" key={index}><h3>{label}</h3><p>{value}</p></div>; })}
            {!product.dimensions && !product.capacity && !(product.specifications ?? []).length && <p className="text-sm text-neutral-500">{language === 'ar' ? 'لم تُضف مواصفات لهذا المنتج بعد.' : 'No specifications have been added for this product yet.'}</p>}
          </div>
        </details>
        <details className="product-accordion"><summary>{language === 'ar' ? 'المواد والمكونات' : 'Materials & composition'}</summary><div className="py-4"><p>{product.materials || (language === 'ar' ? 'لم تُضف تفاصيل المواد لهذا المنتج بعد.' : 'No materials information has been added yet.')}</p><Link href="/info/our-materials">{t('A closer look at our materials')}</Link></div></details>
        <details className="product-accordion"><summary>{t('Shipping & returns')}</summary><div>{language === 'ar' ? <>نوصل إلى جميع محافظات العراق مع الدفع عند الاستلام. يصل الطلب إلى بغداد عادة خلال 1–2 يوم عمل، وإلى باقي المحافظات خلال 2–5 أيام. الطلبات فوق {moneyIqd(freeShippingUsd * region.rate)} تحصل على توصيل مجاني. <Link href="/info/shipping">{t('Find out more.')}</Link></> : <>We deliver to all 18 governorates of Iraq with cash on delivery. Baghdad usually arrives in 1–2 business days, other governorates in 2–5. Orders over {moneyIqd(freeShippingUsd * region.rate)} ship free. <Link href="/info/shipping">{t('Find out more.')}</Link></>}</div></details>
        <details className="product-accordion"><summary>{language === 'ar' ? 'الضمان' : 'Warranty'}</summary><div className="py-4"><ShieldCheck size={21} style={{ marginBottom: 8 }} /><p>{product.warranty || (language === 'ar' ? 'تفاصيل الضمان غير مضافة لهذا المنتج.' : 'Warranty details have not been added for this product yet.')}</p><Link href="/info/warranty">{language === 'ar' ? 'اقرأ سياسة الضمان' : 'Read our warranty policy'}</Link></div></details>
      </div>
    </div>

    <section className="product-story" aria-label={language === 'ar' ? 'صور المنتج أثناء الاستخدام' : 'See it out and about'}><div><span className="eyebrow">{language === 'ar' ? 'تفاصيل من الحياة اليومية' : 'See it out and about'}</span><h2>{language === 'ar' ? 'مصمم ليرافقك كل يوم' : 'Made to go with you'}</h2></div><div className="flex w-full gap-4 overflow-x-auto snap-x snap-mandatory pb-2">{(product.storyImages?.length ? product.storyImages : [hoverImage(color)]).map((image, index) => <div key={image + index} className="relative aspect-square w-[78vw] max-w-[400px] shrink-0 snap-center overflow-hidden bg-neutral-100 sm:w-[42vw]"><img src={image} alt={`${displayName} lifestyle photo ${index + 1}`} loading="lazy" className="h-full w-full object-cover" /></div>)}</div><h3 className="text-xs uppercase tracking-[0.2em] text-neutral-500">{language === 'ar' ? 'انضم إلى المجتمع' : 'Join the community'}</h3><div className="flex flex-wrap gap-5 text-sm"><a className="text-orange-700 underline underline-offset-4" href="https://www.instagram.com/" target="_blank" rel="noreferrer">Instagram →</a><a className="text-orange-700 underline underline-offset-4" href="https://www.tiktok.com/" target="_blank" rel="noreferrer">TikTok →</a><a className="text-orange-700 underline underline-offset-4" href="https://www.facebook.com/" target="_blank" rel="noreferrer">Facebook →</a></div></section>{related.length > 0 && <><div className="section-heading"><h2>{language === 'ar' ? 'منتجات تكمل اختيارك' : 'In good company'}</h2><Link className="text-link" href="/products/category/all">{t('Explore all')} <ArrowRight size={16} /></Link></div><div className="related-products">{related.map(item => <ProductCard key={item.id} product={item} />)}</div></>}
    {zoom && <Modal title={`${displayName} image`} className="product-zoom-overlay" onClose={() => setZoom(false)}><ModalHeading title={`${displayName} — ${displayColorName(color)}`} onClose={() => setZoom(false)} /><img src={images[safeIndex]} alt={`${displayName} in ${displayColorName(color)}, enlarged photo ${safeIndex + 1}`} /></Modal>}
    {product.colors.length > 0 && <link rel="prefetch" href={primaryImage(color)} />}
  </main>;
}
