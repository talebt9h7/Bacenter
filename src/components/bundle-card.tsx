'use client';
import { Gift, LoaderCircle, Plus, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { mediaSrc } from '@/lib/types';
import type { BundleView } from '@/lib/bundles';
import { useStore } from './store-provider';
import { useLanguage } from './language-provider';

/** A bundle offer: the items side by side, one price, and how much the customer saves. */
export function BundleCard({ bundle, compact = false }: { bundle: BundleView; compact?: boolean }) {
  const { moneyIqd, addBundleToCart } = useStore();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [adding, setAdding] = useState(false);
  const name = ar ? bundle.nameAr || bundle.name : bundle.name;
  const description = ar ? bundle.descriptionAr || bundle.description : bundle.description;
  const pct = bundle.regularIqd > 0 ? Math.round(bundle.savingIqd / bundle.regularIqd * 100) : 0;
  const soldOut = bundle.available <= 0;
  async function add() { setAdding(true); await addBundleToCart(bundle.id); setAdding(false); }
  return <article className={`bundle-card ${compact ? 'bundle-card-compact' : ''}`}>
    <Link href={`/bundles/${encodeURIComponent(bundle.slug)}`} className="bundle-visual" aria-label={name}>
      {bundle.image && !bundle.parts.some(p => p.image === bundle.image)
        ? <img src={mediaSrc(bundle.image, 900)} alt={name} loading="lazy" />
        : <div className="bundle-parts-visual">{bundle.parts.map((p, i) => <span key={p.variantId}>{i > 0 && <i className="bundle-plus"><Plus size={14} /></i>}<img src={mediaSrc(p.image, 480)} alt={ar ? p.nameAr || p.name : p.name} loading="lazy" /></span>)}</div>}
      {pct > 0 && <b className="bundle-save">{ar ? `وفّر ${pct}%` : `Save ${pct}%`}</b>}
    </Link>
    <div className="bundle-body">
      <span className="bundle-eyebrow"><Gift size={13} /> {ar ? 'بكج' : 'Bundle'}</span>
      <h3><Link href={`/bundles/${encodeURIComponent(bundle.slug)}`}>{name}</Link></h3>
      <ul className="bundle-items">{bundle.parts.map(p => <li key={p.variantId}><Link href={`/bundles/${encodeURIComponent(bundle.slug)}#part-${p.variantId}`}>{p.quantity > 1 && <b>{p.quantity}× </b>}{ar ? p.nameAr || p.name : p.name}</Link> <span><i style={{ background: p.hex }} />{ar ? p.colorAr || p.color : p.color}</span></li>)}</ul>
      {description && !compact && <p className="bundle-desc">{description}</p>}
      <div className="bundle-price"><strong>{moneyIqd(bundle.priceIqd)}</strong>{bundle.savingIqd > 0 && <s>{moneyIqd(bundle.regularIqd)}</s>}</div>
      {bundle.savingIqd > 0 && <p className="bundle-saving">{ar ? `توفّر ${moneyIqd(bundle.savingIqd)} مقارنة بشراء القطع لوحدها` : `You save ${moneyIqd(bundle.savingIqd)} versus buying separately`}</p>}
      <button type="button" className="button button-orange bundle-add" disabled={soldOut || adding} onClick={() => void add()}>{adding ? <LoaderCircle size={16} className="spin" /> : <ShoppingBag size={16} />} {soldOut ? (ar ? 'نفد حالياً' : 'Sold out') : (ar ? 'أضف البكج للسلة' : 'Add bundle to bag')}</button>
    </div>
  </article>;
}

export function BundlesSection({ bundles, title, subtitle }: { bundles: BundleView[]; title?: string; subtitle?: string }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  if (!bundles.length) return null;
  return <section className="section bundles-section" id="bundles">
    <div className="section-heading"><div><span className="eyebrow">{subtitle ?? (ar ? 'أكثر قيمة' : 'Better together')}</span><h2>{title ?? (ar ? 'بكجات بسعر أقل' : 'Bundles that save you more')}</h2></div>{bundles.length > 2 && <Link className="text-link" href="/bundles">{ar ? 'كل البكجات' : 'All bundles'}</Link>}</div>
    <div className="bundles-grid">{bundles.map(b => <BundleCard key={b.id} bundle={b} />)}</div>
  </section>;
}
