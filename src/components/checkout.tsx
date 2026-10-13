'use client';
import { track } from '@/lib/track';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Banknote, Check, CheckCircle2, ChevronDown, LoaderCircle, LockKeyhole, MapPin, MessageCircle, Package, PhoneCall, RotateCcw, ShoppingBag, Tag, Truck, X } from 'lucide-react';
import { useStore } from './store-provider';
import { mediaSrc } from '@/lib/types';
import { useLanguage } from './language-provider';
import { storeT } from '@/lib/i18n';
import { iraqPhonePattern, normalizeIraqPhone } from '@/lib/iraq';

type Zone = { code: string; nameEn: string; nameAr: string; rate: number; minDays: number; maxDays: number };
type Config = { zones: Zone[]; settings: { exchangeRate: number; freeShippingThreshold: number; codFee: number; codEnabled: boolean; checkoutNote: string; supportPhone: string; whatsapp?: string | number } };
type Coupon = { code: string; discount: number; freeShipping: boolean; description: string };
type PlacedOrder = { reference: string; total: number; phone: string; governorate: string; eta: string; shipping: number; zone?: Zone };
type Saved = { name?: string; phone?: string; altPhone?: string; email?: string; governorate?: string; city?: string; address?: string; landmark?: string };

const iqd = (value: number) => new Intl.NumberFormat('en-IQ', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(value);
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

function readSaved(): Saved {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '{}') as Saved; } catch { return {}; }
}

export function Checkout() {
  const { cart, loaded, refreshCart, setCartOpen } = useStore();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const t = (label: string) => storeT(label, language);
  const [config, setConfig] = useState<Config | null>(null);
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
  // InitiateCheckout / begin_checkout once, when the bag has loaded with items.
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current || !cart.length) return;
    checkoutTracked.current = true;
    track.beginCheckout(cart.map(i => ({ id: i.productId, name: i.name, variant: i.color, price: i.salePriceIqd, quantity: i.quantity })));
  }, [cart]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => { fetch('/api/checkout').then(r => r.json()).then(setConfig).catch(() => setError(ar ? 'تعذر تحميل صفحة إتمام الطلب. حدّث الصفحة.' : 'Checkout could not be loaded. Please refresh.')); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- load once
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
  const shipping = zone ? (freeShipping ? 0 : zone.rate) : 0;
  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const codFee = config?.settings.codFee ?? 0;
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
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting) return; setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    data.phone = normalizeIraqPhone(data.phone || ''); data.altPhone = normalizeIraqPhone(data.altPhone || '');
    if (!iraqPhonePattern.test(data.phone)) { checkPhone(data.phone); (event.currentTarget.elements.namedItem('phone') as HTMLInputElement)?.focus(); return; }
    setSubmitting(true);
    try {
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, coupon: coupon?.code ?? '' }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      try { const { note: _note, payment: _payment, ...keep } = data; void _note; void _payment; localStorage.setItem(SAVED_KEY, JSON.stringify(keep)); } catch { /* storage unavailable */ }
      setOrder({ ...result.order, zone });
      track.purchase(result.order.reference, result.order.total, (result.order.items ?? []).map((i: { productId: string; name: string; color: string; unitPrice: number; quantity: number }) => ({ id: i.productId, name: i.name, variant: i.color, price: i.unitPrice, quantity: i.quantity })), { shipping: result.order.shipping, coupon: coupon?.code }); await refreshCart(); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { setError(err instanceof Error ? err.message : (ar ? 'تحقق من الاتصال وحاول مرة أخرى.' : 'Please check your connection and try again.')); }
    finally { setSubmitting(false); }
  }

  if (order) return <main className="checkout-page co-page"><section className="co-success">
    <CheckCircle2 size={56} strokeWidth={1.2} aria-hidden="true" />
    <h1>{ar ? 'تم استلام طلبك، شكراً لك!' : 'Thank you — your order is in!'}</h1>
    <p className="co-success-ref">{ar ? 'رقم الطلب' : 'Order number'} <strong>{order.reference}</strong></p>
    <ol className="co-timeline">
      <li className="is-done"><Check size={15} aria-hidden="true" /><div><strong>{ar ? 'استلمنا الطلب' : 'Order received'}</strong><span>{ar ? 'الآن' : 'Just now'}</span></div></li>
      <li><PhoneCall size={15} aria-hidden="true" /><div><strong>{ar ? 'نتصل بك للتأكيد' : 'We call to confirm'}</strong><span>{ar ? <>على الرقم <bdi>{order.phone}</bdi> قبل الشحن</> : <>On <bdi>{order.phone}</bdi> before dispatch</>}</span></div></li>
      <li><Truck size={15} aria-hidden="true" /><div><strong>{ar ? 'التوصيل' : 'Delivery'}</strong><span>{order.zone ? `${ar ? order.zone.nameAr : order.zone.nameEn} · ${deliveryWindow(order.zone, language)}` : (ar ? `إلى ${order.governorate}` : `To ${order.governorate} in ${order.eta}`)}</span></div></li>
      <li><Banknote size={15} aria-hidden="true" /><div><strong>{ar ? `تدفع ${iqd(order.total)} عند الاستلام` : `Pay ${iqd(order.total)} on delivery`}</strong><span>{order.shipping === 0 ? (ar ? 'التوصيل مجاني' : 'Delivery is free') : (ar ? `يشمل ${iqd(order.shipping)} أجور التوصيل` : `Includes ${iqd(order.shipping)} delivery`)}</span></div></li>
    </ol>
    <div className="co-success-actions">
      {whatsapp && <a className="co-secondary" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(ar ? `مرحباً، بخصوص طلبي رقم ${order.reference}` : `Hi, about my order ${order.reference}`)}`} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" /> {ar ? 'تابع طلبك على واتساب' : 'Follow up on WhatsApp'}</a>}
      <Link className="co-primary" href="/">{ar ? 'متابعة التسوق' : 'Keep shopping'} {ar ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}</Link>
    </div>
  </section></main>;

  if (!loaded || !config) return <main className="checkout-page co-page"><div className="co-state"><LoaderCircle className="spin" size={30} /><h3>{ar ? 'جارٍ تجهيز طلبك…' : 'Getting your order ready…'}</h3>{error && <p className="co-error">{error}</p>}</div></main>;
  if (!cart.length) return <main className="checkout-page co-page"><div className="co-state"><ShoppingBag size={46} strokeWidth={1.1} /><h3>{ar ? 'سلتك فارغة' : 'Your bag is empty'}</h3><p>{ar ? 'ابدأ من الأكثر طلباً عند زبائننا.' : 'Start with what our customers order most.'}</p><Link href="/collection/bestsellers" className="co-primary">{ar ? 'تسوّق الأكثر مبيعاً' : 'Shop bestsellers'} {ar ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}</Link></div></main>;

  const summary = <>
    <ul className="co-lines">{lines.map(item => <li key={item.id}>
      <div className="co-line-image"><img src={mediaSrc(item.image, 160)} alt={`${item.label} — ${item.colorLabel}`} /><span>{item.quantity}</span></div>
      <div className="co-line-info"><strong>{item.label}</strong><span>{item.colorLabel}{item.capacity ? ` · ${item.capacity}` : ''}</span></div>
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
      <div><dt>{ar ? 'التوصيل' : 'Delivery'}{zone ? ` · ${ar ? zone.nameAr : zone.nameEn}` : ''}</dt><dd>{freeShipping ? <span className="co-free">{ar ? 'مجاني' : 'Free'}{zone && <s>{iqd(zone.rate)}</s>}</span> : zone ? iqd(shipping) : <span className="co-muted">{ar ? `من ${iqd(cheapestZone)}` : `from ${iqd(cheapestZone)}`}</span>}</dd></div>
      {codFee > 0 && <div><dt>{t('Cash handling')}</dt><dd>{iqd(codFee)}</dd></div>}
      <div className="co-grand"><dt>{ar ? 'المجموع' : 'Total'}</dt><dd>{iqd(total)}</dd></div>
    </dl>
    {savings > 0 && <p className="co-savings">{ar ? `وفّرت ${iqd(savings)} بهذا الطلب` : `You’re saving ${iqd(savings)} on this order`}</p>}
    {!freeShipping && threshold > subtotal && <p className="co-upsell">{ar ? <>باقي <strong>{iqd(threshold - subtotal)}</strong> على التوصيل المجاني. <button type="button" onClick={() => setCartOpen(true)}>أضف منتج</button></> : <><strong>{iqd(threshold - subtotal)}</strong> away from free delivery. <button type="button" onClick={() => setCartOpen(true)}>Add an item</button></>}</p>}
  </>;

  return <main className="checkout-page co-page">
    <nav className="co-steps" aria-label={ar ? 'مراحل الطلب' : 'Checkout steps'}>
      <button type="button" className="is-done" onClick={() => setCartOpen(true)}><Check size={13} aria-hidden="true" /> {ar ? 'السلة' : 'Bag'}</button>
      <span className="is-current" aria-current="step">2 · {ar ? 'معلومات التوصيل' : 'Delivery details'}</span>
      <span>3 · {ar ? 'تأكيد' : 'Confirmation'}</span>
    </nav>

    <button type="button" className="co-summary-toggle" aria-expanded={summaryOpen} onClick={() => setSummaryOpen(open => !open)}>
      <span><ShoppingBag size={16} aria-hidden="true" /> {summaryOpen ? (ar ? 'إخفاء ملخص الطلب' : 'Hide order summary') : (ar ? `عرض ملخص الطلب (${units})` : `Show order summary (${units})`)} <ChevronDown size={15} aria-hidden="true" /></span>
      <strong>{iqd(total)}</strong>
    </button>
    {summaryOpen && <div className="co-summary-mobile">{summary}</div>}

    <div className="co-layout">
      <form ref={formRef} className="co-form" onSubmit={submit} noValidate={false}>
        <header className="co-heading">
          <h1>{ar ? 'خطوة وحدة ويوصلك طلبك' : 'One step to your order'}</h1>
          <p><LockKeyhole size={14} aria-hidden="true" /> {ar ? 'ما تدفع شي هسه. تدفع نقداً للمندوب عند الاستلام.' : 'Nothing to pay now. You pay the courier in cash on delivery.'}</p>
        </header>

        <fieldset className="co-section">
          <legend><span>1</span> {ar ? 'معلومات المستلم' : 'Who’s receiving it?'}</legend>
          <div className="co-grid">
            <div className="co-field full"><label htmlFor="name">{ar ? 'الاسم الكامل' : 'Full name'}</label><input id="name" name="name" autoComplete="name" maxLength={100} minLength={2} required /></div>
            <div className="co-field"><label htmlFor="phone">{ar ? 'رقم الموبايل' : 'Mobile number'}</label><input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="07XX XXX XXXX" maxLength={20} required aria-invalid={Boolean(phoneError)} aria-describedby="phone-help" onBlur={event => checkPhone(event.target.value)} onChange={() => phoneError && setPhoneError('')} /><small id="phone-help" className={phoneError ? 'co-error' : ''}>{phoneError || (ar ? 'نتصل عليه لتأكيد الطلب قبل الشحن' : 'We call this number to confirm before dispatch')}</small></div>
            <div className="co-field"><label htmlFor="altPhone">{ar ? 'رقم ثاني (اختياري)' : 'Second number (optional)'}</label><input id="altPhone" name="altPhone" type="tel" inputMode="tel" dir="ltr" placeholder="07XX XXX XXXX" maxLength={20} /></div>
          </div>
        </fieldset>

        <fieldset className="co-section">
          <legend><span>2</span> {ar ? 'عنوان التوصيل' : 'Delivery address'}</legend>
          <div className="co-grid">
            <div className="co-field full"><label htmlFor="governorate">{ar ? 'المحافظة' : 'Governorate'}</label><select id="governorate" name="governorate" required value={governorate} onChange={event => setGovernorate(event.target.value)}><option value="">{ar ? 'اختر المحافظة' : 'Choose your governorate'}</option>{config.zones.map(item => <option key={item.code} value={item.code}>{ar ? `${item.nameAr} — ${freeShipping ? 'توصيل مجاني' : iqd(item.rate)}` : `${item.nameEn} — ${freeShipping ? 'free delivery' : iqd(item.rate)}`}</option>)}</select>
              {zone && <p className="co-eta"><Truck size={15} aria-hidden="true" /><span>{ar ? 'التوصيل المتوقع' : 'Expected delivery'}: <strong>{deliveryWindow(zone, language)}</strong> · {freeShipping ? (ar ? 'مجاني' : 'free') : iqd(zone.rate)}</span></p>}
            </div>
            <div className="co-field"><label htmlFor="city">{ar ? 'المدينة أو القضاء' : 'City / district'}</label><input id="city" name="city" autoComplete="address-level2" placeholder={ar ? 'مثال: الكرادة، المنصور' : 'e.g. Karrada, Mansour'} maxLength={120} required /></div>
            <div className="co-field"><label htmlFor="landmark">{ar ? 'أقرب نقطة دالة (اختياري)' : 'Nearest landmark (optional)'}</label><input id="landmark" name="landmark" placeholder={ar ? 'مثال: قرب جامع…' : 'e.g. near … mosque'} maxLength={200} /></div>
            <div className="co-field full"><label htmlFor="address">{ar ? 'العنوان بالتفصيل' : 'Full address'}</label><input id="address" name="address" autoComplete="street-address" placeholder={ar ? 'المنطقة، الشارع، رقم الدار أو البناية' : 'Area, street, house or building number'} maxLength={300} minLength={5} required /></div>
            <details className="co-field full co-more">
              <summary>{ar ? 'إضافة بريد إلكتروني أو ملاحظة (اختياري)' : 'Add an email or a note (optional)'}</summary>
              <div className="co-grid">
                <div className="co-field full"><label htmlFor="email">{ar ? 'البريد الإلكتروني' : 'Email'}</label><input id="email" name="email" type="email" autoComplete="email" dir="ltr" maxLength={254} /></div>
                <div className="co-field full"><label htmlFor="note">{ar ? 'ملاحظة للتوصيل' : 'Delivery note'}</label><textarea id="note" name="note" rows={3} maxLength={500} placeholder={ar ? 'وقت التوصيل المناسب، تغليف هدية…' : 'Best time to deliver, gift wrapping…'} /></div>
              </div>
            </details>
          </div>
        </fieldset>

        <fieldset className="co-section">
          <legend><span>3</span> {ar ? 'طريقة الدفع' : 'Payment'}</legend>
          <label className="co-pay"><input type="radio" name="payment" value="cod" defaultChecked readOnly /><Banknote size={22} aria-hidden="true" /><div><strong>{ar ? 'الدفع نقداً عند الاستلام' : 'Cash on delivery'}</strong><small>{ar ? 'تدفع للمندوب بالدينار العراقي لما يوصلك الطلب.' : 'Pay the courier in Iraqi dinars when your order arrives.'}{codFee ? (ar ? ` تُضاف ${iqd(codFee)} رسوم دفع.` : ` A ${iqd(codFee)} handling fee applies.`) : ''}</small></div></label>
        </fieldset>

        {error && <p className="co-error co-error-box" role="alert">{error}</p>}
        <div className="co-submit">
          <button type="submit" className="co-primary co-place" disabled={submitting}>{submitting ? <><LoaderCircle size={18} className="spin" /> {ar ? 'جارٍ تثبيت الطلب…' : 'Placing your order…'}</> : <>{ar ? 'تأكيد الطلب' : 'Place order'} · {iqd(total)}</>}</button>
          <ul className="co-trust">
            <li><Banknote size={15} aria-hidden="true" /> {ar ? 'تدفع عند الاستلام' : 'Pay on delivery'}</li>
            <li><PhoneCall size={15} aria-hidden="true" /> {ar ? 'نتصل بك قبل الشحن' : 'We call before dispatch'}</li>
            <li><RotateCcw size={15} aria-hidden="true" /> {ar ? 'إرجاع خلال 30 يوماً' : '30-day returns'}</li>
          </ul>
          <p className="co-legal">{t('By continuing, you agree to our')} <Link href="/info/terms">{ar ? 'الشروط والأحكام' : 'terms & conditions'}</Link>. {whatsapp ? <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">{ar ? 'عندك سؤال؟ راسلنا واتساب' : 'Questions? WhatsApp us'}</a> : <><MapPin size={11} aria-hidden="true" /> {config.settings.supportPhone}</>}</p>
        </div>
      </form>

      <aside className="co-summary" aria-label={ar ? 'ملخص الطلب' : 'Order summary'}>
        <h2><Package size={18} aria-hidden="true" /> {ar ? 'ملخص الطلب' : 'Order summary'}</h2>
        {summary}
      </aside>
    </div>
  </main>;
}
