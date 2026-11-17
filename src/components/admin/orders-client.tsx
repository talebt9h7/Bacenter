'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { ArrowRight, Banknote, Clock, LoaderCircle, MapPin, Phone, Printer, Save, Search, Truck, Plus, Pencil, Trash2, Check, Download, X, MessageCircle } from 'lucide-react';
import { orderStatuses, statusLabels, statusTransitions, type OrderStatus } from '@/lib/iraq';
import { api, money, Modal, StatusBadge, useFlash, when } from './ui';
import { ManualOrderModal } from './manual-order-modal';
import { Kpi, PageHero } from './dash-ui';
import { CalendarClock, CircleDollarSign as CircleDollar, Clock3, PackageCheck, Truck as TruckIcon, XCircle } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { AppLanguage } from '@/lib/i18n';
import { orderStatusT, orderT } from '@/lib/i18n';
import { accountNames, courierFee as rateFor, methodsFor, moneyState, moneyStateNames, moneyStateTone, paymentMethodNames, type MoneyAccount } from '@/lib/accounts-rules';
import './accounts.css';
import './orders-board.css';
import { mediaSrc } from '@/lib/types';
const mediaThumb = (src: string) => mediaSrc(src, 160);

/** Ready-made WhatsApp messages to the customer (in Arabic: the shop's customers write Arabic). */
function whatsappLink(order: OrderRow, kind: 'confirm' | 'shipped') {
  const phone = `964${order.phone.replace(/\D/g, '').replace(/^964/, '').replace(/^0/, '')}`;
  const a = (order.address ?? {}) as { governorateAr?: string; governorate?: string; city?: string; line1?: string };
  const total = new Intl.NumberFormat('en-US').format(order.totalCents);
  const items = order.items.map(i => `• ${i.name}${(i as { color?: string }).color ? ` (${(i as { color?: string }).color})` : ''} × ${i.quantity}`).join('\n');
  const place = [a.governorateAr || a.governorate || order.governorate, a.city, a.line1].filter(Boolean).join(' — ');
  const due = order.paymentStatus === 'paid' ? 'مدفوع' : `${total} د.ع`;
  const text = kind === 'confirm'
    ? `مرحباً ${order.name}، معك أور للجلود.\nاستلمنا طلبك رقم ${order.reference}:\n${items}\nالمبلغ: ${due} (يشمل التوصيل)\nالعنوان: ${place}\nنأكد الطلب ونجهزه للشحن؟`
    : `مرحباً ${order.name}، طلبك رقم ${order.reference} انشحن${order.courier ? ` مع ${order.courier}` : ''}${order.trackingNumber ? `، رقم التتبع: ${order.trackingNumber}` : ''}.\nالمبلغ عند الاستلام: ${due}.\nشكراً لاختيارك أور للجلود.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
/** Payment method in the admin's language. */
function paymentMethodLabel(method: string, language: string) {
  const ar = language === 'ar';
  const map: Record<string, [string, string]> = { cod: ['Cash on delivery', 'الدفع عند الاستلام'], electronic: ['Electronic payment', 'دفع إلكتروني'], cash: ['Cash', 'نقداً'], bank_transfer: ['Master transfer', 'تحويل ماستر'], credit: ['Credit (wholesale)', 'آجل (جملة)'] };
  const hit = map[method];
  return hit ? (ar ? hit[1] : hit[0]) : method;
}
export type OrderRow = { id: number; reference: string; name: string; phone: string; email: string; governorate: string; status: string; paymentStatus: string; paymentMethod: string; currency: string; totalCents: number; subtotalCents: number; shippingCents: number; discountCents: number; codFeeCents: number; couponCode: string | null; createdAt: string; updatedAt: string; items: { productId: string; variantId: number; name: string; color: string; quantity: number; unitPrice?: number; profitIqd?: number | null; priceCents?: number; purchaseCostCents?: number | null; batchAllocations?: { batchId: number; quantity: number }[]; image?: string | null; listPrice?: number; promotionName?: string | null; bundleName?: string | null }[]; address: { governorate?: string; governorateAr?: string; city?: string; line1?: string; line2?: string; landmark?: string; altPhone?: string; country?: string; postalCode?: string }; customerNote: string | null; adminNote: string | null; trackingNumber: string | null; courier: string | null; source: string; sourceNote: string | null };
export type OrderEvent = { id: number; type: string; message: string; createdAt: string };
/** Accounts fields on an order (see lib/accounts-rules.ts). */
type OrderMoney = { source?: string; fulfillment?: string; courierId?: number | null; courierFeeIqd?: number | null; settlementId?: number | null; paidTo?: string | null; paidAt?: string | Date | null; gatewayFeeIqd?: number };
export type CourierOption = { id: number; name: string; active: boolean; defaultFeeIqd: number; returnFeeIqd: number; rates: Record<string, number> };
const moneyOf = (o: OrderRow) => o as OrderRow & OrderMoney;
function MoneyPill({ order }: { order: OrderRow }) {
  const state = moneyState(moneyOf(order) as Parameters<typeof moneyState>[0]);
  return <span className={`acc-pill ${moneyStateTone[state]}`}>{moneyStateNames[state]}</span>;
}
function DeliveryPill({ order, couriers }: { order: OrderRow; couriers: CourierOption[] }) {
  const o = moneyOf(order);
  if (o.source === 'wholesale') return <span className="acc-pill muted">جملة</span>;
  if (o.fulfillment === 'pickup') return <span className="acc-pill pickup">من المحل</span>;
  const name = couriers.find(c => c.id === o.courierId)?.name;
  return <span className="acc-pill courier">توصيل{name ? ` · ${name}` : ''}</span>;
}
type CatalogRow = { variantId: number; productId: string; productName: string; productNameAr?: string; color: string; colorAr?: string; stock: number; priceCents: number; salePriceIqd: number; image: string | null; published: boolean };

type OrderStats = { byStatus: Record<string, { count: number; total: number }>; today: { count: number; total: number }; stalePending: number };
/** Page heading + live counts for the orders list. */
export function OrdersHeader({ stats }: { stats: OrderStats }) {
  const { language } = useLanguage(); const lang = language === 'ar' ? 'ar' : 'en';
  const tt = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const c = (s: string) => stats.byStatus[s]?.count ?? 0, v = (s: string) => stats.byStatus[s]?.total ?? 0;
  const all = Object.values(stats.byStatus).reduce((sum, x) => sum + x.count, 0);
  const closed = c('delivered') + c('cancelled') + c('returned');
  const iqdFmt = (n: number) => `${new Intl.NumberFormat('en-US').format(Math.round(n))} IQD`;
  return <>
    <PageHero eyebrow={tt('Sales', 'المبيعات')} title={tt('Orders', 'الطلبات')} description={tt('Confirm by phone, pack, hand to the courier and mark delivered. A pending order only reserves stock; confirming deducts it, and cancelling or returning a confirmed order puts it back.', 'أكّد بالاتصال، جهّز، سلّم للمندوب، وبعدين حوّله "تم التوصيل". الطلب قيد الانتظار يحجز الكمية بس؛ التأكيد يخصمها، والإلغاء أو الإرجاع بعد التأكيد يرجعها.')} />
    <section className="dash-kpis">
      <Kpi lang={lang} icon={<CalendarClock size={17} />} tone="accent" label={tt('Today', 'اليوم')} value={stats.today.count} note={iqdFmt(stats.today.total)} />
      <Kpi lang={lang} delay={50} icon={<Clock3 size={17} />} tone="gold" label={tt('Pending confirmation', 'بانتظار التأكيد')} value={c('pending')} note={stats.stalePending ? tt(`${stats.stalePending} older than 24h`, `${stats.stalePending} أقدم من 24 ساعة`) : iqdFmt(v('pending'))} href="/admin/orders?status=pending" />
      <Kpi lang={lang} delay={100} icon={<PackageCheck size={17} />} tone="blue" label={tt('To pack', 'للتجهيز')} value={c('confirmed') + c('processing')} note={iqdFmt(v('confirmed') + v('processing'))} href="/admin/orders?status=confirmed" />
      <Kpi lang={lang} delay={150} icon={<TruckIcon size={17} />} tone="violet" label={tt('With courier', 'عند المندوب')} value={c('shipped')} note={tt(`${iqdFmt(v('shipped'))} to collect`, `${iqdFmt(v('shipped'))} للتحصيل`)} href="/admin/orders?status=shipped" />
      <Kpi lang={lang} delay={200} icon={<CircleDollar size={17} />} tone="success" label={tt('Delivered', 'تم التوصيل')} value={c('delivered')} note={closed ? tt(`${Math.round((c('delivered') / closed) * 100)}% of closed orders`, `${Math.round((c('delivered') / closed) * 100)}% من الطلبات المغلقة`) : '—'} href="/admin/orders?status=delivered" />
      <Kpi lang={lang} delay={250} icon={<XCircle size={17} />} tone="danger" label={tt('Cancelled / returned', 'ملغي / مرتجع')} value={c('cancelled') + c('returned')} note={all ? tt(`${(((c('cancelled') + c('returned')) / all) * 100).toFixed(1)}% of all orders`, `${(((c('cancelled') + c('returned')) / all) * 100).toFixed(1)}% من كل الطلبات`) : '—'} />
    </section>
  </>;
}

const FLOW: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
const statusNamesAr: Record<OrderStatus, string> = { pending: 'قيد الانتظار', confirmed: 'مؤكد', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي', returned: 'مرتجع' };
const holdsStock = (status: OrderStatus) => ['confirmed', 'processing', 'shipped', 'delivered'].includes(status);

/** Explains what a status change does to stock and money, and asks before risky ones. */
function confirmStatusChange(from: OrderStatus, to: OrderStatus, language: string) {
  const ar = language === 'ar';
  const name = (status: OrderStatus) => ar ? statusNamesAr[status] : statusLabels[status];
  const notes: string[] = [];
  if (!holdsStock(from) && holdsStock(to)) notes.push(ar ? 'سيتم خصم الكميات من المخزون الآن.' : 'The units will be deducted from stock now.');
  if (holdsStock(from) && !holdsStock(to)) notes.push(ar ? 'سترجع الكميات إلى المخزون.' : 'The units will go back into stock.');
  if (from === 'delivered' && to !== 'delivered') notes.push(ar ? 'سيُلغى احتساب الإيراد والربح لهذا الطلب.' : 'Its revenue and profit will no longer be counted.');
  if (to === 'delivered') notes.push(ar ? 'سيُحتسب الإيراد والربح بتاريخ اليوم.' : 'Revenue and profit will be counted from today.');
  const backwards = FLOW.indexOf(to) >= 0 && FLOW.indexOf(from) > FLOW.indexOf(to);
  const risky = to === 'cancelled' || to === 'returned' || backwards || from === 'cancelled' || from === 'returned';
  if (!risky && !notes.length) return true;
  return window.confirm(`${ar ? 'تغيير حالة الطلب' : 'Change order status'}: ${name(from)} → ${name(to)}${notes.length ? `\n\n${notes.join('\n')}` : ''}`);
}

/** The order's status as a clickable bar: any step can be chosen, not only the next one. */
function OrderStatusBar({ current, busy, onChange }: { current: OrderStatus; busy: string | null; onChange: (status: OrderStatus) => void }) {
  const { language } = useLanguage(); const ar = language === 'ar';
  const name = (status: OrderStatus) => ar ? statusNamesAr[status] : statusLabels[status];
  const closed = current === 'cancelled' || current === 'returned';
  const stepIndex = FLOW.indexOf(current);
  return <div className={`admin-status-bar ${closed ? 'is-closed' : ''}`}>
    <ol className="admin-steps">{FLOW.map((step, index) => {
      const isCurrent = step === current;
      const isBusy = busy === `Status ${statusLabels[step]}`;
      return <li key={step} className={!closed && index < stepIndex ? 'done' : isCurrent ? 'current' : ''}>
        <button type="button" className="admin-step-button" disabled={isCurrent || busy !== null} aria-current={isCurrent ? 'step' : undefined} title={isCurrent ? (ar ? 'الحالة الحالية' : 'Current status') : `${ar ? 'تحويل إلى' : 'Move to'} ${name(step)}`} onClick={() => onChange(step)}>
          <i>{isBusy ? <LoaderCircle size={13} className="spin" /> : !closed && index < stepIndex ? '✓' : index + 1}</i><span>{name(step)}</span>
        </button>
      </li>;
    })}</ol>
    <div className="admin-status-bar-end">
      {(['cancelled', 'returned'] as OrderStatus[]).map(step => <button key={step} type="button" className={`admin-status-chip ${step} ${current === step ? 'active' : ''}`} disabled={current === step || busy !== null} onClick={() => onChange(step)}>{busy === `Status ${statusLabels[step]}` ? <LoaderCircle size={13} className="spin" /> : null}{name(step)}</button>)}
    </div>
    {closed && <p className="admin-status-bar-note">{current === 'cancelled' ? (ar ? 'الطلب ملغي. لا يحجز ولا يخصم أي كمية من المخزون. اضغط أي مرحلة لإرجاعه.' : 'This order is cancelled and holds no stock. Click a step to reinstate it.') : (ar ? 'الطلب مرتجع وكمياته رجعت للمخزون. اضغط أي مرحلة لإرجاعه.' : 'This order was returned and its units are back in stock. Click a step to reinstate it.')}</p>}
    {current === 'pending' && <p className="admin-status-bar-note">{ar ? 'قيد الانتظار: الكميات محجوزة فقط ولم تُخصم من المخزون. تُخصم عند التأكيد.' : 'Pending: units are reserved only, not deducted. They are deducted when you confirm.'}</p>}
  </div>;
}

function EditOrderModal({ order, catalog, couriers, onClose }: { order: OrderRow; catalog: CatalogRow[]; couriers: CourierOption[]; onClose: () => void }) {
  const om = moneyOf(order);
  const [fulfillment, setFulfillment] = useState(om.fulfillment === 'pickup' ? 'pickup' : 'courier'), [courierId, setCourierId] = useState(om.courierId ? String(om.courierId) : ''), [courierFeeIqd, setCourierFeeIqd] = useState(om.courierFeeIqd == null ? '' : String(om.courierFeeIqd));
  const { language } = useLanguage(); const tr = (label: keyof typeof import('@/lib/i18n').orderTranslations) => orderT(label, language);
  const router = useRouter();
  const [name,setName]=useState(order.name),[phone,setPhone]=useState(order.phone),[email,setEmail]=useState(order.email);
  const [governorate,setGovernorate]=useState(order.governorate || 'baghdad'),[city,setCity]=useState(order.address?.city || ''),[address,setAddress]=useState(order.address?.line1 || ''),[landmark,setLandmark]=useState(order.address?.landmark || '');
  const [source,setSource]=useState(order.source || 'website'),[sourceNote,setSourceNote]=useState(order.sourceNote || ''),[shipping,setShipping]=useState(String(order.shippingCents || '')),[discount,setDiscount]=useState(String(order.discountCents || '')),[paymentMethod,setPaymentMethod]=useState(order.paymentMethod),[paymentStatus,setPaymentStatus]=useState(order.paymentStatus),[note,setNote]=useState(order.customerNote || '');
  const [items,setItems]=useState(order.items.map(item => ({ variantId:item.variantId, quantity:item.quantity, unitPrice:item.unitPrice ?? item.priceCents ?? 0 })));
  const [busy,setBusy]=useState(false); const {flash,fail}=useFlash();
  async function submit(){setBusy(true);try{const data=await api<{order:OrderRow}>(`/api/admin/orders/${order.id}`,{method:'PATCH',json:{name,phone,email,governorate,city,address,landmark,source,sourceNote,shipping:Number(shipping)||0,discount:Number(discount)||0,paymentMethod,paymentStatus,customerNote:note,items,fulfillment,courierId:fulfillment==='courier'&&courierId?Number(courierId):null,courierFeeIqd:fulfillment==='courier'&&courierFeeIqd!==''?Number(courierFeeIqd):null}});onClose();window.dispatchEvent(new CustomEvent('admin-order-updated',{detail:data.order}));}catch(e){fail(e);setBusy(false);}}
  function addItem(){ const first=catalog.find(c=>c.stock>0 && !items.some(i=>i.variantId===c.variantId)); if(first) setItems([...items,{variantId:first.variantId,quantity:1,unitPrice:first.salePriceIqd}]); }
  function updateItem(index:number,key:'variantId'|'quantity'|'unitPrice',value:number){ setItems(items.map((item,i)=>i===index?{...item,[key]:value}:item)); }
  function removeItem(index:number){ if(items.length>1) setItems(items.filter((_,i)=>i!==index)); }
  const courier = couriers.find(c => String(c.id) === courierId);
  return <Modal title={`تعديل الطلب ${order.reference}`} onClose={onClose} wide>{flash}<div className="admin-form-grid">
    {om.source !== 'wholesale' && <><div className="admin-field admin-field-full"><span>طريقة التسليم</span><div className="acc-seg"><button type="button" className={fulfillment==='courier'?'is-on':''} onClick={()=>{setFulfillment('courier'); if(paymentMethod==='cash') setPaymentMethod('cod');}}>توصيل بشركة</button><button type="button" className={fulfillment==='pickup'?'is-on':''} onClick={()=>{setFulfillment('pickup'); if(paymentMethod==='cod') setPaymentMethod('cash');}}>استلام من المحل</button></div>{om.settlementId ? <small className="acc-muted">داخل بكشف رقم {om.settlementId}: الشركة والأجور والمبلغ ما تتغير إلا بعد حذف الكشف.</small> : null}</div>
    {fulfillment==='courier' && <><label className="admin-field"><span>شركة التوصيل</span><select value={courierId} onChange={e=>{setCourierId(e.target.value); const c=couriers.find(x=>String(x.id)===e.target.value); if(c && (order.status==='delivered'||order.status==='returned')) setCourierFeeIqd(String(order.status==='returned'?c.returnFeeIqd:rateFor(c, governorate) ?? 0));}}><option value="">— بدون —</option>{couriers.map(c=><option key={c.id} value={c.id}>{c.name}{!c.active?' (موقوفة)':''}</option>)}</select></label>
    <label className="admin-field"><span>أجور الشركة على هذا الطلب (د.ع)</span><input type="number" min="0" step="250" value={courierFeeIqd} placeholder={courier ? String(rateFor(courier, governorate) ?? '') : ''} onChange={e=>setCourierFeeIqd(e.target.value)} /><small className="acc-muted">تنحسب وحدها لما ينسلم الطلب. اكتبها إذا تختلف.</small></label></>}</>}
    <label className="admin-field"><span>{tr('Customer name *')}</span><input value={name} onChange={e=>setName(e.target.value)} /></label><label className="admin-field"><span>{tr('Phone *')}</span><input value={phone} onChange={e=>setPhone(e.target.value)} /></label>
    <label className="admin-field"><span>{tr('Email')}</span><input value={email} onChange={e=>setEmail(e.target.value)} /></label><label className="admin-field"><span>{tr('Order source')}</span><select value={source} onChange={e=>setSource(e.target.value)}><option value="website">{tr('Website')}</option><option value="instagram">{tr('Instagram')}</option><option value="whatsapp">{tr('WhatsApp')}</option><option value="facebook">{tr('Facebook')}</option><option value="phone">{tr('Phone')}</option><option value="store">{tr('Store')}</option><option value="other">{tr('Other')}</option></select></label>
    <label className="admin-field"><span>{tr('Source note')}</span><input value={sourceNote} onChange={e=>setSourceNote(e.target.value)} /></label><label className="admin-field"><span>{tr('Governorate *')}</span><select value={governorate} onChange={e=>setGovernorate(e.target.value)}>{['baghdad','basra','nineveh','erbil','sulaymaniyah','duhok','kirkuk','anbar','babil','karbala','najaf','qadisiyah','muthanna','dhi-qar','maysan','wasit','diyala','saladin'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <label className="admin-field"><span>{tr('City / district *')}</span><input value={city} onChange={e=>setCity(e.target.value)} /></label><label className="admin-field"><span>{tr('Landmark')}</span><input value={landmark} onChange={e=>setLandmark(e.target.value)} /></label>
    <label className="admin-field admin-field-full"><span>{tr('Detailed address *')}</span><input value={address} onChange={e=>setAddress(e.target.value)} /></label>
    <label className="admin-field"><span>{tr('Delivery')}</span><input type="number" min="0" step="500" value={shipping} onChange={e=>setShipping(e.target.value)} /></label><label className="admin-field"><span>{tr('Discount')}</span><input type="number" min="0" step="250" value={discount} onChange={e=>setDiscount(e.target.value)} /></label>
    <label className="admin-field"><span>{tr('Payment')}</span><select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>{[...new Set([...methodsFor[fulfillment as 'courier'|'pickup'], paymentMethod])].map(m=><option key={m} value={m}>{paymentMethodNames[m] ?? m}</option>)}</select></label><label className="admin-field"><span>{tr('Payment status')}</span><select value={paymentStatus} onChange={e=>setPaymentStatus(e.target.value)}><option value="unpaid">{paymentMethod==='cod'?'غير مستلم (عند الزبون أو شركة التوصيل)':'غير مستلم'}</option>{(paymentMethod!=='cod'||order.paymentStatus==='paid')&&<option value="paid">{paymentMethod==='cod'?'مستلم (قديم بدون كشف)':'مستلم'}</option>}<option value="refunded">{tr('Refunded')}</option></select>{paymentMethod==='cod'&&<small className="acc-muted">فلوس الدفع عند الاستلام تنستلم من صفحة الحسابات ← شركات التوصيل.</small>}</label>
    <label className="admin-field admin-field-full"><span>{tr('Customer note')}</span><textarea value={note} onChange={e=>setNote(e.target.value)} rows={3}/></label>
  </div>
  <div className="admin-card" style={{marginTop:16,padding:16}}><div className="admin-card-heading"><h2>{tr('Edit products')}</h2><button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={addItem}><Plus size={13}/> {tr('Add product')}</button></div>{items.map((item,index)=>{const selected=catalog.find(c=>c.variantId===item.variantId);return <div key={`${item.variantId}-${index}`} className="admin-form-grid" style={{marginTop:12,alignItems:'end'}}><label className="admin-field"><span>{tr('Product / color')}</span><div style={{display:'flex',gap:10,alignItems:'center'}}>{selected?.image && <img src={selected.image} alt="" style={{width:44,height:44,objectFit:'cover',borderRadius:8}}/>}<select value={item.variantId} onChange={e=>{const v=catalog.find(c=>c.variantId===Number(e.target.value));setItems(items.map((x,i)=>i===index?{...x,variantId:Number(e.target.value),unitPrice:v?.salePriceIqd ?? x.unitPrice}:x));}}>{catalog.map(c=><option key={c.variantId} value={c.variantId}>{c.productNameAr || c.productName} — {c.colorAr || c.color} · {c.stock} بالمخزون</option>)}</select></div></label><label className="admin-field"><span>{tr('Quantity')}</span><input type="number" min="1" value={item.quantity} onChange={e=>updateItem(index,'quantity',Math.max(1,Number(e.target.value)||1))}/></label><label className="admin-field"><span>{tr('Sale / unit (IQD)')}</span><input type="number" min="0" step="500" value={item.unitPrice} onChange={e=>updateItem(index,'unitPrice',Math.max(0,Number(e.target.value)||0))}/></label><button type="button" className="admin-btn admin-btn-danger-ghost admin-btn-sm" onClick={()=>removeItem(index)} disabled={items.length===1}><Trash2 size={13}/>{tr('Remove')}</button></div>})}</div><div className="admin-alert info" style={{marginTop:16}}>Changing products will update stock using the current inventory batches and will keep the sale price used on this order.</div><div className="admin-modal-actions"><button className="admin-btn admin-btn-ghost" onClick={onClose}>{tr('Cancel')}</button><button className="admin-btn admin-btn-primary" disabled={busy||!name||!phone||!city||!address} onClick={()=>void submit()}>{busy?<LoaderCircle size={15} className="spin"/>:<Save size={15}/>} Save changes</button></div></Modal>;
}

const SOURCE_AR: Record<string, string> = { website: 'الموقع', instagram: 'إنستغرام', whatsapp: 'واتساب', facebook: 'فيسبوك', tiktok: 'تيك توك', phone: 'اتصال', store: 'المحل', other: 'أخرى', wholesale: 'جملة' };
const MONTHS_AR = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
/** "17 تشرين الثاني · 12:04" in Baghdad time. */
function orderWhen(iso: string, language: string) {
  const d = new Date(new Date(iso).getTime() + 3 * 3600_000);
  const time = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  return language === 'ar' ? `${d.getUTCDate()} ${MONTHS_AR[d.getUTCMonth()]} · ${time}` : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })} · ${time}`;
}

/** One order on the orders page: who, when, what, where it goes, money, and the next step — each in its own place. */
function OrderCard({ row, couriers, names, language, selected, busy, next, onToggle, onAdvance, onStatus, onEdit, onDelete }: { row: OrderRow; couriers: CourierOption[]; names: Map<number, { product?: string; color?: string }>; language: AppLanguage; selected: boolean; busy: boolean; next?: OrderStatus; onToggle: () => void; onAdvance: () => void; onStatus: (s: OrderStatus) => void; onEdit: () => void; onDelete: () => void }) {
  const ar = language === 'ar';
  const o = moneyOf(row);
  const units = row.items.reduce((sum, item) => sum + item.quantity, 0);
  const gov = (ar ? row.address?.governorateAr : undefined) || row.address?.governorate || row.governorate || '';
  const where = o.fulfillment === 'pickup' ? (ar ? 'استلام من المحل' : 'Shop pick-up') : [gov, row.address?.city].filter(Boolean).join(' · ');
  const courierName = couriers.find(c => c.id === o.courierId)?.name;
  return <article className={`ob-card${selected ? ' is-selected' : ''}`}>
    <header className="ob-head">
      <input type="checkbox" className="ob-check" checked={selected} onChange={onToggle} aria-label={`${ar ? 'تحديد' : 'Select'} ${row.reference}`} />
      <div className="ob-who">
        <Link href={`/admin/orders/${row.id}`} className="ob-name">{row.name || '—'}</Link>
        <a className="ob-phone" href={row.phone ? `tel:${row.phone}` : undefined} dir="ltr"><Phone size={11} /> {row.phone || row.email || '—'}</a>
      </div>
      <select className={`admin-status-select status-${row.status} ob-status`} value={row.status} disabled={busy} aria-label={`${ar ? 'الحالة' : 'Status'} ${row.reference}`} onChange={e => onStatus(e.target.value as OrderStatus)}>{orderStatuses.map(item => <option key={item} value={item}>{orderStatusT(item, language)}</option>)}</select>
    </header>
    <div className="ob-tags">
      <Link href={`/admin/orders/${row.id}`} className="ob-tag ob-ref" dir="ltr">{row.reference}</Link>
      <span className="ob-tag"><Clock size={11} /> {orderWhen(row.createdAt, language)}</span>
      <span className="ob-tag">{ar ? SOURCE_AR[row.source ?? ''] ?? row.source : row.source}</span>
    </div>
    <ul className="ob-items">
      {row.items.slice(0, 3).map((item, i) => <li key={i}>
        <span className="ob-thumb">{item.image ? <img src={mediaThumb(item.image)} alt="" loading="lazy" /> : null}</span>
        <span className="ob-item-name">{(ar && names.get(item.variantId)?.product) || item.name}{(ar && names.get(item.variantId)?.color) || item.color ? <small> · {(ar && names.get(item.variantId)?.color) || item.color}</small> : null}</span>
        <b>×{item.quantity}</b>
      </li>)}
      {row.items.length > 3 && <li className="ob-more">+{row.items.length - 3} {ar ? 'منتج آخر' : 'more'}</li>}
    </ul>
    <div className="ob-facts">
      <div><span>{ar ? 'الإجمالي' : 'Total'}</span><strong>{money(row.totalCents, row.currency)}</strong><small>{units} {ar ? 'قطعة' : units === 1 ? 'item' : 'items'}{row.discountCents > 0 ? ` · ${ar ? 'خصم' : 'off'} ${money(row.discountCents, row.currency)}` : ''}</small></div>
      <div><span>{ar ? 'الفلوس' : 'Money'}</span><MoneyPill order={row} /><small>{paymentMethodLabel(row.paymentMethod, language)}</small></div>
      <div><span>{ar ? 'التسليم' : 'Delivery'}</span><b className="ob-deliv">{o.source === 'wholesale' ? (ar ? 'جملة' : 'Wholesale') : o.fulfillment === 'pickup' ? (ar ? 'من المحل' : 'Pick-up') : courierName ?? (ar ? 'توصيل' : 'Delivery')}</b><small>{o.fulfillment === 'pickup' ? '' : where || '—'}</small></div>
    </div>
    <footer className="ob-actions">
      {next ? <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={onAdvance} disabled={busy}>{busy ? <LoaderCircle size={13} className="spin" /> : <ArrowRight size={13} />} {orderStatusT(next, language)}</button> : <span />}
      <div className="ob-actions-end">
        <button className="admin-btn admin-btn-ghost admin-btn-sm admin-icon-only" title={ar ? 'تعديل' : 'Edit'} aria-label={`${ar ? 'تعديل' : 'Edit'} ${row.reference}`} onClick={onEdit} disabled={busy}><Pencil size={14} /></button>
        <button className="admin-btn admin-btn-danger-ghost admin-btn-sm admin-icon-only" title={ar ? 'حذف' : 'Delete'} aria-label={`${ar ? 'حذف' : 'Delete'} ${row.reference}`} onClick={onDelete} disabled={busy}><Trash2 size={14} /></button>
        <Link href={`/admin/orders/${row.id}`} className="admin-btn admin-btn-ghost admin-btn-sm">{ar ? 'فتح' : 'Open'} <ArrowRight size={13} /></Link>
      </div>
    </footer>
  </article>;
}

export function OrdersTable({ rows, catalog, status, query, page, pages, total, counts, pageSize, couriers = [], defaultCourierId = null, zoneRates = {} }: { rows: OrderRow[]; catalog: CatalogRow[]; status: string; query: string; page: number; pages: number; total: number; counts: Record<string, number>; pageSize: number; couriers?: CourierOption[]; defaultCourierId?: number | null; zoneRates?: Record<string, number> }) {
  const { language } = useLanguage(); const tr = (label: keyof typeof import('@/lib/i18n').orderTranslations) => orderT(label, language);
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [localRows, setLocalRows] = useState(rows);
  // Reset to fresh server rows after a refresh (adjusting state during render, not in an effect).
  const [sourceRows, setSourceRows] = useState(rows);
  if (sourceRows !== rows) { setSourceRows(rows); setLocalRows(rows); }
  const [manualOpen, setManualOpen] = useState(false), [editOrder, setEditOrder] = useState<OrderRow | null>(null);
  useEffect(() => { const handler=(event:Event)=>{ const order=(event as CustomEvent<OrderRow>).detail; if(order?.id) setLocalRows(current=>current.map(item=>item.id===order.id?order:item)); }; window.addEventListener('admin-order-updated',handler); return ()=>window.removeEventListener('admin-order-updated',handler); }, []);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Bulk actions: selected orders on this page.
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>('confirmed');
  const [bulkBusy, setBulkBusy] = useState(false);
  const toggle = (id: number) => setSelected(list => list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  async function applyBulk() {
    if (!selected.length) return;
    const ar = language === 'ar';
    if (!window.confirm(ar ? `تغيير حالة ${selected.length} طلب إلى «${orderStatusT(bulkStatus, language)}»؟` : `Move ${selected.length} orders to “${orderStatusT(bulkStatus, language)}”?`)) return;
    setBulkBusy(true);
    try {
      const r = await api<{ done: number[]; skipped: { reference: string; reason: string }[] }>('/api/admin/orders/bulk', { method: 'POST', json: { ids: selected, status: bulkStatus } });
      const reasons: Record<string, string> = ar ? { same: 'نفس الحالة', stock: 'المخزون ما يكفي', error: 'خطأ' } : { same: 'already there', stock: 'not enough stock', error: 'error' };
      const msg = (ar ? `تم تحديث ${r.done.length} طلب.` : `${r.done.length} orders updated.`) + (r.skipped.length ? (ar ? `\nما تحدث ${r.skipped.length}: ` : `\nSkipped ${r.skipped.length}: `) + r.skipped.slice(0, 8).map(x => `${x.reference} (${reasons[x.reason] ?? x.reason})`).join('، ') : '');
      window.alert(msg); setSelected([]); router.refresh();
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Bulk update failed.'); }
    finally { setBulkBusy(false); }
  }
  const exportHref = (() => { const params = new URLSearchParams(); if (query) params.set('q', query); if (status && status !== 'all') params.set('status', status); return `/api/admin/orders/export${params.size ? `?${params}` : ''}`; })();
  // Search, status and page live in the URL and run on the server across every order.
  const [draft, setDraft] = useState(query), [draftSource, setDraftSource] = useState(query);
  if (draftSource !== query) { setDraftSource(query); setDraft(query); }
  const go = (next: { q?: string; status?: string; page?: number }) => {
    const params = new URLSearchParams();
    const q = next.q ?? query, st = next.status ?? status, pg = next.page ?? 1;
    if (q) params.set('q', q); if (st && st !== 'all') params.set('status', st); if (pg > 1) params.set('page', String(pg));
    startNavigation(() => router.push(`/admin/orders${params.size ? `?${params}` : ''}`, { scroll: false }));
  };
  useEffect(() => { if (draft.trim() === query) return; const timer = setTimeout(() => go({ q: draft.trim() }), 350); return () => clearTimeout(timer); });
  const visible = localRows;
  const arabicNames = useMemo(() => new Map(catalog.map(c => [c.variantId, { product: c.productNameAr || undefined, color: c.colorAr || undefined }])), [catalog]);
  const pageRows = localRows;
  const pageIndex = page - 1;
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const from = total ? pageIndex * pageSize + 1 : 0, to = Math.min(total, pageIndex * pageSize + localRows.length);
  async function advance(row: OrderRow) { const current = (orderStatuses.includes(row.status as OrderStatus) ? row.status : 'pending') as OrderStatus; const next = statusTransitions[current].find(x => x !== 'cancelled' && x !== 'returned'); if (!next) return; setBusyId(row.id); try { const data=await api<{order:OrderRow}>(`/api/admin/orders/${row.id}`, { method:'PATCH', json:{status:next} }); setLocalRows(current=>current.map(item=>item.id===row.id?data.order:item)); } catch (e) { window.alert(e instanceof Error ? e.message : 'Could not update status.'); } finally { setBusyId(null); } }
  async function changeStatus(row: OrderRow, next: OrderStatus) { const current = (orderStatuses.includes(row.status as OrderStatus) ? row.status : 'pending') as OrderStatus; if (next === current || !confirmStatusChange(current, next, language)) return; setBusyId(row.id); try { const data = await api<{ order: OrderRow }>(`/api/admin/orders/${row.id}`, { method: 'PATCH', json: { status: next, force: !statusTransitions[current].includes(next) } }); setLocalRows(rows => rows.map(item => item.id === row.id ? data.order : item)); } catch (e) { window.alert(e instanceof Error ? e.message : 'Could not update status.'); } finally { setBusyId(null); } }
  async function remove(row: OrderRow) { if (!confirm(`${tr('Delete order')} ${row.reference}? ${tr('Stock')} will be returned automatically if the order is still active.`)) return; setBusyId(row.id); try { await api(`/api/admin/orders/${row.id}`, { method:'DELETE' }); setLocalRows(current=>current.filter(item=>item.id!==row.id)); } catch (e) { window.alert(e instanceof Error ? e.message : 'Could not delete order.'); } finally { setBusyId(null); } }
  return <>{manualOpen && <ManualOrderModal catalog={catalog} couriers={couriers.filter(c => c.active)} defaultCourierId={defaultCourierId} zoneRates={zoneRates} onClose={() => setManualOpen(false)} />}{editOrder && <EditOrderModal order={editOrder} catalog={catalog} couriers={couriers} onClose={() => setEditOrder(null)} />}<section className="admin-card"><div className="admin-toolbar"><button className="admin-btn admin-btn-primary" onClick={() => setManualOpen(true)}><Plus size={15}/>{tr('Add manual order')}</button><label className="admin-search"><Search size={16} /><input placeholder={language === 'ar' ? 'ابحث بكل الطلبات: الرقم، الاسم، الهاتف، المدينة…' : 'Search all orders: reference, name, phone, city…'} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') go({ q: draft.trim() }); }} aria-label="Search orders" />{navigating && <LoaderCircle size={15} className="spin" />}</label><div className="admin-segmented admin-segmented-scroll" role="tablist"><button role="tab" aria-selected={status === 'all'} className={status === 'all' ? 'active' : ''} onClick={() => go({ status: 'all' })}>{language === 'ar' ? 'الكل' : 'All'} ({allCount})</button>{orderStatuses.map(item => <button key={item} role="tab" aria-selected={status === item} className={status === item ? 'active' : ''} onClick={() => go({ status: item })}>{orderStatusT(item, language)} ({counts[item] ?? 0})</button>)}</div></div>
    <p className="admin-orders-scope">{query ? (language === 'ar' ? `نتائج البحث عن «${query}» بكل الطلبات: ${total} طلب` : `Results for “${query}” across all orders: ${total}`) : (language === 'ar' ? `يعرض ${from}–${to} من ${total} طلب (كل الطلبات، الأحدث أولاً)` : `Showing ${from}–${to} of ${total} orders (all orders, newest first)`)}{query && <button type="button" className="admin-link" onClick={() => { setDraft(''); go({ q: '' }); }}>{language === 'ar' ? 'مسح البحث' : 'Clear search'}</button>}</p>
    <div className="admin-orders-tools"><a className="admin-btn admin-btn-ghost admin-btn-sm" href={exportHref}><Download size={14} /> {language === 'ar' ? 'تصدير Excel' : 'Export Excel'}</a></div>
    {selected.length > 0 && <div className="admin-bulk-bar" role="region" aria-label={language === 'ar' ? 'إجراءات جماعية' : 'Bulk actions'}>
      <b>{language === 'ar' ? `${selected.length} طلب محدد` : `${selected.length} selected`}</b>
      <label><span>{language === 'ar' ? 'تغيير الحالة إلى' : 'Move to'}</span><select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as OrderStatus)}>{orderStatuses.map(item => <option key={item} value={item}>{orderStatusT(item, language)}</option>)}</select></label>
      <button className="admin-btn admin-btn-primary admin-btn-sm" disabled={bulkBusy} onClick={() => void applyBulk()}>{bulkBusy ? <LoaderCircle size={13} className="spin" /> : <Check size={13} />} {language === 'ar' ? 'تطبيق' : 'Apply'}</button>
      <a className="admin-btn admin-btn-ghost admin-btn-sm" href={`/admin/print/orders?type=invoice&ids=${selected.join(',')}`} target="_blank" rel="noreferrer"><Printer size={13} /> {language === 'ar' ? 'طباعة الفواتير' : 'Print invoices'}</a>
      <a className="admin-btn admin-btn-ghost admin-btn-sm" href={`/admin/print/orders?type=label&ids=${selected.join(',')}`} target="_blank" rel="noreferrer"><Printer size={13} /> {language === 'ar' ? 'طباعة ملصقات الشحن' : 'Print labels'}</a>
      <a className="admin-btn admin-btn-ghost admin-btn-sm" href={`/api/admin/orders/export?ids=${selected.join(',')}`}><Download size={13} /> Excel</a>
      <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setSelected([])}><X size={13} /> {language === 'ar' ? 'إلغاء التحديد' : 'Clear'}</button>
    </div>}
    <div className="ob-selectall"><label><input type="checkbox" checked={pageRows.length > 0 && pageRows.every(r => selected.includes(r.id))} onChange={e => setSelected(e.target.checked ? pageRows.map(r => r.id) : [])} /> {language === 'ar' ? 'تحديد كل طلبات الصفحة' : 'Select all on this page'}</label></div>
    {!visible.length ? <p className="admin-empty">{tr('No orders match that filter.')}</p> : <div className="ob-grid">{pageRows.map(row => { const current = (orderStatuses.includes(row.status as OrderStatus) ? row.status : 'pending') as OrderStatus; const next = statusTransitions[current].find(x => x !== 'cancelled' && x !== 'returned'); return <OrderCard key={row.id} row={row} couriers={couriers} names={arabicNames} language={language} selected={selected.includes(row.id)} busy={busyId === row.id} next={next} onToggle={() => toggle(row.id)} onAdvance={() => void advance(row)} onStatus={value => void changeStatus(row, value)} onEdit={() => setEditOrder(row)} onDelete={() => void remove(row)} />; })}</div>}{pages > 1 && <nav className="admin-pager" aria-label="Pages"><button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" disabled={pageIndex === 0 || navigating} onClick={() => { go({ page: page - 1 }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{language === 'ar' ? 'السابق' : 'Previous'}</button><span>{language === 'ar' ? `صفحة ${page} من ${pages} · ${total} طلب` : `Page ${page} of ${pages} · ${total} orders`}</span><button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" disabled={page >= pages || navigating} onClick={() => { go({ page: page + 1 }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{language === 'ar' ? 'التالي' : 'Next'}</button></nav>}</section></>;
}

/** Order page: how it is handed over (delivery company + its fee, or the shop) and where its money is. */
function OrderMoneyPanel({ order, couriers, busy, onPatch }: { order: OrderRow; couriers: CourierOption[]; busy: string | null; onPatch: (body: Record<string, unknown>, label: string) => Promise<void> }) {
  const o = moneyOf(order);
  const [courierId, setCourierId] = useState(o.courierId ? String(o.courierId) : '');
  const [fee, setFee] = useState(o.courierFeeIqd == null ? '' : String(o.courierFeeIqd));
  const state = moneyState(o as Parameters<typeof moneyState>[0]);
  const courier = couriers.find(c => String(c.id) === courierId);
  const suggested = courier ? (order.status === 'returned' ? courier.returnFeeIqd : rateFor(courier, order.governorate)) : null;
  const changed = courierId !== (o.courierId ? String(o.courierId) : '') || fee !== (o.courierFeeIqd == null ? '' : String(o.courierFeeIqd));
  const iqdText = (v: number) => `${new Intl.NumberFormat('en-US').format(v)} د.ع`;
  if (o.source === 'wholesale') return null;
  return <div className="acc-order-money">
    <div className="row"><span>التسليم</span><DeliveryPill order={order} couriers={couriers} /></div>
    {o.fulfillment !== 'pickup' && <>
      <div className="row"><span>شركة التوصيل</span><select value={courierId} disabled={!!o.settlementId} onChange={e => { setCourierId(e.target.value); const c = couriers.find(x => String(x.id) === e.target.value); if (c && fee === '' && (order.status === 'delivered' || order.status === 'returned')) setFee(String(order.status === 'returned' ? c.returnFeeIqd : rateFor(c, order.governorate) ?? '')); }} style={{ height: 36, borderRadius: 9, border: '1px solid #dcd8d2', padding: '0 8px', font: 'inherit' }}><option value="">— اختر —</option>{couriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{!couriers.length && <Link className="admin-link" href="/admin/accounts/couriers">أضف شركة توصيل</Link>}</div>
      <div className="row"><span>أجور الشركة</span><input type="number" min="0" step="250" value={fee} disabled={!!o.settlementId} placeholder={suggested != null ? String(suggested) : 'تنحسب عند التسليم'} onChange={e => setFee(e.target.value)} style={{ width: 130, height: 36, borderRadius: 9, border: '1px solid #dcd8d2', padding: '0 8px', font: 'inherit' }} />{changed && <button className="admin-btn admin-btn-ghost admin-btn-sm" disabled={busy !== null} onClick={() => void onPatch({ courierId: courierId ? Number(courierId) : null, courierFeeIqd: fee === '' ? null : Number(fee) }, 'التوصيل')}><Save size={13} /> حفظ</button>}</div>
    </>}
    <div className="row"><span>الفلوس</span><span className={`acc-pill ${moneyStateTone[state]}`}>{moneyStateNames[state]}</span>{state === 'received' && o.paidTo && <small className="acc-muted">بـ{accountNames[o.paidTo as MoneyAccount] ?? o.paidTo}{o.paidAt ? ` · ${new Date(o.paidAt).toLocaleDateString('en-GB')}` : ''}</small>}</div>
    {(o.gatewayFeeIqd ?? 0) > 0 && <div className="row"><span>عمولة القاصة</span><span>{iqdText(o.gatewayFeeIqd ?? 0)}</span></div>}
    <div className="row"><span /> {(() => {
      if (o.settlementId) return <Link className="admin-btn admin-btn-ghost admin-btn-sm" href={`/admin/accounts/couriers/${o.settlementId}`}>كشف رقم {o.settlementId}</Link>;
      if (state === 'at_courier' || state === 'review') return <Link className="admin-btn admin-btn-primary admin-btn-sm" href={`/admin/accounts/couriers${o.courierId ? `?courier=${o.courierId}` : ''}`}><Banknote size={13} /> سجّل استلام من الشركة</Link>;
      if (order.paymentMethod === 'cod') return <small className="acc-muted">الشركة تستلم من الزبون، وإنت تستلم من الشركة بكشف.</small>;
      if (order.paymentStatus === 'paid') return <button className="admin-btn admin-btn-ghost admin-btn-sm" disabled={busy !== null} onClick={() => { if (window.confirm('إلغاء تسجيل الاستلام؟ المبلغ ينشال من الحساب.')) void onPatch({ paymentStatus: 'unpaid' }, 'الدفع'); }}>إلغاء الاستلام</button>;
      if (order.status === 'cancelled' || order.status === 'returned') return null;
      return <button className="admin-btn admin-btn-primary admin-btn-sm" disabled={busy !== null} onClick={() => void onPatch({ paymentStatus: 'paid' }, 'الدفع')}><Check size={13} /> {order.paymentMethod === 'cash' ? 'استلمت النقد' : 'وصل المبلغ'}</button>;
    })()}</div>
  </div>;
}

export function OrderDetail({ initial, events: initialEvents, couriers = [] }: { initial: OrderRow; events: OrderEvent[]; couriers?: CourierOption[] }) {
  const { language } = useLanguage(); const tr = (label: keyof typeof import('@/lib/i18n').orderTranslations) => orderT(label, language);
  const router = useRouter();
  const [order, setOrder] = useState(initial);
  const [events, setEvents] = useState(initialEvents);
  const [tracking, setTracking] = useState(order.trackingNumber ?? '');
  const [courier, setCourier] = useState(order.courier ?? '');
  const [note, setNote] = useState(order.adminNote ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const { flash, success, fail } = useFlash();
  const current = (orderStatuses.includes(order.status as OrderStatus) ? order.status : 'pending') as OrderStatus;
  const nextStatuses = statusTransitions[current];
  async function patch(body: Record<string, unknown>, label: string) {
    setBusy(label);
    try { const data = await api<{ order: OrderRow; events: OrderEvent[] }>(`/api/admin/orders/${order.id}`, { method: 'PATCH', json: body }); setOrder(data.order); setEvents(data.events); success(`${label} saved.`); router.refresh(); }
    catch (error) { fail(error); }
    finally { setBusy(null); }
  }
  const steps: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
  const stepIndex = steps.indexOf(current);
  const address = order.address ?? {};
  return <main className="admin-page"><div className="admin-page-heading"><div><Link href="/admin/orders" className="admin-link">← {tr('All orders')}</Link><h1>{tr('Order')} {order.reference}</h1><p>{tr('Source')}: {order.source === 'website' ? (language === 'ar' ? 'الموقع' : 'Website') : order.source} · {tr('Placed')} {when(order.createdAt)} · {paymentMethodLabel(order.paymentMethod, language)} · <StatusBadge status={order.status} /> <StatusBadge status={order.paymentStatus} /></p></div><div className="admin-heading-actions">{order.phone && <><a className="admin-btn admin-btn-whatsapp" href={whatsappLink(order, 'confirm')} target="_blank" rel="noreferrer"><MessageCircle size={15} />{language === 'ar' ? 'واتساب: تأكيد الطلب' : 'WhatsApp: confirm'}</a>{(order.status === 'shipped' || order.trackingNumber) && <a className="admin-btn admin-btn-whatsapp" href={whatsappLink(order, 'shipped')} target="_blank" rel="noreferrer"><MessageCircle size={15} />{language === 'ar' ? 'واتساب: تم الشحن' : 'WhatsApp: shipped'}</a>}</>}<a className="admin-btn admin-btn-ghost" href={`/admin/print/orders?type=invoice&ids=${order.id}`} target="_blank" rel="noreferrer"><Printer size={15} />{language === 'ar' ? 'فاتورة' : 'Invoice'}</a><a className="admin-btn admin-btn-ghost" href={`/admin/print/orders?type=label&ids=${order.id}`} target="_blank" rel="noreferrer"><Printer size={15} />{language === 'ar' ? 'ملصق شحن' : 'Shipping label'}</a></div></div>{flash}
    <OrderStatusBar current={current} busy={busy} onChange={step => { if (!confirmStatusChange(current, step, language)) return; void patch({ status: step, trackingNumber: tracking, courier, force: !statusTransitions[current].includes(step) }, `Status ${statusLabels[step]}`); }} />
    <div className="admin-grid-order">
      <div>
        <section className="admin-card"><div className="admin-card-heading"><h2>{tr('Items')}</h2><span className="admin-count">{order.items.reduce((sum, item) => sum + item.quantity, 0)} {tr('units')}</span></div><table className="admin-table"><thead><tr><th>{tr('Product')}</th><th>{tr('Color')}</th><th className="num">{tr('Qty')}</th><th className="num">{tr('Sale / unit')}</th><th className="num">{tr('Cost')}</th><th className="num">{tr('Line profit')}</th></tr></thead><tbody>{order.items.map((item, index) => { const unit = item.unitPrice ?? item.priceCents ?? 0; const cost = item.purchaseCostCents; const grossOrder = order.items.reduce((sum, row) => sum + (row.unitPrice ?? row.priceCents ?? 0) * row.quantity, 0); const safeDiscount = Math.min(Math.max(0, order.discountCents || 0), grossOrder); const grossLine = unit * item.quantity; const netLine = grossOrder > 0 ? Math.max(0, grossLine - safeDiscount * (grossLine / grossOrder)) : 0; const lineProfit = cost == null ? null : netLine - cost * item.quantity; return <tr key={index}><td><div className="admin-product-cell">{item.image && <img src={item.image} alt="" />}<div><Link href={`/admin/products/${item.productId}`} className="admin-strong-link">{item.name}</Link><small>/{item.productId}</small></div></div></td><td>{item.color}</td><td className="num">{item.quantity}</td><td className="num">{money(unit, order.currency)}{item.listPrice && item.listPrice > unit && <small className="admin-promo-line"><s>{money(item.listPrice, order.currency)}</s> {item.bundleName ? `${language === 'ar' ? 'بكج' : 'Bundle'}: ${item.bundleName}` : item.promotionName}</small>}</td><td className="num">{cost == null ? (order.status === 'pending' ? (language === 'ar' ? 'تُحدد عند التأكيد' : 'Set on confirm') : (language === 'ar' ? 'غير معروفة' : 'Unknown')) : money(cost, order.currency)}</td><td className="num">{lineProfit == null ? '—' : money(lineProfit, order.currency)}</td></tr>; })}</tbody><tfoot><tr><td colSpan={5} className="num">{tr('Subtotal')}</td><td className="num">{money(order.subtotalCents, order.currency)}</td></tr>{order.discountCents > 0 && <tr><td colSpan={5} className="num">{language === 'ar' ? 'الخصم' : 'Discount'} {order.couponCode && <small>({order.couponCode})</small>}</td><td className="num">− {money(order.discountCents, order.currency)}</td></tr>}<tr><td colSpan={5} className="num">{tr('Delivery')}</td><td className="num">{order.shippingCents ? money(order.shippingCents, order.currency) : (language === 'ar' ? 'مجاني' : 'Free')}</td></tr>{order.codFeeCents > 0 && <tr><td colSpan={5} className="num">{tr('Cash handling')}</td><td className="num">{money(order.codFeeCents, order.currency)}</td></tr>}<tr className="admin-total-row"><td colSpan={5} className="num">{tr('Total to collect')}</td><td className="num">{money(order.totalCents, order.currency)}</td></tr></tfoot></table></section>
        <section className="admin-card"><div className="admin-card-heading"><h2><Clock size={16} />{tr('Timeline')}</h2></div><ol className="admin-timeline">{events.map(event => <li key={event.id}><span>{when(event.createdAt)}</span><strong>{event.type}</strong><p>{event.message}</p></li>)}</ol></section>
      </div>
      <div>
        <section className="admin-card"><div className="admin-card-heading"><h2><Truck size={16} />{tr('Fulfilment')}</h2></div>{nextStatuses.length > 0 && <div className="admin-status-actions"><div className="admin-next-status"><span>{tr('Current')}: <strong>{orderStatusT(current, language)}</strong></span>{nextStatuses.filter(x => x !== 'cancelled' && x !== 'returned')[0] && <button className="admin-btn admin-btn-primary" disabled={busy !== null} onClick={() => { const next = nextStatuses.find(x => x !== 'cancelled' && x !== 'returned')!; void patch({ status: next, trackingNumber: tracking, courier }, `Status ${orderStatusT(next, language)}`); }}>{busy === `Status ${statusLabels[nextStatuses.find(x => x !== 'cancelled' && x !== 'returned')!]}` ? <LoaderCircle size={15} className="spin" /> : <ArrowRight size={15} />} {language === 'ar' ? `تحويل إلى ${statusNamesAr[nextStatuses.find(x => x !== 'cancelled' && x !== 'returned')!]}` : `Advance to ${statusLabels[nextStatuses.find(x => x !== 'cancelled' && x !== 'returned')!].toLowerCase()}`}</button>}</div><div className="admin-status-secondary">{nextStatuses.filter(x => x === 'cancelled' || x === 'returned').map(next => <button key={next} className="admin-btn admin-btn-danger-ghost admin-btn-sm" disabled={busy !== null} onClick={() => { if (!confirmStatusChange(current, next, language)) return; void patch({ status: next, trackingNumber: tracking, courier }, `Status ${orderStatusT(next, language)}`); }}>{language === 'ar' ? `تحويل إلى ${statusNamesAr[next]}` : `Mark as ${statusLabels[next].toLowerCase()}`}</button>)}</div></div>}
          <div className="admin-form-grid" style={{ marginTop: 16 }}><label className="admin-field"><span>{tr('Tracking / waybill no.')}</span><input value={tracking} onChange={event => setTracking(event.target.value)} placeholder={language === 'ar' ? 'اختياري' : 'Optional'} /></label><label className="admin-field span-2"><span>{tr('Internal note')}</span><textarea rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder={language === 'ar' ? 'تظهر للفريق فقط' : 'Only visible to staff'} /></label></div><button className="admin-btn admin-btn-ghost" disabled={busy !== null} onClick={() => void patch({ trackingNumber: tracking, courier, adminNote: note }, 'Fulfilment details')}><Save size={14} /> {language === 'ar' ? 'حفظ التفاصيل' : 'Save details'}</button>
          <OrderMoneyPanel order={order} couriers={couriers} busy={busy} onPatch={patch} /></section>
        <section className="admin-card"><div className="admin-card-heading"><h2><MapPin size={16} /> {language === 'ar' ? 'الزبون والتوصيل' : 'Customer & delivery'}</h2></div><dl className="admin-dl"><dt>{tr('Name')}</dt><dd>{order.name}</dd><dt>{tr('Phone')}</dt><dd><a href={`tel:${order.phone}`}>{order.phone}</a>{address.altPhone && <> · <a href={`tel:${address.altPhone}`}>{address.altPhone}</a></>}<br /><a className="admin-link" href={`https://wa.me/964${order.phone.replace(/^0/, '')}`} target="_blank" rel="noreferrer">{tr('Message on WhatsApp')}</a></dd>{order.email && <><dt>{tr('Email')}</dt><dd>{order.email}</dd></>}<dt>{language === 'ar' ? 'المحافظة' : 'Governorate'}</dt><dd>{address.governorate || order.governorate} {address.governorateAr && <small>· {address.governorateAr}</small>}</dd><dt>{tr('Address')}</dt><dd>{address.city && <>{address.city}<br /></>}{address.line1}{address.line2 && <><br />{address.line2}</>}{address.landmark && <><br /><small>{language === 'ar' ? 'أقرب نقطة دالة' : 'Landmark'}: {address.landmark}</small></>}</dd>{order.customerNote && <><dt>{tr('Customer note')}</dt><dd>{order.customerNote}</dd></>}</dl><Link href={`/admin/customers?q=${encodeURIComponent(order.phone || order.email)}`} className="admin-link">{language === 'ar' ? 'سجل الزبون' : 'Customer history'} <ArrowRight size={13} /></Link></section>
      </div>
    </div>
    <section className="admin-print-slip"><h2>{order.reference}</h2><p>{order.name} · {order.phone}</p><p>{address.governorate} · {address.city} · {address.line1} {address.landmark ? `· ${address.landmark}` : ''}</p><ul>{order.items.map((item, index) => <li key={index}>{item.quantity} × {item.name} — {item.color}</li>)}</ul><p><strong>{tr('Collect')}: {money(order.totalCents, order.currency)}</strong> ({tr('Cash on delivery')})</p></section>
  </main>;
}
