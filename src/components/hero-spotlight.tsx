'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { mediaSrc, mediaSrcSet, primaryImage, type Product } from '@/lib/types';
import { useStore } from './store-provider';
import { useLanguage } from './language-provider';
import { usePromoLive } from './promo-price';
import { colorGroups, hasSizes, priceFrom } from '@/lib/variants';

const ROTATE_MS = 3000;
const IDLE_AFTER_TOUCH_MS = 7000;

/** Homepage hero: one bestseller at a time, large, with its colours. Rotates through the products marked "bestseller". */
export function HeroSpotlight({ products }: { products: Product[] }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [index, setIndex] = useState(0);
  // The first slide paints without an entrance animation so it shows (and counts as loaded) straight away.
  const [moved, setMoved] = useState(false);
  const [colorIds, setColorIds] = useState<Record<string, number>>({});
  const holdUntil = useRef(0);
  const touchX = useRef<number | null>(null);
  const count = products.length;

  useEffect(() => {
    if (count < 2) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      if (document.hidden || Date.now() < holdUntil.current) return;
      setMoved(true); setIndex(i => (i + 1) % count);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [count]);

  if (!count) return null;
  const hold = () => { holdUntil.current = Date.now() + IDLE_AFTER_TOUCH_MS; };
  const go = (next: number) => { hold(); setMoved(true); setIndex(((next % count) + count) % count); };
  const product = products[index];

  return <section className={`hs${moved ? '' : ' hs-still'}`} aria-roledescription="carousel" aria-label={ar ? 'الأكثر مبيعاً' : 'Bestsellers'}
    onPointerDown={hold}
    onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
    onTouchEnd={e => { if (touchX.current == null) return; const d = touchX.current - e.changedTouches[0].clientX; touchX.current = null; if (Math.abs(d) > 45) go(index + ((d > 0) === ar ? -1 : 1)); }}>
    <div className="hs-glow" aria-hidden="true" />
    <Slide key={product.id} product={product} colorId={colorIds[product.id]} onColor={id => { hold(); setColorIds(m => ({ ...m, [product.id]: id })); }} />
    {count > 1 && <div className="hs-nav">
      <button type="button" className="hs-arrow" aria-label={ar ? 'السابق' : 'Previous'} onClick={() => go(index - 1)}>{ar ? <ArrowRight size={18} strokeWidth={1.6} /> : <ArrowLeft size={18} strokeWidth={1.6} />}</button>
      <div className="hs-dots">{products.map((p, i) => <button type="button" key={p.id} aria-label={ar ? (p.nameAr || p.name) : p.name} aria-current={i === index} className={i === index ? 'on' : ''} onClick={() => go(i)}><i style={i === index ? { animationDuration: `${ROTATE_MS}ms` } : undefined} /></button>)}</div>
      <button type="button" className="hs-arrow" aria-label={ar ? 'التالي' : 'Next'} onClick={() => go(index + 1)}>{ar ? <ArrowLeft size={18} strokeWidth={1.6} /> : <ArrowRight size={18} strokeWidth={1.6} />}</button>
    </div>}
  </section>;
}

function Slide({ product, colorId, onColor }: { product: Product; colorId?: number; onColor: (id: number) => void }) {
  const { moneyIqd } = useStore();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const sized = hasSizes(product);
  const swatches = sized ? colorGroups(product) : product.colors;
  const color = swatches.find(c => c.id === colorId) ?? swatches.find(c => c.stock > 0) ?? swatches[0];
  const name = ar ? (product.nameAr || product.name) : product.name;
  const subtitle = ar ? product.subtitleAr : product.subtitle;
  const promoLive = usePromoLive(product.promotion) && !!product.originalPriceIqd;
  const from = priceFrom(product);
  const price = sized ? from.min : promoLive ? product.salePriceIqd : (product.originalPriceIqd ?? product.salePriceIqd);
  const href = `/products/${product.id}${color ? `?color=${encodeURIComponent(color.name)}` : ''}`;
  const img = primaryImage(color);

  return <div className="hs-slide">
    <Link href={href} prefetch className="hs-media" aria-label={name}>
      <img key={color?.id} src={mediaSrc(img, 960)} srcSet={mediaSrcSet(img, [480, 640, 960, 1280])} sizes="(max-width: 767px) 86vw, 46vw" alt={name} fetchPriority="high" />
      <span className="hs-shadow" aria-hidden="true" />
    </Link>
    <div className="hs-copy">
      <span className="hs-eyebrow">{ar ? 'الأكثر مبيعاً' : 'Bestseller'}</span>
      <h1 className="hs-title"><Link href={href}>{name}</Link></h1>
      {subtitle && <p className="hs-sub">{subtitle}</p>}
      <div className="hs-price">{sized && from.varies ? <>{ar ? 'من ' : 'From '}{moneyIqd(price)}</> : promoLive && !sized ? <><span>{moneyIqd(price)}</span><s>{moneyIqd(product.originalPriceIqd!)}</s></> : moneyIqd(price)}</div>
      {swatches.length > 1 && <div className="hs-swatches" role="group" aria-label={ar ? 'الألوان' : 'Colours'}>
        {swatches.map(c => <button type="button" key={c.id} title={ar ? (c.nameAr || c.name) : c.name} aria-label={ar ? (c.nameAr || c.name) : c.name} aria-pressed={c.id === color?.id} className={c.id === color?.id ? 'on' : ''} style={{ '--sw': c.hex } as React.CSSProperties} onClick={() => onColor(c.id)} />)}
      </div>}
      <div className="hs-actions">
        <Link href={href} prefetch className="hs-cta">{ar ? 'اطلبها الآن' : 'Shop this'}</Link>
        <Link href="/products/category/all" className="hs-link">{ar ? 'كل المنتجات' : 'All products'}</Link>
      </div>
    </div>
  </div>;
}
