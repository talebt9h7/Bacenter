'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Banknote, Check, LoaderCircle, Minus, Plus, RotateCcw, ShoppingBag, Trash2, Truck } from 'lucide-react';
import { useStore } from './store-provider';
import { mediaSrc, primaryImage, type Product } from '@/lib/types';
import { useLanguage } from './language-provider';
import { storeT } from '@/lib/i18n';
import { Modal, ModalHeading } from './modal';

/**
 * Shopping bag drawer. Every figure shown is computed from the real cart and store
 * settings (IQD sale prices, the free-delivery threshold, live stock); nothing is invented
 * to create pressure.
 */
export function CartDrawer() {
  const { cartOpen, setCartOpen, cart, count, moneyIqd, busy, updateQuantity, addToCart, loaded, settings } = useStore();
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
  const whatsapp = String(settings.whatsapp || '').replace(/\D/g, '');

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
  const picks = suggestions.filter(product => !inBag.has(product.id) && product.colors.some(c => c.stock > 0)).slice(0, 3);

  if (!cartOpen) return null;
  const name = (item: { name: string; nameAr: string }) => ar ? (item.nameAr || item.name) : item.name;
  const colorName = (item: { color: string; colorAr: string }) => ar ? (item.colorAr || item.color) : item.color;

  return <Modal title={t('Shopping bag')} className="drawer-overlay cart-overlay bag-drawer" onClose={close}>
    <ModalHeading title={t('Shopping bag')} count={count} onClose={close} />
    {cart.length > 0 ? <>
      <div className="bag-body">
        {threshold > 0 && <div className={`bag-delivery ${remaining === 0 ? 'is-unlocked' : ''}`}>
          <p>{remaining === 0
            ? <><Check size={16} aria-hidden="true" /> {ar ? 'مبروك! حصلت على التوصيل المجاني لأي محافظة.' : 'You’ve unlocked free delivery to any governorate.'}</>
            : <><Truck size={16} aria-hidden="true" /> {ar ? <>أضف <strong>{moneyIqd(remaining)}</strong> وتحصل على توصيل مجاني</> : <>Add <strong>{moneyIqd(remaining)}</strong> for free delivery</>}</>}</p>
          <div className="bag-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label={ar ? 'التقدم نحو التوصيل المجاني' : 'Progress to free delivery'}><i style={{ width: `${progress}%` }} /></div>
        </div>}

        <ul className="bag-items">
          {cart.map(item => {
            const href = item.bundle ? `/bundles/${encodeURIComponent(item.bundle.slug)}` : `/products/${item.productId}?color=${encodeURIComponent(item.color)}`;
            const max = Math.min(10, item.stock);
            return <li className="bag-item" key={item.id}>
              <Link href={href} onClick={close} className="bag-item-image"><img src={mediaSrc(item.image, 320)} alt={`${name(item)} — ${colorName(item)}`} /></Link>
              <div className="bag-item-info">
                <div className="bag-item-top">
                  <Link href={href} onClick={close} className="bag-item-name">{name(item)}</Link>
                  <strong className="bag-item-price">{moneyIqd(item.salePriceIqd * item.quantity)}{item.originalPriceIqd && item.originalPriceIqd > item.salePriceIqd && <s className="price-was">{moneyIqd(item.originalPriceIqd * item.quantity)}</s>}</strong>
                </div>
                {item.bundle ? <ul className="bag-bundle-parts">{item.bundle.parts.map(p => <li key={p.productId + p.color}>{p.quantity > 1 ? `${p.quantity}× ` : ''}{ar ? p.nameAr || p.name : p.name} — {ar ? p.colorAr || p.color : p.color}</li>)}</ul> : <p className="bag-item-meta">{colorName(item)}{item.capacity ? ` · ${item.capacity}` : ''}{item.quantity > 1 && <> · {moneyIqd(item.salePriceIqd)} {ar ? 'للقطعة' : 'each'}</>}</p>}
                {item.quantity > item.stock
                  ? <p className="bag-item-note is-warning">{ar ? `المتوفر ${item.stock} فقط، قلّل الكمية` : `Only ${item.stock} available — reduce the quantity`}</p>
                  : item.stock <= lowStock && <p className="bag-item-note">{item.bundle ? (ar ? `بقي ${item.stock} فقط من هذا البكج` : `Only ${item.stock} left of this bundle`) : (ar ? `بقي ${item.stock} فقط بهذا اللون` : `Only ${item.stock} left in this colour`)}</p>}
                <div className="bag-item-actions">
                  <div className="bag-qty">
                    <button type="button" disabled={busy || item.quantity <= 1} aria-label={ar ? 'إنقاص الكمية' : 'Decrease quantity'} onClick={() => void updateQuantity(item.id, item.quantity - 1)}><Minus size={14} /></button>
                    <span aria-live="polite">{item.quantity}</span>
                    <button type="button" disabled={busy || item.quantity >= max} aria-label={ar ? 'زيادة الكمية' : 'Increase quantity'} onClick={() => void updateQuantity(item.id, item.quantity + 1)}><Plus size={14} /></button>
                  </div>
                  <button type="button" className="bag-remove" disabled={busy} onClick={() => void updateQuantity(item.id, 0)}><Trash2 size={14} aria-hidden="true" /> {t('Remove')}</button>
                </div>
              </div>
            </li>;
          })}
        </ul>

        {picks.length > 0 && <section className="bag-picks" aria-label={ar ? 'منتجات مقترحة' : 'Suggested products'}>
          <h3>{ar ? 'يكمّل اختيارك' : 'Goes well with your pick'}</h3>
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
        <p className="bag-total-note">{remaining === 0 ? (ar ? 'التوصيل مجاني. تدفع عند الاستلام.' : 'Delivery is free. You pay on delivery.') : (ar ? 'أجور التوصيل تُحسب حسب المحافظة. تدفع عند الاستلام.' : 'Delivery is calculated by governorate. You pay on delivery.')}</p>
        <Link className="bag-checkout" href="/checkout" onClick={close}>{ar ? 'إتمام الطلب' : 'Checkout'} <span aria-hidden="true">·</span> {moneyIqd(subtotal)} {ar ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}</Link>
        <ul className="bag-trust">
          <li><Banknote size={15} aria-hidden="true" /> {ar ? 'الدفع نقداً عند الاستلام' : 'Cash on delivery'}</li>
          <li><Truck size={15} aria-hidden="true" /> {ar ? 'لكل محافظات العراق' : 'All 18 governorates'}</li>
        </ul>
        <div className="bag-footer-links">
          <button type="button" onClick={close}>{ar ? 'متابعة التسوق' : 'Keep shopping'}</button>
          {whatsapp && <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(ar ? 'مرحباً، عندي سؤال عن طلبي قبل الإتمام.' : 'Hi, I have a question before I place my order.')}`} target="_blank" rel="noreferrer">{ar ? 'عندك سؤال؟ راسلنا واتساب' : 'Questions? WhatsApp us'}</a>}
        </div>
      </div>
    </> : <div className="bag-empty">
      <ShoppingBag size={46} strokeWidth={1.1} aria-hidden="true" />
      <h3>{loaded ? (ar ? 'سلتك فارغة' : 'Your bag is empty') : (ar ? 'جارٍ تحميل السلة…' : 'Loading your bag…')}</h3>
      {loaded && <p>{ar ? 'ابدأ من الأكثر طلباً عند زبائننا.' : 'Start with what our customers order most.'}</p>}
      <Link href="/collection/bestsellers" className="bag-checkout" onClick={close}>{ar ? 'تسوّق الأكثر مبيعاً' : 'Shop bestsellers'} {ar ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}</Link>
    </div>}
  </Modal>;
}
