'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Plus, LoaderCircle } from 'lucide-react';
import { mediaSrc, mediaSrcSet, primaryImage, type Product } from '@/lib/types';
import { useStore } from './store-provider';
import { useLanguage } from './language-provider';
import { storeT } from '@/lib/i18n';
import { PromoCountdown, usePromoLive } from './promo-price';
import { colorGroups, hasSizes, priceFrom } from '@/lib/variants';

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  // Sized products list each colour once here; the size is chosen on the product page.
  const sized = hasSizes(product);
  const swatches = sized ? colorGroups(product) : product.colors;
  const [color, setColor] = useState(swatches.find(item => item.stock > 0) ?? swatches[0]);
  const [adding, setAdding] = useState(false);
  const { moneyIqd, addToCart, busy } = useStore();
  const { language } = useLanguage();
  const t = (label: string) => storeT(label, language);
  const displayName = language === 'ar' ? (product.nameAr || product.name) : product.name;
  const displaySubtitle = language === 'ar' ? product.subtitleAr : product.subtitle;
  async function add() { setAdding(true); await addToCart(color.id); setAdding(false); }
  // Both links share one URL so the page is prefetched once. `prefetch` loads the full page data
  // while the card is on screen, so opening the product needs no server round trip.
  const href = `/products/${product.id}?color=${encodeURIComponent(color.name)}`;
  // Start downloading the product page's main photo as soon as the shopper reaches for the card.
  function warmImage() { const img = new Image(); img.src = mediaSrc(primaryImage(color), 1280); }
  const soldOut = color.stock <= 0;
  // A promotion that ends while the page is open falls back to the regular price straight away.
  const promoLive = usePromoLive(product.promotion) && !!product.originalPriceIqd;
  const from = priceFrom(product);
  const price = sized ? from.min : promoLive ? product.salePriceIqd : (product.originalPriceIqd ?? product.salePriceIqd);
  const promoBadge = promoLive && product.promotion ? ((language === 'ar' ? product.promotion.badgeAr : product.promotion.badge) || `−${product.promotion.percentOff}%`) : null;
  return <article className={`product-card ${compact ? 'compact-card' : ''}`}>
    <div className="product-image-wrap">
      <Link href={href} prefetch onPointerDown={warmImage} onMouseEnter={warmImage} className="product-image-link" aria-label={`${language === 'ar' ? 'عرض' : 'View'} ${displayName}`}>
        <img src={mediaSrc(primaryImage(color), 640)} srcSet={mediaSrcSet(primaryImage(color), [320, 480, 640, 960])} sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw" alt={`${displayName} in ${language === 'ar' ? (color.nameAr || color.name) : color.name}`} loading="lazy" className="product-image" />
      </Link>
      {soldOut ? <span className="product-badge sold-out-badge">{t('Sold out')}</span> : promoBadge ? <span className="product-badge promo-badge">{promoBadge}</span> : product.badge && <span className={`product-badge ${product.badge.startsWith('NEW') ? 'new-badge' : ''}`}>{language === 'ar' ? (product.badge === 'NEW' ? 'جديد' : product.badge === 'SAVE' ? 'وفر' : product.badge) : product.badge}</span>}
      {!compact && !soldOut && !sized && <button className="quick-add" aria-label={`${language === 'ar' ? 'إضافة' : 'Add'} ${displayName} ${language === 'ar' ? 'إلى السلة' : 'to bag'}`} title={language === 'ar' ? 'إضافة سريعة إلى السلة' : 'Quick add to bag'} disabled={busy} onClick={add}>{adding ? <LoaderCircle className="spin" size={18} /> : <Plus size={21} strokeWidth={1.4} />}</button>}
    </div>
    <div className="product-card-info">
      <Link href={href} prefetch onPointerDown={warmImage} className="product-card-title">{displayName}</Link>
      <div className={`product-card-price ${promoLive ? 'on-sale' : ''}`}>{sized && from.varies ? <>{language === 'ar' ? 'من ' : 'From '}{moneyIqd(price)}</> : promoLive && !sized ? <><span className="price-now">{moneyIqd(price)}</span><s className="price-was">{moneyIqd(product.originalPriceIqd!)}</s></> : moneyIqd(price)}</div>
      {promoLive && product.promotion?.showCountdown && <PromoCountdown endsAt={product.promotion.endsAt} language={language} compact />}
      {!compact && <div className="product-swatches" aria-label={`${displayName} colors`}>
        {swatches.map(item => <button key={item.id} title={item.stock > 0 ? (language === 'ar' ? (item.nameAr || item.name) : item.name) : `${language === 'ar' ? (item.nameAr || item.name) : item.name} (${language === 'ar' ? 'نفد المخزون' : 'sold out'})`} aria-label={`${displayName}: ${language === 'ar' ? (item.nameAr || item.name) : item.name}`} aria-pressed={color.id === item.id} className={`${color.id === item.id ? 'selected' : ''} ${item.stock <= 0 ? 'swatch-sold-out' : ''}`} style={{ '--swatch': item.hex } as React.CSSProperties} onClick={() => setColor(item)} />)}
      </div>}
      <p className="product-card-details">{!sized && product.capacity ? `${product.capacity} · ` : ''}{displaySubtitle}</p>
    </div>
  </article>;
}
