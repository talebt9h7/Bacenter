'use client';
import { ArrowLeft, ArrowRight, Gift, Tag } from 'lucide-react';
import Link from 'next/link';
import { mediaSrc } from '@/lib/types';
import type { BundleView } from '@/lib/bundles';
import { useStore } from './store-provider';
import { useLanguage } from './language-provider';

/**
 * A bundle as a picture tile: the main photo with the name over it (like the collection tiles).
 * Everything else — items, colours, price, add to bag — is on the bundle page.
 * `compact` is the small horizontal card used inside a product page.
 */
export function BundleCard({ bundle, compact = false }: { bundle: BundleView; compact?: boolean }) {
  const { moneyIqd } = useStore();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const name = ar ? bundle.nameAr || bundle.name : bundle.name;
  const pct = bundle.regularIqd > 0 ? Math.round(bundle.savingIqd / bundle.regularIqd * 100) : 0;
  const href = `/bundles/${encodeURIComponent(bundle.slug)}`;
  const image = bundle.image ?? bundle.parts[0]?.image ?? null;
  const pieces = bundle.parts.reduce((s, p) => s + p.quantity, 0);
  const Arrow = ar ? ArrowLeft : ArrowRight;
  if (compact) return <Link href={href} className="bundle-mini">
    <img src={mediaSrc(image ?? '', 240)} alt="" loading="lazy" />
    <span><b>{name}</b><small><strong>{moneyIqd(bundle.priceIqd)}</strong>{bundle.savingIqd > 0 && <s>{moneyIqd(bundle.regularIqd)}</s>}</small></span>
    {pct > 0 && <em className="bundle-mini-save" dir="ltr">-{pct}%</em>}
    <Arrow size={16} aria-hidden="true" />
  </Link>;
  return <Link href={href} className={`bundle-tile ${bundle.available <= 0 ? 'is-soldout' : ''}`} aria-label={name}>
    {image ? <img src={mediaSrc(image, 900)} alt="" loading="lazy" /> : <div className="bundle-tile-empty"><Gift size={40} /></div>}
    {pct > 0 && <span className="ur-deal-badge"><Tag size={13} strokeWidth={2.4} /><span>{ar ? 'خصم' : 'Save'}</span><b dir="ltr">{pct}%</b></span>}
    <div className="bundle-tile-text">
      <h3>{name}</h3>
      <p>{bundle.available <= 0 ? (ar ? 'نفد حالياً' : 'Sold out') : (ar ? `بكج ${pieces} قطع` : `${pieces}-piece bundle`)} <Arrow size={16} aria-hidden="true" /></p>
    </div>
  </Link>;
}

export function BundlesSection({ bundles, title, subtitle }: { bundles: BundleView[]; title?: string; subtitle?: string }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  if (!bundles.length) return null;
  return <section className="section bundles-section" id="bundles">
    <div className="section-heading"><div><span className="eyebrow">{subtitle ?? (ar ? 'أكثر قيمة' : 'Better together')}</span><h2>{title ?? (ar ? 'بكجات بسعر أقل' : 'Bundles that save you more')}</h2></div>{bundles.length > 2 && <Link className="text-link" href="/bundles">{ar ? 'كل البكجات' : 'All bundles'}</Link>}</div>
    <div className="bundles-grid bundle-tiles">{bundles.map(b => <BundleCard key={b.id} bundle={b} />)}</div>
  </section>;
}
