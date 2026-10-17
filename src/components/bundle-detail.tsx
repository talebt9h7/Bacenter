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

export type BundlePartProduct = BundlePart & { subtitle: string; subtitleAr: string; description: string; descriptionAr: string; features: string[]; featuresAr: string[] };

/**
 * The bundle page, laid out like a product page: one clean gallery, the price, a colour picker for
 * every item in the bundle, one button. Under it, a card per item with its details.
 */
export function BundleDetail({ bundle, parts, others }: { bundle: BundleView; parts: BundlePartProduct[]; others: BundleView[] }) {
  const { moneyIqd, addBundleToCart, busy } = useStore();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, a: string) => ar ? a : en;
  const name = ar ? bundle.nameAr || bundle.name : bundle.name;
  const description = ar ? bundle.descriptionAr || bundle.description : bundle.description;

  // Chosen colour per item (index → variantId). Starts at the bundle's own colours.
  const [chosen, setChosen] = useState<number[]>(() => parts.map(p => p.variantId));
  const current = parts.map((p, i) => { const id = chosen[i]; const o = p.options.find(x => x.variantId === id); return o && id !== p.variantId ? { ...p, variantId: o.variantId, color: o.color, colorAr: o.colorAr, hex: o.hex, image: o.image, images: o.images, available: o.available } : p; });
  const available = current.length ? Math.min(...current.map(p => Math.floor(p.available / Math.max(1, p.quantity)))) : 0;
  const soldOut = available <= 0;

  // Gallery: the bundle photo, then each item's photos in the chosen colour (no repeats).
  const gallery = (() => {
    const out: { src: string; part: number }[] = [];
    const seen = new Set<string>();
    const push = (src: string | null | undefined, part: number) => { if (src && !seen.has(src)) { seen.add(src); out.push({ src, part }); } };
    push(bundle.image, -1);
    current.forEach((p, i) => p.images.slice(0, 4).forEach(src => push(src, i)));
    return out;
  })();
  const [index, setIndex] = useState(0);
  const safe = Math.min(index, Math.max(0, gallery.length - 1));
  const pct = bundle.regularIqd > 0 ? Math.round(bundle.savingIqd / bundle.regularIqd * 100) : 0;
  const pieces = parts.reduce((s, p) => s + p.quantity, 0);
  useEffect(() => { track.viewItem({ id: `bundle-${bundle.slug}`, name: bundle.name, price: bundle.priceIqd, category: 'bundle' }); }, [bundle.slug, bundle.name, bundle.priceIqd]);

  function pick(partIndex: number, variantId: number) {
    const next = chosen.map((v, i) => i === partIndex ? variantId : v);
    setChosen(next);
    // Show the newly chosen colour of that item.
    const option = parts[partIndex].options.find(o => o.variantId === variantId);
    const first = option?.images[0];
    if (first) { const at = gallery.findIndex(g => g.src === first); setIndex(at >= 0 ? at : (bundle.image ? 1 : 0)); }
  }
  async function add() {
    const selection: Record<string, number> = {};
    parts.forEach((p, i) => { if (chosen[i] !== p.variantId) selection[String(i)] = chosen[i]; });
    await addBundleToCart(bundle.id, 1, selection);
  }
  const partName = (p: { name: string; nameAr: string }) => ar ? p.nameAr || p.name : p.name;
  const colorName = (p: { color: string; colorAr: string }) => ar ? p.colorAr || p.color : p.color;

  return <main className="product-page bundle-page bd-page" dir={ar ? 'rtl' : 'ltr'}>
    <div className="product-detail-layout">
      <div className="product-gallery">
        <div className="product-main-image bd-main">
          {gallery.length > 0 && <img key={gallery[safe].src} src={mediaSrc(gallery[safe].src, 1280)} srcSet={mediaSrcSet(gallery[safe].src, [640, 960, 1280, 1600])} sizes="(max-width: 767px) 100vw, 60vw" alt={name} fetchPriority="high" />}
          {pct > 0 && <span className="ur-deal-badge"><Tag size={14} strokeWidth={2.4} /><span>{tt('Save', 'خصم')}</span><b dir="ltr">{pct}%</b></span>}
          {gallery[safe]?.part >= 0 && <span className="bd-photo-label">{partName(current[gallery[safe].part])} · {colorName(current[gallery[safe].part])}</span>}
        </div>
        {gallery.length > 1 && <div className="product-thumbnails">{gallery.map((g, i) => <button key={g.src} className={safe === i ? 'selected' : ''} onClick={() => setIndex(i)} aria-label={`${tt('Photo', 'صورة')} ${i + 1}`} aria-pressed={safe === i}><img src={mediaSrc(g.src, 160)} alt="" /></button>)}</div>}
      </div>

      <div className="product-buy-box">
        <div className="product-heading">
          <span className="bundle-eyebrow"><Gift size={14} /> {tt(`Bundle · ${pieces} pieces`, `بكج · ${pieces} قطع`)}</span>
          <h1>{name}</h1>
          <div className="bundle-price-block">
            <div className="bundle-price-row"><strong className="bundle-price-now">{moneyIqd(bundle.priceIqd)}</strong>{bundle.savingIqd > 0 && <s className="bundle-price-was">{moneyIqd(bundle.regularIqd)}</s>}</div>
            {bundle.savingIqd > 0 && <div className="ur-deal-strip"><span className="ur-deal-chip"><b dir="ltr">-{pct}%</b></span><span>{ar ? <>وفّرت <b>{moneyIqd(bundle.savingIqd)}</b> بهذا البكج</> : <>You save <b>{moneyIqd(bundle.savingIqd)}</b> with this bundle</>}</span></div>}
          </div>
        </div>

        <div className="bd-pick">
          <h2>{tt('Choose your colours', 'اختر الألوان')}</h2>
          {current.map((p, i) => <div className="bd-pick-item" key={`${parts[i].variantId}-${i}`}>
            <div className="bd-pick-head">
              <img src={mediaSrc(p.image ?? '', 160)} alt="" />
              <span><b>{p.quantity > 1 && `${p.quantity}× `}{partName(p)}</b><small>{tt('Colour', 'اللون')}: <strong>{colorName(p)}</strong>{p.available <= 0 && <em> · {tt('sold out', 'نفد')}</em>}</small></span>
              {i < current.length - 1 && <i className="bd-plus" aria-hidden="true"><Plus size={12} /></i>}
            </div>
            {p.options.length > 1 && <div className="bd-swatches" role="radiogroup" aria-label={`${partName(p)} — ${tt('colour', 'اللون')}`}>
              {p.options.map(o => <button key={o.variantId} type="button" role="radio" aria-checked={chosen[i] === o.variantId} className={`${chosen[i] === o.variantId ? 'is-on' : ''} ${o.available < p.quantity ? 'is-out' : ''}`} disabled={o.available < p.quantity} title={`${colorName(o)}${o.available < p.quantity ? ` — ${tt('sold out', 'نفد')}` : ''}`} onClick={() => pick(i, o.variantId)}>
                {o.image ? <img src={mediaSrc(o.image, 160)} alt="" /> : <span style={{ background: o.hex }} />}
                <small>{colorName(o)}</small>
              </button>)}
            </div>}
          </div>)}
        </div>

        <div className="buy-actions">
          <button className="button button-orange product-add-to-cart" disabled={busy || soldOut} onClick={() => void add()}>{soldOut ? tt('These colours are sold out', 'هالألوان نفدت حالياً') : tt('Add bundle to bag', 'أضف البكج للسلة')}</button>
        </div>
        {!soldOut && available <= 5 && <p className="bundle-stock-note">{tt(`Only ${available} left in these colours`, `بقي ${available} فقط بهالألوان`)}</p>}
        {description && <p className="product-description">{description}</p>}
        <ul className="bundle-perks">
          <li><i><ShieldCheck size={18} /></i><span><b>{tt('3-year warranty', 'ضمان 3 سنوات')}</b><small>{tt('On every piece', 'على كل قطعة')}</small></span></li>
          <li><i><BadgeCheck size={18} /></i><span><b>{tt('100% natural leather', 'جلد طبيعي 100%')}</b><small>{tt('Handmade', 'صناعة يدوية')}</small></span></li>
          <li><i><Truck size={18} /></i><span><b>{tt('Delivery across Iraq', 'توصيل لكل العراق')}</b><small>{tt('Cash on delivery', 'الدفع عند الاستلام')}</small></span></li>
        </ul>
      </div>
    </div>

    <section className="bd-items" aria-label={tt('In this bundle', 'داخل البكج')}>
      <h2>{tt('In this bundle', 'داخل البكج')}</h2>
      <div className="bd-items-grid">{parts.map((base, i) => { const p = current[i]; const sub = ar ? base.subtitleAr || base.subtitle : base.subtitle; const desc = ar ? base.descriptionAr || base.description : base.description; const feats = (ar && base.featuresAr.length ? base.featuresAr : base.features).filter(Boolean).slice(0, 4); return <article key={`${base.variantId}-${i}`} className="bd-item">
        <div className="bd-item-img">{p.image && <img src={mediaSrc(p.image, 800)} alt={`${partName(p)} — ${colorName(p)}`} loading="lazy" />}{p.quantity > 1 && <span className="bd-item-qty">×{p.quantity}</span>}</div>
        <div className="bd-item-body">
          <span className="bd-item-color"><i style={{ background: p.hex }} />{colorName(p)}</span>
          <h3>{partName(p)}</h3>
          {sub && <p className="bd-item-sub">{sub}</p>}
          {feats.length > 0 ? <ul>{feats.map(f => <li key={f}><Check size={14} /> <span>{f}</span></li>)}</ul> : desc ? <p className="bd-item-desc">{desc}</p> : null}
          <Link className="text-link" href={`/products/${p.productId}?color=${encodeURIComponent(p.color)}`}>{tt('Full product page', 'صفحة المنتج كاملة')}</Link>
        </div>
      </article>; })}</div>
    </section>

    {others.length > 0 && <section className="section bundles-section"><div className="section-heading"><h2>{tt('More bundles', 'بكجات ثانية')}</h2></div><div className="bundles-grid bundle-tiles">{others.map(b => <BundleCard key={b.id} bundle={b} />)}</div></section>}
  </main>;
}
