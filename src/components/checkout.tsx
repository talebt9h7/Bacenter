'use client';
import { groupInt, numberFormat } from '@/lib/number-format';
import { track } from '@/lib/track';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { UserRound, ArrowLeft, ArrowRight, Banknote, Check, CreditCard, CheckCircle2, ChevronDown, LoaderCircle, LockKeyhole, MapPin, MessageCircle, Package, PhoneCall, RotateCcw, ShoppingBag, Tag, Truck, X } from 'lucide-react';
import { useStore } from './store-provider';
import { mediaSrc } from '@/lib/types';
import { useLanguage } from './language-provider';
import { storeT } from '@/lib/i18n-store';
import { iraqPhonePattern, normalizeIraqPhone } from '@/lib/iraq';
import { APPEND_KEY, MY_PHONE_KEY } from '@/lib/my-orders-keys';

type Zone = { code: string; nameEn: string; nameAr: string; rate: number; minDays: number; maxDays: number };
type Config = { gateway?: { enabled: boolean; provider: 'zaincash' | 'fib' | 'alqaseh' }; zones: Zone[]; settings: { logoUrl?: string; exchangeRate: number; freeShippingThreshold: number; codFee: number; codEnabled: boolean; checkoutNote: string; supportPhone: string; whatsapp?: string | number } };
type Coupon = { code: string; discount: number; freeShipping: boolean; description: string };
type PlacedOrder = { reference: string; total: number; phone: string; governorate: string; eta: string; shipping: number; zone?: Zone; payment?: 'cod' | 'electronic'; link?: string; appended?: boolean; addedValue?: number; paid?: number };
type OpenOrder = { reference: string; createdAt: string; total: number; governorateAr: string; governorate: string; items: { quantity: number }[] };
type Saved = { name?: string; phone?: string; altPhone?: string; email?: string; governorate?: string; city?: string; address?: string; landmark?: string };

const SAVED_KEY = 'checkout-details-v1';

/** Expected delivery window as calendar dates, counting working days (Friday off). */
function deliveryWindow(zone: Zone, language: string) {
  const add = (days: number) => {
    const date = new Date();
    let left = days;
    while (left > 0) { date.setDate(date.getDate() + 1); if (date.getDay() !== 5) left--; }
    return date;
  };
  const fmt = (date: Date) => date.toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const from = add(zone.minDays), to = add(zone.maxDays);
  return zone.minDays === zone.maxDays ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
}

/** Card scheme marks shown next to electronic payment. */
function VisaMark() {
  return <svg className="cs-card-mark" viewBox="0 0 48 30" role="img" aria-label="Visa"><rect width="48" height="30" rx="5" fill="#fff" stroke="#e3e0da" /><text x="24" y="20" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="13" fill="#1a1f71" letterSpacing="-0.4">VISA</text></svg>;
}
function MastercardMark() {
  return <svg className="cs-card-mark" viewBox="0 0 48 30" role="img" aria-label="Mastercard"><rect width="48" height="30" rx="5" fill="#fff" stroke="#e3e0da" /><circle cx="19.5" cy="15" r="8" fill="#eb001b" /><circle cx="28.5" cy="15" r="8" fill="#f79e1b" /><path d="M24 8.4a8 8 0 0 1 0 13.2a8 8 0 0 1 0-13.2z" fill="#ff5f00" /></svg>;
}

function readSaved(): Saved {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '{}') as Saved; } catch { return {}; }
}

export function Checkout({ initialConfig = null }: { initialConfig?: Config | null } = {}) {
  const { cart, loaded, refreshCart, setCartOpen } = useStore();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const iqd = (value: number) => ar ? `${groupInt(value)} د.ع` : numberFormat('en-IQ', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(value);
  const t = (label: string) => storeT(label, language);
  const [config, setConfig] = useState<Config | null>(initialConfig);
  const [governorate, setGovernorate] = useState('');
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [order, setOrder] = useState<PlacedOrder | null>(null);
  // Three steps on one form: 1 contact, 2 delivery, 3 payment. Earlier steps can always be reopened;
  // later ones only once the steps before them are filled in.
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [contact, setContact] = useState({ name: '', phone: '' });
  const [place, setPlace] = useState({ city: '', landmark: '' });
  // An order of this phone that has not shipped yet: the bag can join it with no second delivery fee.
  const [openOrder, setOpenOrder] = useState<OpenOrder | null>(null);
  const [appendTo, setAppendTo] = useState('');
  const lookedUp = useRef('');
  async function lookupOpen(raw: string) {
    const phone = normalizeIraqPhone(raw);
    if (!iraqPhonePattern.test(phone) || lookedUp.current === phone) return;
    lookedUp.current = phone;
    try {
      const response = await fetch('/api/my-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
      const data = await response.json() as { orders?: (OpenOrder & { canAdd: boolean })[] };
      if (lookedUp.current !== phone) return;
      const open = data.orders?.find(o => o.canAdd) ?? null;
      setOpenOrder(open);
      let wanted = ''; try { wanted = localStorage.getItem(APPEND_KEY) || ''; } catch { /* storage unavailable */ }
      setAppendTo(open && wanted === open.reference ? open.reference : '');
    } catch { /* lookup is optional */ }
  }
  const appending = !!openOrder && appendTo === openOrder.reference;
  const step1 = useRef<HTMLFieldSetElement>(null), step2 = useRef<HTMLFieldSetElement>(null), step3 = useRef<HTMLFieldSetElement>(null);
  // InitiateCheckout / begin_checkout once, when the bag has loaded with items.
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current || !cart.length) return;
    checkoutTracked.current = true;
    track.beginCheckout(cart.map(i => ({ id: i.productId, name: i.name, variant: i.color, price: i.salePriceIqd, quantity: i.quantity })));
  }, [cart]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => { if (initialConfig) return; fetch('/api/checkout').then(r => r.json()).then(setConfig).catch(() => setError(ar ? 'تعذر تحميل صفحة إتمام الطلب. حدّث الصفحة.' : 'Checkout could not be loaded. Please refresh.')); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- load once
  // Returning customers: fill in the details they used last time (kept only in their browser).
  useEffect(() => {
    if (!config) return;
    const frame = requestAnimationFrame(() => {
      const form = formRef.current; if (!form) return;
      const saved = readSaved();
      for (const [key, value] of Object.entries(saved)) {
        const field = form.elements.namedItem(key) as HTMLInputElement | null;
        if (field && value && !field.value && key !== 'governorate') field.value = value;
      }
      if (saved.governorate && config.zones.some(z => z.code === saved.governorate)) setGovernorate(current => current || saved.governorate!);
      let phone = saved.phone || ''; try { phone = phone || localStorage.getItem(MY_PHONE_KEY) || ''; } catch { /* storage unavailable */ }
      if (phone) { const field = form.elements.namedItem('phone') as HTMLInputElement | null; if (field && !field.value) field.value = phone; void lookupOpen(field?.value || phone); }
    });
    return () => cancelAnimationFrame(frame);
  }, [config, cart.length]);

  const lines = useMemo(() => cart.map(item => ({ ...item, unit: item.salePriceIqd, label: ar ? (item.nameAr || item.name) : item.name, colorLabel: ar ? (item.colorAr || item.color) : item.color })), [cart, ar]);
  const units = lines.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = lines.reduce((sum, item) => sum + item.unit * item.quantity, 0);
  const zone = config?.zones.find(item => item.code === governorate);
  const threshold = config?.settings.freeShippingThreshold ?? 0;
  const freeByThreshold = threshold > 0 && subtotal >= threshold;
  const freeShipping = freeByThreshold || Boolean(coupon?.freeShipping);
  const shipping = appending ? 0 : zone ? (freeShipping ? 0 : zone.rate) : 0;
  const discount = coupon && !appending ? Math.min(coupon.discount, subtotal) : 0;
  const [payment, setPayment] = useState<'cod' | 'electronic'>('cod');
  const isCard = !!config?.gateway?.enabled && config.gateway.provider === 'alqaseh';
  // Electronic payment with the gateway on: the button takes the shopper to the payment page.
  const payOnline = !appending && payment === 'electronic' && !!config?.gateway?.enabled;
  const codFee = !appending && payment === 'cod' ? (config?.settings.codFee ?? 0) : 0;
  const total = Math.max(0, subtotal - discount) + shipping + codFee;
  const promoSavings = cart.reduce((sum, item) => sum + Math.max(0, (item.originalPriceIqd ?? item.salePriceIqd) - item.salePriceIqd) * item.quantity, 0);
  const savings = discount + promoSavings + (zone && freeShipping ? zone.rate : 0);
  const cheapestZone = config?.zones.reduce((min, z) => Math.min(min, z.rate), Infinity) ?? 0;
  const whatsapp = String(config?.settings.whatsapp ?? '').replace(/\D/g, '');

  async function applyCoupon() {
    setCheckingCoupon(true); setCouponError('');
    try { const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: couponInput, subtotal }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setCoupon(data); }
    catch (err) { setCoupon(null); setCouponError(err instanceof Error ? err.message : (ar ? 'تعذر تطبيق القسيمة.' : 'Coupon could not be applied.')); }
    finally { setCheckingCoupon(false); }
  }
  function checkPhone(value: string) {
    const phone = normalizeIraqPhone(value);
    setPhoneError(!phone || iraqPhonePattern.test(phone) ? '' : (ar ? 'رقم الموبايل لازم يبدأ بـ 07 ويتكون من 11 رقم، مثل 07701234567' : 'Use an Iraqi mobile number: 11 digits starting with 07, e.g. 07701234567'));
  }
  /** First invalid field of a step (or null). Phone numbers must be Iraqi mobiles. */
  function invalidIn(n: 1 | 2 | 3): HTMLInputElement | HTMLSelectElement | null {
    const fields = Array.from((n === 1 ? step1 : n === 2 ? step2 : step3).current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select') ?? []);
    for (const field of fields) {
      if (field.name === 'phone') { const phone = normalizeIraqPhone(field.value); if (!iraqPhonePattern.test(phone)) { checkPhone(field.value || 'x'); return field; } }
      if (!field.checkValidity()) return field;
    }
    return null;
  }
  function remember() {
    const form = formRef.current; if (!form) return;
    const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value.trim() ?? '';
    setContact({ name: value('name'), phone: normalizeIraqPhone(value('phone')) });
    setPlace({ city: value('city'), landmark: value('landmark') });
  }
  function goTo(target: 1 | 2 | 3) {
    setError('');
    for (let n = 1 as 1 | 2 | 3; n < target; n = (n + 1) as 1 | 2 | 3) {
      if (n === 2 && appending) continue;
      const bad = invalidIn(n);
      if (bad) { setStep(n); requestAnimationFrame(() => { bad.reportValidity(); bad.focus(); }); return false; }
    }
    remember();
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting) return; setError('');
    if (step < 3) { goTo(appending ? 3 : (step + 1) as 2 | 3); return; }
    if (!goTo(3)) return;
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    data.phone = normalizeIraqPhone(data.phone || ''); data.altPhone = normalizeIraqPhone(data.altPhone || '');
    if (!iraqPhonePattern.test(data.phone)) { checkPhone(data.phone); (event.currentTarget.elements.namedItem('phone') as HTMLInputElement)?.focus(); return; }
    setSubmitting(true);
    try {
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, ...(appending ? { appendTo, payment: 'cod' } : {}), coupon: appending ? '' : coupon?.code ?? '' }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      try { const { note: _note, payment: _payment, ...keep } = data; void _note; void _payment; if (!appending) localStorage.setItem(SAVED_KEY, JSON.stringify(keep)); localStorage.setItem(MY_PHONE_KEY, data.phone); localStorage.removeItem(APPEND_KEY); } catch { /* storage unavailable */ }
      // Online gateway: go to the payment page (ZainCash directly, FIB via our QR page).
      if (payment === 'electronic' && result.payment?.url) {
        track.purchase(result.order.reference, result.order.total, (result.order.items ?? []).map((i: { productId: string; name: string; color: string; unitPrice: number; quantity: number }) => ({ id: i.productId, name: i.name, variant: i.color, price: i.unitPrice, quantity: i.quantity })), { shipping: result.order.shipping });
        window.location.assign(result.payment.redirectUrl || result.payment.url);
        return;
      }
      if (result.appended) { setOrder({ ...result.order, appended: true }); await refreshCart(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      setOrder({ ...result.order, zone, payment });
      track.purchase(result.order.reference, result.order.total, (result.order.items ?? []).map((i: { productId: string; name: string; color: string; unitPrice: number; quantity: number }) => ({ id: i.productId, name: i.name, variant: i.color, price: i.unitPrice, quantity: i.quantity })), { shipping: result.order.shipping, coupon: coupon?.code }); await refreshCart(); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { setError(err instanceof Error ? err.message : (ar ? 'تحقق من الاتصال وحاول مرة أخرى.' : 'Please check your connection and try again.')); }
    finally { setSubmitting(false); }
  }

  if (order?.appended) return <main className="checkout-page co-page"><section className="co-success">
    <CheckCircle2 size={56} strokeWidth={1.2} aria-hidden="true" />
    <h1>{ar ? 'تمت الإضافة على طلبك' : 'Added to your order'}</h1>
    <p className="co-success-ref">{ar ? 'رقم الطلب' : 'Order number'} <strong>{order.reference}</strong></p>
    <ol className="co-timeline">
      <li className="is-done"><Check size={15} aria-hidden="true" /><div><strong>{ar ? `أضفنا ${iqd(order.addedValue ?? 0)} على الطلب` : `${iqd(order.addedValue ?? 0)} added to the order`}</strong><span>{ar ? 'بدون أجور توصيل إضافية' : 'No extra delivery fee'}</span></div></li>
      <li><Banknote size={15} aria-hidden="true" /><div><strong>{ar ? `مجموع الطلب الآن ${iqd(order.total)}` : `Order total is now ${iqd(order.total)}`}</strong><span>{order.paid ? (ar ? `مدفوع مسبقاً ${iqd(order.paid)} · تدفع ${iqd(Math.max(0, order.total - order.paid))} عند الاستلام` : `${iqd(order.paid)} already paid · ${iqd(Math.max(0, order.total - order.paid))} on delivery`) : (ar ? 'تدفع المبلغ كامل عند الاستلام' : 'Pay the full amount on delivery')}</span></div></li>
      <li><Truck size={15} aria-hidden="true" /><div><strong>{ar ? 'يوصلك ويا نفس الطلب' : 'Arrives with the same order'}</strong><span>{ar ? 'نفس العنوان ونفس موعد التوصيل' : 'Same address and delivery window'}</span></div></li>
    </ol>
    <div className="co-success-actions">
      {order.link && <Link className="co-secondary" href={order.link}><Package size={16} aria-hidden="true" /> {ar ? 'تابع طلبك' : 'Track your order'}</Link>}
      <Link className="co-primary" href="/">{ar ? 'متابعة التسوق' : 'Keep shopping'} {ar ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}</Link>
    </div>
  </section></main>;

  if (order) return <main className="checkout-page co-page"><section className="co-success">
    <CheckCircle2 size={56} strokeWidth={1.2} aria-hidden="true" />
    <h1>{ar ? 'تم استلام طلبك، شكراً لك!' : 'Thank you — your order is in!'}</h1>
    <p className="co-success-ref">{ar ? 'رقم الطلب' : 'Order number'} <strong>{order.reference}</strong></p>
    <ol className="co-timeline">
      <li className="is-done"><Check size={15} aria-hidden="true" /><div><strong>{ar ? 'استلمنا الطلب' : 'Order received'}</strong><span>{ar ? 'الآن' : 'Just now'}</span></div></li>
      <li><PhoneCall size={15} aria-hidden="true" /><div><strong>{ar ? 'نتصل بك للتأكيد' : 'We call to confirm'}</strong><span>{ar ? <>على الرقم <bdi>{order.phone}</bdi> قبل الشحن</> : <>On <bdi>{order.phone}</bdi> before dispatch</>}</span></div></li>
      <li><Truck size={15} aria-hidden="true" /><div><strong>{ar ? 'التوصيل' : 'Delivery'}</strong><span>{order.zone ? `${ar ? order.zone.nameAr : order.zone.nameEn} · ${deliveryWindow(order.zone, language)}` : (ar ? `إلى ${order.governorate}` : `To ${order.governorate} in ${order.eta}`)}</span></div></li>
      <li><Banknote size={15} aria-hidden="true" /><div><strong>{order.payment === 'electronic' ? (ar ? `نرسل لك رابط دفع ${iqd(order.total)}` : `We will send a payment link for ${iqd(order.total)}`) : (ar ? `تدفع ${iqd(order.total)} عند الاستلام` : `Pay ${iqd(order.total)} on delivery`)}</strong><span>{order.shipping === 0 ? (ar ? 'التوصيل مجاني' : 'Delivery is free') : (ar ? `يشمل ${iqd(order.shipping)} أجور التوصيل` : `Includes ${iqd(order.shipping)} delivery`)}</span></div></li>
    </ol>
    <div className="co-success-actions">
      {order.link && <Link className="co-secondary co-track" href={order.link}><Package size={16} aria-hidden="true" /> {ar ? 'تابع طلبك' : 'Track your order'}</Link>}
      {whatsapp && <a className="co-secondary" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(ar ? `مرحباً، بخصوص طلبي رقم ${order.reference}` : `Hi, about my order ${order.reference}`)}`} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" /> {ar ? 'تابع طلبك على واتساب' : 'Follow up on WhatsApp'}</a>}
      <Link className="co-primary" href="/">{ar ? 'متابعة التسوق' : 'Keep shopping'} {ar ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}</Link>
    </div>
  </section></main>;

  if (!config) return <main className="checkout-page co-page"><div className="co-state"><LoaderCircle className="spin" size={30} /><h3>{ar ? 'جارٍ تجهيز طلبك…' : 'Getting your order ready…'}</h3>{error && <p className="co-error">{error}</p>}</div></main>;
  if (loaded && !cart.length) return <main className="checkout-page co-page"><div className="co-state"><ShoppingBag size={46} strokeWidth={1.1} /><h3>{ar ? 'سلتك فارغة' : 'Your bag is empty'}</h3><p>{ar ? 'ابدأ من الأكثر طلباً عند زبائننا.' : 'Start with what our customers order most.'}</p><Link href="/collection/bestsellers" className="co-primary">{ar ? 'تسوّق الأكثر مبيعاً' : 'Shop bestsellers'} {ar ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}</Link></div></main>;

  const summary = <>
    <ul className="co-lines">{lines.map(item => <li key={item.id}>
      <div className="co-line-image"><img src={mediaSrc(item.image, 160)} alt={`${item.label} — ${item.colorLabel}`} /><span>{item.quantity}</span></div>
      <div className="co-line-info"><strong>{item.label}</strong>{item.bundle ? <span>{item.bundle.parts.map(p => `${p.quantity > 1 ? `${p.quantity}× ` : ''}${ar ? p.nameAr || p.name : p.name}`).join(' + ')}</span> : <span>{item.colorLabel}{item.capacity ? ` · ${item.capacity}` : ''}</span>}</div>
      <span className="co-line-price">{iqd(item.unit * item.quantity)}{item.originalPriceIqd && item.originalPriceIqd > item.unit && <s className="price-was">{iqd(item.originalPriceIqd * item.quantity)}</s>}</span>
    </li>)}</ul>
    <button type="button" className="co-edit-bag" onClick={() => setCartOpen(true)}>{ar ? 'تعديل السلة' : 'Edit bag'}</button>

    <div className="co-coupon">{coupon
      ? <div className="co-coupon-applied"><Tag size={14} aria-hidden="true" /><span><strong>{coupon.code}</strong> · {coupon.description}{coupon.freeShipping ? ` · ${ar ? 'توصيل مجاني' : 'free delivery'}` : ''}</span><button type="button" aria-label={t('Remove coupon')} onClick={() => { setCoupon(null); setCouponInput(''); }}><X size={14} /></button></div>
      : couponOpen
        ? <div className="co-coupon-form"><input id="coupon" aria-label={ar ? 'رمز الخصم' : 'Coupon code'} placeholder={ar ? 'رمز الخصم' : 'Coupon code'} value={couponInput} onChange={event => setCouponInput(event.target.value.toUpperCase())} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (couponInput.trim()) void applyCoupon(); } }} autoFocus /><button type="button" disabled={!couponInput.trim() || checkingCoupon} onClick={applyCoupon}>{checkingCoupon ? <LoaderCircle size={14} className="spin" /> : (ar ? 'تطبيق' : 'Apply')}</button></div>
        : <button type="button" className="co-coupon-toggle" onClick={() => setCouponOpen(true)}><Tag size={14} aria-hidden="true" /> {ar ? 'عندك رمز خصم؟' : 'Have a coupon code?'}</button>}
      {couponError && <p className="co-error">{couponError}</p>}
    </div>

    <dl className="co-totals">
      <div><dt>{ar ? `المنتجات (${units})` : `Items (${units})`}</dt><dd>{iqd(subtotal)}</dd></div>
      {promoSavings > 0 && <div className="is-saving"><dt>{ar ? 'وفّرت بالعروض (محسوبة بالأسعار)' : 'Offer savings (already in prices)'}</dt><dd>{iqd(promoSavings)}</dd></div>}
      {discount > 0 && <div className="is-saving"><dt>{ar ? 'الخصم' : 'Discount'}</dt><dd>− {iqd(discount)}</dd></div>}
      <div><dt>{ar ? 'التوصيل' : 'Delivery'}{zone && !appending ? ` · ${ar ? zone.nameAr : zone.nameEn}` : ''}</dt><dd>{appending ? <span className="co-free">{ar ? 'ويا طلبك السابق' : 'With your earlier order'}</span> : freeShipping ? <span className="co-free">{ar ? 'مجاني' : 'Free'}{zone && <s>{iqd(zone.rate)}</s>}</span> : zone ? iqd(shipping) : <span className="co-muted">{ar ? `من ${iqd(cheapestZone)}` : `from ${iqd(cheapestZone)}`}</span>}</dd></div>
      {codFee > 0 && <div><dt>{t('Cash handling')}</dt><dd>{iqd(codFee)}</dd></div>}
      <div className="co-grand"><dt>{ar ? 'المجموع' : 'Total'}</dt><dd>{iqd(total)}</dd></div>
    </dl>
    {savings > 0 && <p className="co-savings">{ar ? `وفّرت ${iqd(savings)} بهذا الطلب` : `You’re saving ${iqd(savings)} on this order`}</p>}
    {!appending && !freeShipping && threshold > subtotal && <p className="co-upsell">{ar ? <>باقي <strong>{iqd(threshold - subtotal)}</strong> على التوصيل المجاني. <button type="button" onClick={() => setCartOpen(true)}>أضف منتج</button></> : <><strong>{iqd(threshold - subtotal)}</strong> away from free delivery. <button type="button" onClick={() => setCartOpen(true)}>Add an item</button></>}</p>}
  </>;

  return <main className="checkout-page co-page cs-page">
    <header className="cs-top">
      <button type="button" className="cs-back" aria-label={ar ? 'رجوع' : 'Back'} onClick={() => (step > 1 ? goTo((step - 1) as 1 | 2) : setCartOpen(true))}>{ar ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}</button>
      <Link href="/" className="cs-brand" aria-label={ar ? 'أور للجلود' : 'UR Leather'}><img src={config.settings.logoUrl ? mediaSrc(config.settings.logoUrl, 320) : '/images/UR-logo.svg'} alt={ar ? 'أور للجلود' : 'UR Leather'} /></Link>
      <span className="cs-secure"><LockKeyhole size={13} aria-hidden="true" /> {ar ? 'آمن' : 'Secure'}</span>
    </header>

    <div className="co-layout">
      <form ref={formRef} className="co-form cs-form" onSubmit={submit} noValidate>
        <h1 className="cs-title">{ar ? 'إتمام الطلب' : 'Checkout'}</h1>
        <nav className="cs-stepper" aria-label={ar ? 'مراحل الطلب' : 'Checkout steps'}>
          <ol>{([[1, ar ? 'معلوماتك' : 'Contact', UserRound], [2, ar ? 'التوصيل' : 'Delivery', Truck], [3, ar ? 'الدفع' : 'Payment', CreditCard]] as const).map(([n, label, Icon]) =>
            <li key={n} className={n < step ? 'is-done' : n === step ? 'is-current' : ''}>
              <button type="button" onClick={() => goTo(n)} aria-current={n === step ? 'step' : undefined}><span className="cs-dot">{n < step ? <Check size={16} strokeWidth={2.6} /> : <Icon size={16} />}</span><span className="cs-label">{label}</span></button>
            </li>)}</ol>
          <p>{ar ? <>الخطوة <b>{step} من 3</b> · {step === 1 ? 'معلوماتك' : step === 2 ? 'التوصيل' : 'الدفع'}</> : <>Step <b>{step} of 3</b> · {step === 1 ? 'Contact' : step === 2 ? 'Delivery' : 'Payment'}</>}</p>
        </nav>

        <fieldset ref={step1} className="cs-step" hidden={step !== 1}>
          <h2 className="cs-h">{ar ? 'معلومات التواصل' : 'Contact details'}</h2>
          <div className="co-field"><label htmlFor="name">{ar ? 'الاسم الكامل' : 'Full name'}</label><input id="name" name="name" autoComplete="name" maxLength={100} minLength={2} required /></div>
          <div className="co-field"><label htmlFor="phone">{ar ? 'رقم الموبايل' : 'Mobile number'}</label><input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="07XX XXX XXXX" maxLength={20} required aria-invalid={Boolean(phoneError)} aria-describedby="phone-help" onBlur={event => { checkPhone(event.target.value); void lookupOpen(event.target.value); }} onChange={() => phoneError && setPhoneError('')} /><small id="phone-help" className={phoneError ? 'co-error' : ''}>{phoneError}</small></div>
          <div className="co-field"><label htmlFor="altPhone">{ar ? 'رقم ثاني (اختياري)' : 'Second number (optional)'}</label><input id="altPhone" name="altPhone" type="tel" inputMode="tel" dir="ltr" placeholder="07XX XXX XXXX" maxLength={20} /></div>
          {openOrder && <div className="cs-append" role="radiogroup" aria-label={ar ? 'عندك طلب ما انشحن' : 'You have an order that has not shipped'}>
            <p className="cs-append-q"><Package size={18} aria-hidden="true" /> <span>{ar ? <>عندك طلب ما انشحن (<bdi>{openOrder.reference}</bdi>)، تريد نضيف هاي المنتجات عليه بدون توصيل؟</> : <>Your order <bdi>{openOrder.reference}</bdi> has not shipped yet. Add these items to it with no delivery fee?</>}</span></p>
            <label className={`cs-option ${appending ? 'is-on' : ''}`}><input type="radio" name="appendChoice" checked={appending} onChange={() => setAppendTo(openOrder.reference)} /><span className="cs-radio" aria-hidden="true" /><div><strong>{ar ? 'أضفها على طلبي' : 'Add to my order'}</strong><span>{ar ? `توصل ويا نفس الطلب · بدون أجور توصيل` : 'Arrives with the same order · no delivery fee'}</span></div></label>
            <label className={`cs-option ${!appending ? 'is-on' : ''}`}><input type="radio" name="appendChoice" checked={!appending} onChange={() => setAppendTo('')} /><span className="cs-radio" aria-hidden="true" /><div><strong>{ar ? 'طلب جديد منفصل' : 'A separate new order'}</strong><span>{ar ? 'لعنوان أو موعد ثاني' : 'For another address or time'}</span></div></label>
          </div>}
          <h2 className="cs-h">{ar ? 'طلبك' : 'Your order'}</h2>
          <ul className="cs-lines">{!loaded && <li className="cs-skeleton" aria-hidden="true"><span /><div><i /><i /></div></li>}{lines.map(item => <li key={item.id}>
            <img src={mediaSrc(item.image, 160)} alt="" />
            <div><strong>{item.label}</strong><span>{item.bundle ? (ar ? 'باكج' : 'Bundle') : item.colorLabel} · {ar ? `العدد ${item.quantity}` : `Qty ${item.quantity}`}</span></div>
            <b>{iqd(item.unit * item.quantity)}</b>
          </li>)}</ul>
          <button type="button" className="cs-link" onClick={() => setCartOpen(true)}>{ar ? 'تعديل السلة' : 'Edit bag'}</button>
        </fieldset>

        <fieldset ref={step2} className="cs-step" hidden={step !== 2}>
          <div className="cs-h-row"><h2 className="cs-h">{ar ? 'المستلم' : 'Recipient'}</h2><button type="button" className="cs-link" onClick={() => goTo(1)}>{ar ? 'تعديل' : 'Edit'}</button></div>
          <div className="cs-card"><span className="cs-card-icon"><UserRound size={17} /></span><div><strong>{contact.name || '—'}</strong><span dir="ltr">{contact.phone}</span></div></div>
          <h2 className="cs-h">{ar ? 'عنوان التوصيل' : 'Delivery address'}</h2>
          <div className="co-field"><label htmlFor="governorate">{ar ? 'المحافظة' : 'Governorate'}</label><select id="governorate" name="governorate" required value={governorate} onChange={event => setGovernorate(event.target.value)}><option value="">{ar ? 'اختر المحافظة' : 'Choose your governorate'}</option>{config.zones.map(item => <option key={item.code} value={item.code}>{ar ? item.nameAr : item.nameEn}</option>)}</select></div>
          <div className="co-field"><label htmlFor="city">{ar ? 'المنطقة' : 'Area'}</label><input id="city" name="city" autoComplete="address-level2" placeholder={ar ? 'مثال: الكرادة، المنصور' : 'e.g. Karrada, Mansour'} maxLength={120} required /></div>
          <div className="co-field"><label htmlFor="landmark">{ar ? 'أقرب نقطة دالة (اختياري)' : 'Nearest landmark (optional)'}</label><input id="landmark" name="landmark" placeholder={ar ? 'مثال: قرب جامع…' : 'e.g. near … mosque'} maxLength={200} /></div>
          {zone && <><h2 className="cs-h">{ar ? 'التوصيل' : 'Delivery'}</h2>
            <div className="cs-option is-on"><span className="cs-radio" aria-hidden="true" /><div><strong>{ar ? `توصيل إلى ${zone.nameAr}` : `Delivery to ${zone.nameEn}`}</strong></div><b>{freeShipping ? (ar ? 'مجاني' : 'Free') : iqd(zone.rate)}</b></div></>}
        </fieldset>

        <fieldset ref={step3} className="cs-step" hidden={step !== 3}>
          {appending && openOrder ? <>
            <div className="cs-h-row"><h2 className="cs-h">{ar ? 'تنضاف على الطلب' : 'Added to order'}</h2><button type="button" className="cs-link" onClick={() => goTo(1)}>{ar ? 'تغيير' : 'Change'}</button></div>
            <div className="cs-card"><span className="cs-card-icon"><Package size={17} /></span><div><strong dir="ltr">{openOrder.reference}</strong><span>{ar ? `توصل ويا نفس الطلب إلى ${openOrder.governorateAr || openOrder.governorate} · الدفع عند الاستلام` : `Arrives with the same order to ${openOrder.governorate} · cash on delivery`}</span><span dir="ltr">{contact.phone}</span></div></div>
          </> : <>
          <div className="cs-h-row"><h2 className="cs-h">{ar ? 'يوصل إلى' : 'Deliver to'}</h2><button type="button" className="cs-link" onClick={() => goTo(2)}>{ar ? 'تعديل' : 'Edit'}</button></div>
          <div className="cs-card"><span className="cs-card-icon"><MapPin size={17} /></span><div><strong>{contact.name || '—'}</strong><span>{[zone ? (ar ? zone.nameAr : zone.nameEn) : '', place.city, place.landmark].filter(Boolean).join('، ')}</span><span dir="ltr">{contact.phone}</span></div></div>
          </>}
          {!appending && <>
          <h2 className="cs-h">{ar ? 'طريقة الدفع' : 'Payment method'}</h2>
          <div className="cs-pay" role="radiogroup">
            <label className={`cs-option ${payment === 'cod' ? 'is-on' : ''}`}><input type="radio" name="payment" value="cod" checked={payment === 'cod'} onChange={() => setPayment('cod')} /><span className="cs-radio" aria-hidden="true" /><div><strong>{ar ? 'الدفع عند الاستلام' : 'Cash on delivery'}</strong>{config?.settings.codFee ? <span>{ar ? `تُضاف ${iqd(config.settings.codFee)} رسوم.` : `A ${iqd(config.settings.codFee)} fee applies.`}</span> : null}</div><Banknote size={20} aria-hidden="true" /></label>
            <label className={`cs-option ${payment === 'electronic' ? 'is-on' : ''}`}><input type="radio" name="payment" value="electronic" checked={payment === 'electronic'} onChange={() => setPayment('electronic')} /><span className="cs-radio" aria-hidden="true" /><div><strong>{ar ? 'الدفع الإلكتروني' : 'Electronic payment'}</strong>{isCard && <span className="cs-cards" aria-label="Visa, Mastercard"><VisaMark /><MastercardMark /></span>}</div><CreditCard size={20} aria-hidden="true" /></label>
          </div>
          <div className="co-coupon">{coupon
            ? <div className="co-coupon-applied"><Tag size={14} aria-hidden="true" /><span><strong>{coupon.code}</strong> · {coupon.description}</span><button type="button" onClick={() => { setCoupon(null); setCouponInput(''); }} aria-label={ar ? 'إزالة' : 'Remove'}><X size={14} /></button></div>
            : couponOpen
              ? <div className="co-coupon-form"><input aria-label={ar ? 'رمز الخصم' : 'Coupon code'} placeholder={ar ? 'رمز الخصم' : 'Coupon code'} value={couponInput} onChange={e => setCouponInput(e.target.value)} /><button type="button" disabled={!couponInput || checkingCoupon} onClick={() => void applyCoupon()}>{checkingCoupon ? <LoaderCircle size={14} className="spin" /> : (ar ? 'تطبيق' : 'Apply')}</button></div>
              : <button type="button" className="co-coupon-toggle" onClick={() => setCouponOpen(true)}><Tag size={14} aria-hidden="true" /> {ar ? 'عندك رمز خصم؟' : 'Have a coupon code?'}</button>}
            {couponError && <p className="co-error">{couponError}</p>}
          </div>
          </>}
          <dl className="cs-totals">
            <div><dt>{ar ? `المنتجات (${units})` : `Items (${units})`}</dt><dd>{iqd(subtotal)}</dd></div>
            {discount > 0 && <div className="is-saving"><dt>{ar ? 'الخصم' : 'Discount'}</dt><dd>− {iqd(discount)}</dd></div>}
            <div><dt>{ar ? 'التوصيل' : 'Delivery'}{appending ? '' : zone ? ` · ${ar ? zone.nameAr : zone.nameEn}` : ''}</dt><dd>{appending ? (ar ? 'بدون · ويا طلبك السابق' : 'None · with your earlier order') : freeShipping ? (ar ? 'مجاني' : 'Free') : iqd(shipping)}</dd></div>
            {codFee > 0 && <div><dt>{t('Cash handling')}</dt><dd>{iqd(codFee)}</dd></div>}
            <div className="cs-grand"><dt>{appending ? (ar ? 'المبلغ المضاف' : 'Amount added') : (ar ? 'المجموع الكلي' : 'Total')}</dt><dd>{iqd(total)}</dd></div>
          </dl>
          <p className="co-legal">{t('By continuing, you agree to our')} <Link href="/info/terms">{ar ? 'الشروط والأحكام' : 'terms & conditions'}</Link>.</p>
        </fieldset>

        {error && <p className="co-error co-error-box" role="alert">{error}</p>}
        <div className="cs-bar">
          <div className="cs-bar-info"><span>{step < 3 ? <>{ar ? 'التالي: ' : 'Next: '}<b>{appending ? (ar ? 'التأكيد' : 'Confirm') : step === 1 ? (ar ? 'التوصيل' : 'Delivery') : (ar ? 'الدفع' : 'Payment')}</b></> : <>{ar ? 'الخطوة الأخيرة' : 'Last step'}</>}</span><span>{ar ? 'المجموع ' : 'Total '}<b>{iqd(total)}</b></span></div>
          <button type="submit" className="cs-next" disabled={submitting}>{submitting ? <><LoaderCircle size={18} className="spin" /> {payOnline ? (ar ? 'جارٍ فتح صفحة الدفع…' : 'Opening the payment page…') : appending ? (ar ? 'جارٍ الإضافة…' : 'Adding…') : (ar ? 'جارٍ تثبيت الطلب…' : 'Placing your order…')}</>
            : step === 1 && appending ? <>{ar ? 'متابعة للتأكيد' : 'Continue'} {ar ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}</>
            : step === 3 && appending ? <>{ar ? 'أضف على طلبي' : 'Add to my order'}</>
            : step === 1 ? <>{ar ? 'متابعة للتوصيل' : 'Continue to delivery'} {ar ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}</>
            : step === 2 ? <>{ar ? 'متابعة للدفع' : 'Continue to payment'} {ar ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}</>
            : payOnline ? <><LockKeyhole size={17} aria-hidden="true" /> {ar ? 'الانتقال إلى صفحة الدفع' : 'Continue to payment'}</> : <>{ar ? 'تأكيد الطلب' : 'Place order'}</>}</button>
        </div>
      </form>

      <aside className="co-summary" aria-label={ar ? 'ملخص الطلب' : 'Order summary'}>
        <h2><Package size={18} aria-hidden="true" /> {ar ? 'ملخص الطلب' : 'Order summary'}</h2>
        {summary}
      </aside>
    </div>
  </main>;
}
