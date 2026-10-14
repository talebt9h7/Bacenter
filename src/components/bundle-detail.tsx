'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BadgeCheck, Check, Gift, Plus, ShieldCheck, Tag, Truck } from 'lucide-react';
import { mediaSrc, mediaSrcSet } from '@/lib/types';
import type { BundlePart, BundleView } from '@/lib/bundles';
import { track } from '@/lib/track';
import { useStore } from './store-provider';
import { useLanguage } from './language-provider';
import { BundleCard } from './bundle-card';

export type BundlePartProduct = BundlePart & { images: string[]; subtitle: string; subtitleAr: string; description: string; descriptionAr: string; features: string[]; featuresAr: string[] };

/** The bundle page: a gallery of every item, the bundle price and saving, then each item's details. */
export function BundleDetail({ bundle, parts, others }: { bundle: BundleView; parts: BundlePartProduct[]; others: BundleView[] }) {
  const { moneyIqd, addBundleToCart, busy } = useStore();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const name = ar ? bundle.nameAr || bundle.name : bundle.name;
  const description = ar ? bundle.descriptionAr || bundle.description : bundle.description;
  const ownImage = bundle.image && !parts.some(p => p.images.includes(bundle.image!)) ? [bundle.image] : [];
  const gallery = [...ownImage, ...parts.flatMap(p => p.images.slice(0, 3))].filter(Boolean);
  const [index, setIndex] = useState(0);
  const [adding, setAdding] = useState(false);
  const safe = Math.min(index, Math.max(0, gallery.length - 1));
  const pct = bundle.regularIqd > 0 ? Math.round(bundle.savingIqd / bundle.regularIqd * 100) : 0;
  const soldOut = bundle.available <= 0;
  useEffect(() => { track.viewItem({ id: `bundle-${bundle.slug}`, name: bundle.name, price: bundle.priceIqd, category: 'bundle' }); }, [bundle.slug, bundle.name, bundle.priceIqd]);
  async function add() { setAdding(true); await addBundleToCart(bundle.id); setAdding(false); }
  const partName = (p: BundlePartProduct) => ar ? p.nameAr || p.name : p.name;
  const partColor = (p: BundlePartProduct) => ar ? p.colorAr || p.color : p.color;

  return <main className="product-page bundle-page" dir={ar ? 'rtl' : 'ltr'}>
    <div className="product-detail-layout">
      <div className="product-gallery">
        <div className="product-main-image bundle-main-image">
          {gallery.length > 0 ? <img key={gallery[safe]} src={mediaSrc(gallery[safe], 1280)} srcSet={mediaSrcSet(gallery[safe], [640, 960, 1280, 1600])} sizes="(max-width: 767px) 100vw, 60vw" alt={name} fetchPriority="high" /> : null}
          {pct > 0 && <span className="ur-deal-badge"><Tag size={14} strokeWidth={2.4} /><span>{ar ? 'خصم' : 'Save'}</span><b dir="ltr">{pct}%</b></span>}
        </div>
        {gallery.length > 1 && <div className="product-thumbnails">{gallery.map((image, i) => <button key={`${image}-${i}`} className={safe === i ? 'selected' : ''} onClick={() => setIndex(i)} aria-label={`${ar ? 'صورة' : 'Photo'} ${i + 1}`} aria-pressed={safe === i}><img src={mediaSrc(image, 160)} alt="" /></button>)}</div>}
      </div>

      <div className="product-buy-box">
        <div className="product-heading">
          <span className="bundle-eyebrow"><Gift size={14} /> {ar ? `بكج · ${parts.reduce((s, p) => s + p.quantity, 0)} قطع` : `Bundle · ${parts.reduce((s, p) => s + p.quantity, 0)} pieces`}</span>
          <h1>{name}</h1>
          <div className="bundle-price-block">
            <div className="bundle-price-row"><strong className="bundle-price-now">{moneyIqd(bundle.priceIqd)}</strong>{bundle.savingIqd > 0 && <s className="bundle-price-was">{moneyIqd(bundle.regularIqd)}</s>}</div>
            {bundle.savingIqd > 0 && <div className="ur-deal-strip"><span className="ur-deal-chip"><b dir="ltr">-{pct}%</b></span><span>{ar ? <>وفّرت <b>{moneyIqd(bundle.savingIqd)}</b> بهذا البكج</> : <>You save <b>{moneyIqd(bundle.savingIqd)}</b> with this bundle</>}</span></div>}
          </div>
        </div>

        <div className="bundle-contents">
          <h2>{ar ? 'داخل البكج' : 'In this bundle'}</h2>
          <ul>{parts.map((p, i) => <li key={p.variantId}>
            {i > 0 && <i className="bundle-plus" aria-hidden="true"><Plus size={12} /></i>}
            <a href={`#part-${p.variantId}`} className="bundle-contents-item">
              <img src={mediaSrc(p.images[0] ?? p.image, 240)} alt="" />
              <span><b>{p.quantity > 1 && `${p.quantity}× `}{partName(p)}</b><small><em style={{ background: p.hex }} />{partColor(p)}</small></span>
              <s>{moneyIqd(p.priceIqd * p.quantity)}</s>
            </a>
          </li>)}</ul>
        </div>

        <div className="buy-actions">
          <button className="button button-orange product-add-to-cart" disabled={busy || adding || soldOut} onClick={() => void add()}>{soldOut ? (ar ? 'نفد حالياً' : 'Sold out') : <>{ar ? 'أضف البكج للسلة' : 'Add bundle to bag'}</>}</button>
        </div>
        {!soldOut && bundle.available <= 5 && <p className="bundle-stock-note">{ar ? `بقي ${bundle.available} فقط من هذا البكج` : `Only ${bundle.available} left`}</p>}
        {description && <p className="product-description">{description}</p>}
        <ul className="bundle-perks">
          <li><i><ShieldCheck size={18} /></i><span><b>{ar ? 'ضمان 3 سنوات' : '3-year warranty'}</b><small>{ar ? 'على كل قطعة' : 'On every piece'}</small></span></li>
          <li><i><BadgeCheck size={18} /></i><span><b>{ar ? 'جلد طبيعي 100%' : '100% natural leather'}</b><small>{ar ? 'صناعة يدوية' : 'Handmade'}</small></span></li>
          <li><i><Truck size={18} /></i><span><b>{ar ? 'توصيل لكل العراق' : 'Delivery across Iraq'}</b><small>{ar ? 'الدفع عند الاستلام' : 'Cash on delivery'}</small></span></li>
        </ul>
      </div>
    </div>

    <section className="bundle-parts" aria-label={ar ? 'تفاصيل القطع' : 'Item details'}>
      {parts.map(p => { const sub = ar ? p.subtitleAr || p.subtitle : p.subtitle; const desc = ar ? p.descriptionAr || p.description : p.description; const feats = (ar && p.featuresAr.length ? p.featuresAr : p.features).slice(0, 6); return <article key={p.variantId} id={`part-${p.variantId}`} className="bundle-part">
        <div className="bundle-part-images">{p.images.slice(0, 3).map((img, i) => <img key={img + i} src={mediaSrc(img, 640)} alt={`${partName(p)} ${i + 1}`} loading="lazy" />)}</div>
        <div className="bundle-part-copy">
          <span className="eyebrow">{p.quantity > 1 ? (ar ? `${p.quantity} قطع` : `${p.quantity} pieces`) : (ar ? 'قطعة' : 'Item')} · {partColor(p)}</span>
          <h2>{partName(p)}</h2>
          {sub && <p className="bundle-part-sub">{sub}</p>}
          {desc && <p>{desc}</p>}
          {feats.length > 0 && <ul>{feats.map(f => <li key={f}><Check size={14} /> {f}</li>)}</ul>}
          <Link className="text-link" href={`/products/${p.productId}?color=${encodeURIComponent(p.color)}`}>{ar ? 'صفحة المنتج كاملة' : 'Full product page'}</Link>
        </div>
      </article>; })}
    </section>

    {others.length > 0 && <section className="section bundles-section"><div className="section-heading"><h2>{ar ? 'بكجات ثانية' : 'More bundles'}</h2></div><div className="bundles-grid">{others.map(b => <BundleCard key={b.id} bundle={b} />)}</div></section>}
  </main>;
}
