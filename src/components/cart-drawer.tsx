'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Minus, Plus, RotateCcw, ShoppingBag, Trash2, Truck } from 'lucide-react';
import { useStore } from './store-provider';
import { mediaSrc, primaryImage, type Product } from '@/lib/types';
import { useLanguage } from './language-provider';
import { storeT } from '@/lib/i18n-store';
import { Modal, ModalHeading } from './modal';

/**
 * Shopping bag drawer. Every figure shown is computed from the real cart and store
 * settings (IQD sale prices, the free-delivery threshold, live stock); nothing is invented
 * to create pressure.
 */
export function CartDrawer() {
  const { cartOpen, setCartOpen, cart, count, moneyIqd, busy, updateQuantity, addToCart, loaded, settings, justAdded } = useStore();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const t = (label: string) => storeT(label, language);
  const close = () => setCartOpen(false);

  // Money is in IQD throughout (sale prices are fixed in IQD).
  const subtotal = cart.reduce((sum, item) => sum + item.salePriceIqd * item.quantity, 0);
  const promoSavings = cart.reduce((sum, item) => sum + Math.max(0, (item.originalPriceIqd ?? item.salePriceIqd) - item.salePriceIqd) * item.quantity, 0);
  const threshold = settings.freeShippingThreshold;
  const remaining = Math.max(0, threshold - subtotal);
  const progress = threshold > 0 ? Math.min(100, (subtotal / threshold) * 100) : 100;
  const lowStock = settings.lowStockThreshold || 5;

  // "Complete the set": real products from the bestsellers collection that are not in the bag.
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [adding, setAdding] = useState<number | null>(null);
  useEffect(() => {
    if (!cartOpen) return;
    let cancelled = false;
    fetch('/api/products?collection=bestsellers').then(r => r.json()).then(data => { if (!cancelled) setSuggestions(data.products ?? []); }).catch(() => {});
    return () => { cancelled = true; };
  }, [cartOpen]);
  const inBag = new Set(cart.map(item => item.productId));
  // Sized products need a size choice on their page, so they are not offered as one-tap picks.
  const picks = suggestions.filter(product => !inBag.has(product.id) && !product.colors.some(c => c.size) && product.colors.some(c => c.stock > 0)).slice(0, 3);

  if (!cartOpen) return null;
  const name = (item: { name: string; nameAr: string }) => ar ? (item.nameAr || item.name) : item.name;
  const colorName = (item: { color: string; colorAr: string }) => ar ? (item.colorAr || item.color) : item.color;

  // Just added: the bag opens as a short confirmation with that item first (like a store's "Added to bag" sheet).
  const added = justAdded !== null && cart.some(item => item.variantId === justAdded && !item.bundle);
  const lines = added ? [...cart].sort((a, b) => Number(b.variantId === justAdded && !b.bundle) - Number(a.variantId === justAdded && !a.bundle)) : cart;
  const title = added ? (ar ? 'انضافت للسلة' : 'Added to bag') : t('Shopping bag');

  return <Modal title={title} className={`drawer-overlay cart-overlay bag-drawer bag-sheet${added ? ' is-added' : ''}`} onClose={close}>
    <ModalHeading title={title} count={added ? undefined : count} onClose={close} />
    {cart.length > 0 ? <>
      <div className="bag-body">

        {threshold > 0 && <div className={`bag-ship ${remaining === 0 ? 'is-unlocked' : ''}`}>
          <div className="bag-ship-head"><span className="bag-ship-icon" aria-hidden="true">{remaining === 0 ? <Check size={18} /> : <Truck size={18} />}</span>
            <p>{remaining === 0
              ? (ar ? <>حصلت على <strong>توصيل مجاني</strong></> : <>You’ve unlocked <strong>free delivery</strong></>)
              : (ar ? <>باقي <strong>{moneyIqd(remaining)}</strong> وتحصل على <strong>توصيل مجاني</strong></> : <>You’re <strong>{moneyIqd(remaining)}</strong> away from <strong>free delivery</strong></>)}</p>
          </div>
          <div className="bag-ship-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label={ar ? 'التقدم نحو التوصيل المجاني' : 'Progress to free delivery'}>
            <i className="bag-ship-fill" style={{ width: `${progress}%` }} />
            <span className="bag-ship-knob" style={{ insetInlineStart: `${progress}%` }} aria-hidden="true"><Truck size={14} /></span>
          </div>
          <div className="bag-ship-scale"><span>{moneyIqd(0)}</span><span>{moneyIqd(threshold)}</span></div>
        </div>}

        <ul className="bag-items">
          {lines.map(item => {
            const href = item.bundle ? `/bundles/${encodeURIComponent(item.bundle.slug)}` : `/products/${item.productId}?color=${encodeURIComponent(item.color)}`;
            const max = Math.min(10, item.stock);
            return <li className="bag-item" key={item.id}>
              <Link href={href} onClick={close} className="bag-item-image"><img src={mediaSrc(item.image, 320)} alt={`${name(item)} — ${colorName(item)}`} /></Link>
              <div className="bag-item-info">
                <div className="bag-item-top">
                  <Link href={href} onClick={close} className="bag-item-name">{name(item)}</Link>
                </div>
                {item.bundle ? <ul className="bag-bundle-parts">{item.bundle.parts.map(p => <li key={p.productId + p.color}>{p.quantity > 1 ? `${p.quantity}× ` : ''}{ar ? p.nameAr || p.name : p.name} — {ar ? p.colorAr || p.color : p.color}</li>)}</ul> : <p className="bag-item-meta">{colorName(item)}{item.capacity ? ` · ${item.capacity}` : ''}{item.quantity > 1 && <> · {moneyIqd(item.salePriceIqd)} {ar ? 'للقطعة' : 'each'}</>}</p>}
                {item.quantity > item.stock
                  ? <p className="bag-item-note is-warning">{ar ? `المتوفر ${item.stock} فقط، قلّل الكمية` : `Only ${item.stock} available — reduce the quantity`}</p>
                  : item.stock <= lowStock && <p className="bag-item-note">{item.bundle ? (ar ? `بقي ${item.stock} فقط من هذا البكج` : `Only ${item.stock} left of this bundle`) : (ar ? `بقي ${item.stock} فقط بهذا اللون` : `Only ${item.stock} left in this colour`)}</p>}
                <div className="bag-item-actions">
                  <strong className="bag-item-price">{moneyIqd(item.salePriceIqd * item.quantity)}{item.originalPriceIqd && item.originalPriceIqd > item.salePriceIqd && <s className="price-was">{moneyIqd(item.originalPriceIqd * item.quantity)}</s>}</strong>
                  <div className="bag-qty">
                    <button type="button" disabled={busy} aria-label={item.quantity <= 1 ? t('Remove') : ar ? 'إنقاص الكمية' : 'Decrease quantity'} onClick={() => void updateQuantity(item.id, item.quantity - 1)}>{item.quantity <= 1 ? <Trash2 size={13} /> : <Minus size={14} />}</button>
                    <span aria-live="polite">{item.quantity}</span>
                    <button type="button" disabled={busy || item.quantity >= max} aria-label={ar ? 'زيادة الكمية' : 'Increase quantity'} onClick={() => void updateQuantity(item.id, item.quantity + 1)}><Plus size={14} /></button>
                  </div>
                </div>
              </div>
            </li>;
          })}
        </ul>

        {picks.length > 0 && <section className="bag-picks" aria-label={ar ? 'منتجات مقترحة' : 'Suggested products'}>
          <h3>{ar ? 'كمّل الطقم' : 'Complete the set'}</h3>
          <ul>{picks.map(product => {
            const color = product.colors.find(c => c.stock > 0)!;
            return <li key={product.id}>
              <Link href={`/products/${product.id}`} onClick={close}><img src={mediaSrc(primaryImage(color), 320)} alt={ar ? product.nameAr || product.name : product.name} loading="lazy" /></Link>
              <div>
                <Link href={`/products/${product.id}`} onClick={close} className="bag-pick-name">{ar ? product.nameAr || product.name : product.name}</Link>
                <span>{moneyIqd(product.salePriceIqd)}{product.originalPriceIqd && <s className="price-was"> {moneyIqd(product.originalPriceIqd)}</s>}</span>
              </div>
              <button type="button" className="bag-pick-add" disabled={busy} aria-label={`${ar ? 'إضافة' : 'Add'} ${ar ? product.nameAr || product.name : product.name}`} onClick={async () => { setAdding(color.id); await addToCart(color.id); setAdding(null); }}>
                {adding === color.id ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />}
              </button>
            </li>;
          })}</ul>
        </section>}
      </div>

      <div className="bag-footer">
        {promoSavings > 0 && <div className="bag-savings"><span>{ar ? 'وفّرت بالعروض' : 'You save with offers'}</span><strong>− {moneyIqd(promoSavings)}</strong></div>}
        <div className="bag-total"><span>{t('Subtotal')}</span><strong>{moneyIqd(subtotal)}</strong></div>
        <Link className="bag-checkout" href="/checkout" onClick={close}>{ar ? 'إتمام الطلب' : 'Checkout'} {ar ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}</Link>
        <button type="button" className="bag-keep-shopping" onClick={close}>{ar ? 'متابعة التسوق' : 'Keep shopping'}</button>
      </div>
    </> : <div className="bag-empty">
      <ShoppingBag size={46} strokeWidth={1.1} aria-hidden="true" />
      <h3>{loaded ? (ar ? 'سلتك فارغة' : 'Your bag is empty') : (ar ? 'جارٍ تحميل السلة…' : 'Loading your bag…')}</h3>
      {loaded && <p>{ar ? 'ابدأ من الأكثر طلباً عند زبائننا.' : 'Start with what our customers order most.'}</p>}
      <Link href="/collection/bestsellers" className="bag-checkout" onClick={close}>{ar ? 'تسوّق الأكثر مبيعاً' : 'Shop bestsellers'} {ar ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}</Link>
    </div>}
  </Modal>;
}
