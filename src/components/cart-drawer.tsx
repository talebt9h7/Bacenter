'use client';
import Link from 'next/link';
import { ArrowRight, Check, LockKeyhole, Minus, Plus, ShoppingBag, Truck } from 'lucide-react';
import { useStore } from './store-provider';
import { useLanguage } from './language-provider';
import { storeT } from '@/lib/i18n';
import { Modal, ModalHeading } from './modal';

export function CartDrawer() {
  const { cartOpen, setCartOpen, cart, count, subtotal, moneyIqd, money, busy, updateQuantity, loaded, freeShippingUsd, region } = useStore();
  const { language } = useLanguage();
  const t = (label: string) => storeT(label, language);
  if (!cartOpen) return null;
  return <Modal title={t('Shopping bag')} className="drawer-overlay cart-overlay" onClose={() => setCartOpen(false)}>
    <ModalHeading title={t('Shopping bag')} count={count} onClose={() => setCartOpen(false)} />
    {cart.length > 0 ? <>
      <div className="shipping-message">{subtotal >= freeShippingUsd * region.rate ? <><Check size={17} /> {language === 'ar' ? 'طلبك مؤهل للتوصيل المجاني داخل العراق!' : 'Your order qualifies for free delivery across Iraq!'}</> : <><Truck size={18} /> {language === 'ar' ? `بقي ${money(Math.max(0, freeShippingUsd * region.rate - subtotal))} للحصول على التوصيل المجاني.` : `You’re ${money(Math.max(0, freeShippingUsd * region.rate - subtotal))} away from free delivery.`}</>}<div className="shipping-progress"><i style={{ width: `${Math.min(subtotal / (freeShippingUsd * region.rate) * 100, 100)}%` }} /></div></div>
      <div className="cart-items">{cart.map(item => <div className="cart-item" key={item.id}>
        <Link href={`/products/${item.productId}?color=${encodeURIComponent(item.color)}`} onClick={() => setCartOpen(false)}><img src={item.image} alt={`${item.name} in ${item.color}`} /></Link>
        <div className="cart-item-info"><div><Link href={`/products/${item.productId}?color=${encodeURIComponent(item.color)}`} onClick={() => setCartOpen(false)}>{item.name}</Link><span>{moneyIqd(item.salePriceIqd * item.quantity)}</span></div><p>{item.color}{item.capacity ? ` / ${item.capacity}` : ''}{item.quantity > item.stock && <strong className="stock-warning"> · {language === 'ar' ? `متبقي ${item.stock} فقط` : `only ${item.stock} left`}</strong>}</p><div className="cart-item-actions"><div className="quantity-control"><button disabled={busy} aria-label={`Decrease ${item.name} quantity`} onClick={() => void updateQuantity(item.id, item.quantity - 1)}><Minus size={13} /></button><span>{item.quantity}</span><button disabled={busy || item.quantity >= Math.min(10, item.stock)} aria-label={`Increase ${item.name} quantity`} onClick={() => void updateQuantity(item.id, item.quantity + 1)}><Plus size={13} /></button></div><button className="remove-link" disabled={busy} onClick={() => void updateQuantity(item.id, 0)}>{t('Remove')}</button></div></div>
      </div>)}</div>
      <div className="cart-summary"><div className="subtotal-row"><span>{t('Subtotal')}</span><strong>{moneyIqd(cart.reduce((sum, item) => sum + item.salePriceIqd * item.quantity, 0))}</strong></div><p>{language === 'ar' ? 'تُحسب أجور التوصيل عند إتمام الطلب حسب المحافظة. الدفع عند الاستلام.' : 'Delivery calculated at checkout by governorate. Cash on delivery.'}</p><Link className="button button-orange button-full" href="/checkout" onClick={() => setCartOpen(false)}>{t('Checkout')} <ArrowRight size={18} /></Link><div className="secure-note"><LockKeyhole size={13} /> {language === 'ar' ? 'دفع آمن · إرجاع خلال 30 يوماً' : 'Secure checkout · 30-day returns'}</div><button className="text-link continue-shopping" onClick={() => setCartOpen(false)}>{language === 'ar' ? 'متابعة التصفح' : 'Continue exploring'}</button></div>
    </> : <div className="empty-cart"><ShoppingBag size={49} strokeWidth={1} /><h3>{loaded ? (language === 'ar' ? 'هناك منتجات جميلة بانتظارك.' : 'Good things are waiting.') : (language === 'ar' ? 'جارٍ تحميل السلة…' : 'Loading your bag…')}</h3><p>{language === 'ar' ? <>منتجك القادم بانتظارك.<br />دعنا نجده.</> : <>Your next everyday companion is out there.<br />Let’s find it.</>}</p><Link href="/collection/bestsellers" className="button button-orange" onClick={() => setCartOpen(false)}>{language === 'ar' ? 'استعرض الأكثر مبيعاً' : 'Explore bestsellers'} <ArrowRight size={17} /></Link></div>}
  </Modal>;
}
