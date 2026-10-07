'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Plus, LoaderCircle } from 'lucide-react';
import { hoverImage, primaryImage, type Product } from '@/lib/types';
import { useStore } from './store-provider';
import { useLanguage } from './language-provider';
import { storeT } from '@/lib/i18n';

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const [color, setColor] = useState(product.colors.find(item => item.stock > 0) ?? product.colors[0]);
  const [adding, setAdding] = useState(false);
  const { moneyIqd, addToCart, busy } = useStore();
  const { language } = useLanguage();
  const t = (label: string) => storeT(label, language);
  const displayName = language === 'ar' ? (product.nameAr || product.name) : product.name;
  const displaySubtitle = language === 'ar' ? (product.subtitleAr || product.subtitle) : product.subtitle;
  async function add() { setAdding(true); await addToCart(color.id); setAdding(false); }
  const soldOut = color.stock <= 0;
  return <article className={`product-card ${compact ? 'compact-card' : ''}`}>
    <div className="product-image-wrap">
      <Link href={`/products/${product.id}?color=${encodeURIComponent(color.name)}`} className="product-image-link" aria-label={`${language === 'ar' ? 'عرض' : 'View'} ${displayName}`}>
        <img src={primaryImage(color)} alt={`${displayName} in ${language === 'ar' ? (color.nameAr || color.name) : color.name}`} loading="lazy" className="product-image" />
        {!compact && <img src={hoverImage(color)} alt="" loading="lazy" className="product-image product-image-hover" />}
      </Link>
      {soldOut ? <span className="product-badge sold-out-badge">{t('Sold out')}</span> : product.badge && <span className={`product-badge ${product.badge.startsWith('NEW') ? 'new-badge' : ''}`}>{language === 'ar' ? (product.badge === 'NEW' ? 'جديد' : product.badge === 'SAVE' ? 'وفر' : product.badge) : product.badge}</span>}
      {!compact && !soldOut && <button className="quick-add" aria-label={`${language === 'ar' ? 'إضافة' : 'Add'} ${displayName} ${language === 'ar' ? 'إلى السلة' : 'to bag'}`} title={language === 'ar' ? 'إضافة سريعة إلى السلة' : 'Quick add to bag'} disabled={busy} onClick={add}>{adding ? <LoaderCircle className="spin" size={18} /> : <Plus size={21} strokeWidth={1.4} />}</button>}
    </div>
    <div className="product-card-info">
      <Link href={`/products/${product.id}`} className="product-card-title">{displayName}</Link>
      <div className="product-card-price">{moneyIqd(product.salePriceIqd)}</div>
      {!compact && <div className="product-swatches" aria-label={`${displayName} colors`}>
        {product.colors.map(item => <button key={item.id} title={item.stock > 0 ? (language === 'ar' ? (item.nameAr || item.name) : item.name) : `${language === 'ar' ? (item.nameAr || item.name) : item.name} (${language === 'ar' ? 'نفد المخزون' : 'sold out'})`} aria-label={`${displayName}: ${language === 'ar' ? (item.nameAr || item.name) : item.name}`} aria-pressed={color.id === item.id} className={`${color.id === item.id ? 'selected' : ''} ${item.stock <= 0 ? 'swatch-sold-out' : ''}`} style={{ '--swatch': item.hex } as React.CSSProperties} onClick={() => setColor(item)} />)}
      </div>}
      <p className="product-card-details">{product.capacity ? `${product.capacity} · ` : ''}{displaySubtitle}</p>
    </div>
  </article>;
}
