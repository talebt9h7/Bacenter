'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Banknote, Check, CreditCard, LoaderCircle, Package, PackageCheck, PhoneCall, Plus, Search, Truck, X } from 'lucide-react';
import { useLanguage } from './language-provider';
import { groupInt, numberFormat } from '@/lib/number-format';
import { mediaSrc } from '@/lib/types';
import { iraqPhonePattern, normalizeIraqPhone } from '@/lib/iraq';
import { APPEND_KEY, MY_PHONE_KEY } from '@/lib/my-orders-keys';

type Item = { name: string; nameAr: string; color: string; colorAr: string; quantity: number; unitPrice: number; image: string | null; productId?: string };
type Order = {
  reference: string; createdAt: string; status: string; paymentMethod: string; paymentStatus: string;
  subtotal: number; shipping: number; discount: number; codFee: number; total: number; paid: number; due: number;
  governorate: string; governorateAr: string; city: string; trackingNumber: string | null; canAdd: boolean; link: string; items: Item[];
};

const STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const;
const store = {
  get(key: string) { try { return localStorage.getItem(key) || ''; } catch { return ''; } },
  set(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
  del(key: string) { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } },
};

export function MyOrders() {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, arText: string) => ar ? arText : en;
  const iqd = (value: number) => ar ? `${groupInt(value)} د.ع` : numberFormat('en-IQ', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(value);
  const router = useRouter();
  const params = useSearchParams();
  const [phone, setPhone] = useState('');
  const [input, setInput] = useState('');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [focus, setFocus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(raw: string) {
    const value = normalizeIraqPhone(raw);
    if (!iraqPhonePattern.test(value)) { setError(tt('Enter an Iraqi mobile number: 11 digits starting with 07.', 'اكتب رقم موبايل عراقي من 11 رقم يبدأ بـ 07')); return; }
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/my-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: value }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setPhone(data.phone); setOrders(data.orders); store.set(MY_PHONE_KEY, data.phone);
    } catch (err) { setError(err instanceof Error && err.message ? err.message : tt('Could not load your orders. Try again.', 'تعذر تحميل طلباتك، حاول مرة ثانية.')); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const ref = params.get('ref'), token = params.get('t');
    if (ref && token) {
      fetch(`/api/my-orders?ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(token)}`).then(async r => {
        const data = await r.json(); if (!r.ok) throw new Error(data.error);
        setPhone(data.phone); setOrders(data.orders); setFocus(data.focus); if (data.phone) store.set(MY_PHONE_KEY, data.phone);
      }).catch(() => { const saved = store.get(MY_PHONE_KEY); if (saved) void load(saved); else setLoading(false); })
        .finally(() => setLoading(false));
      return;
    }
    const frame = requestAnimationFrame(() => {
      const saved = store.get(MY_PHONE_KEY);
      if (saved) { setInput(saved); void load(saved); } else setLoading(false);
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (focus && orders) requestAnimationFrame(() => document.getElementById(`order-${focus}`)?.scrollIntoView({ block: 'start' })); }, [focus, orders]);

  function addTo(order: Order) {
    store.set(APPEND_KEY, order.reference); store.set(MY_PHONE_KEY, phone);
    router.push('/products/category/all');
  }
  function signOut() { store.del(MY_PHONE_KEY); store.del(APPEND_KEY); setPhone(''); setOrders(null); setInput(''); setFocus(''); router.replace('/my-orders'); }

  const stepLabel = (s: string) => ({
    pending: tt('Order received', 'استلمنا الطلب'), confirmed: tt('Confirmed', 'تم التأكيد'), processing: tt('Being prepared', 'قيد التجهيز'),
    shipped: tt('On the way', 'بالطريق'), delivered: tt('Delivered', 'تم التسليم'), cancelled: tt('Cancelled', 'ملغي'), returned: tt('Returned', 'مرتجع'),
  } as Record<string, string>)[s] ?? s;
  const stepIcon = [Check, PhoneCall, Package, Truck, PackageCheck];
  const date = (value: string) => new Date(value).toLocaleDateString(ar ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) return <main className="mo-page"><div className="mo-state"><LoaderCircle className="spin" size={28} /><p>{tt('Loading your orders…', 'جارٍ تحميل طلباتك…')}</p></div></main>;

  if (!orders) return <main className="mo-page">
    <section className="mo-lookup">
      <span className="mo-lookup-icon"><Package size={26} strokeWidth={1.4} /></span>
      <h1>{tt('My orders', 'طلباتي')}</h1>
      <p>{tt('Enter the mobile number you ordered with to see your orders and where they are.', 'اكتب رقم الموبايل اللي طلبت بيه حتى تشوف طلباتك ووين وصلت.')}</p>
      <form onSubmit={event => { event.preventDefault(); void load(input); }} noValidate>
        <label htmlFor="mo-phone" className="sr-only">{tt('Mobile number', 'رقم الموبايل')}</label>
        <input id="mo-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="07XX XXX XXXX" maxLength={20} value={input} onChange={e => { setInput(e.target.value); setError(''); }} aria-invalid={Boolean(error)} aria-describedby="mo-error" />
        <button type="submit"><Search size={17} aria-hidden="true" /> {tt('Show my orders', 'عرض طلباتي')}</button>
      </form>
      {error && <p className="mo-error" id="mo-error" role="alert">{error}</p>}
    </section>
  </main>;

  return <main className="mo-page">
    <header className="mo-head">
      <div><h1>{tt('My orders', 'طلباتي')}</h1><p>{tt('Orders on', 'الطلبات على الرقم')} <bdi dir="ltr">{phone}</bdi></p></div>
      <button type="button" className="mo-switch" onClick={signOut}><X size={15} aria-hidden="true" /> {tt('Change number', 'تغيير الرقم')}</button>
    </header>

    {!orders.length ? <div className="mo-state">
      <Package size={40} strokeWidth={1.1} />
      <h2>{tt('No orders on this number yet', 'ماكو طلبات على هذا الرقم')}</h2>
      <p>{tt('Check the number you ordered with, or start shopping.', 'تأكد من الرقم اللي طلبت بيه، أو ابدأ تسوّق.')}</p>
      <Link href="/products/category/all" className="mo-primary">{tt('Shop now', 'تسوّق الآن')} {ar ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}</Link>
    </div> : <ol className="mo-list">{orders.map(order => {
      const stopped = order.status === 'cancelled' || order.status === 'returned';
      const at = STEPS.indexOf(order.status as typeof STEPS[number]);
      const units = order.items.reduce((n, i) => n + i.quantity, 0);
      const paidOnline = order.paymentMethod === 'electronic' && order.paid > 0;
      return <li key={order.reference} id={`order-${order.reference}`} className={`mo-card${order.reference === focus ? ' is-focus' : ''}`}>
        <div className="mo-card-top">
          <div><strong dir="ltr">{order.reference}</strong><span>{date(order.createdAt)} · {ar ? `${units} قطعة` : `${units} item${units === 1 ? '' : 's'}`}</span></div>
          <span className={`mo-badge is-${order.status}`}>{stepLabel(order.status)}</span>
        </div>

        {stopped ? <p className={`mo-stopped is-${order.status}`}>{order.status === 'cancelled' ? tt('This order was cancelled.', 'هذا الطلب ملغي.') : tt('This order was returned.', 'هذا الطلب رجع.')}</p>
          : <ol className="mo-steps" aria-label={tt('Order progress', 'مراحل الطلب')}>{STEPS.map((s, i) => {
            const Icon = stepIcon[i];
            return <li key={s} className={i < at ? 'is-done' : i === at ? 'is-current' : ''} aria-current={i === at ? 'step' : undefined}>
              <span className="mo-dot">{i < at ? <Check size={14} strokeWidth={2.6} /> : <Icon size={14} />}</span><span className="mo-step-label">{stepLabel(s)}</span>
            </li>;
          })}</ol>}

        <ul className="mo-items">{order.items.map((item, index) => <li key={index}>
          {item.image ? <img src={mediaSrc(item.image, 160)} alt="" loading="lazy" /> : <span className="mo-noimg"><Package size={18} /></span>}
          <div><strong>{ar ? item.nameAr : item.name}</strong><span>{ar ? item.colorAr : item.color} · {ar ? `العدد ${item.quantity}` : `Qty ${item.quantity}`}</span></div>
          <b>{iqd(item.unitPrice * item.quantity)}</b>
        </li>)}</ul>

        <dl className="mo-totals">
          <div><dt>{tt('Items', 'المنتجات')}</dt><dd>{iqd(order.subtotal)}</dd></div>
          {order.discount > 0 && <div><dt>{tt('Discount', 'الخصم')}</dt><dd>− {iqd(order.discount)}</dd></div>}
          <div><dt>{tt('Delivery', 'التوصيل')}{order.governorateAr || order.governorate ? ` · ${ar ? order.governorateAr || order.governorate : order.governorate}` : ''}</dt><dd>{order.shipping ? iqd(order.shipping) : tt('Free', 'مجاني')}</dd></div>
          {order.codFee > 0 && <div><dt>{tt('Cash handling', 'رسوم الدفع عند الاستلام')}</dt><dd>{iqd(order.codFee)}</dd></div>}
          <div className="mo-grand"><dt>{tt('Total', 'المجموع')}</dt><dd>{iqd(order.total)}</dd></div>
        </dl>
        <p className="mo-pay">{order.paymentMethod === 'electronic' ? <CreditCard size={16} aria-hidden="true" /> : <Banknote size={16} aria-hidden="true" />}
          {paidOnline
            ? (order.due > 0 ? tt(`Paid ${iqd(order.paid)} online · ${iqd(order.due)} on delivery`, `مدفوع إلكترونياً ${iqd(order.paid)} · الباقي ${iqd(order.due)} عند الاستلام`) : tt('Paid online', 'مدفوع إلكترونياً'))
            : order.paymentMethod === 'electronic' ? tt('Electronic payment · not paid yet', 'دفع إلكتروني · لسه ما مدفوع')
            : order.paid > 0 && order.due > 0 ? tt(`Paid ${iqd(order.paid)} · ${iqd(order.due)} on delivery`, `مدفوع ${iqd(order.paid)} · الباقي ${iqd(order.due)} عند الاستلام`)
            : order.due === 0 && order.paid > 0 ? tt('Paid', 'مدفوع') : tt(`Cash on delivery · ${iqd(order.total)}`, `الدفع عند الاستلام · ${iqd(order.total)}`)}
        </p>
        {order.trackingNumber && order.status === 'shipped' && <p className="mo-pay"><Truck size={16} aria-hidden="true" /> {tt('Shipment number', 'رقم الشحنة')} <bdi dir="ltr">{order.trackingNumber}</bdi></p>}

        {order.canAdd && <div className="mo-add">
          <button type="button" onClick={() => addTo(order)}><Plus size={17} aria-hidden="true" /> {tt('Add a product to this order', 'أضف منتج لهذا الطلب')}</button>
          <span>{tt('It arrives with the same order, with no extra delivery fee.', 'يوصلك ويا نفس الطلب بدون أجور توصيل إضافية.')}</span>
        </div>}
      </li>;
    })}</ol>}
  </main>;
}
