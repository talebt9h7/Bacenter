'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { ArrowRight, Banknote, Clock, LoaderCircle, MapPin, Phone, Printer, Save, Search, Truck, Plus, Pencil, Trash2, Check, Download, X, MessageCircle } from 'lucide-react';
import { orderStatuses, statusLabels, statusTransitions, type OrderStatus } from '@/lib/iraq';
import { api, money as formatMoney, Modal, useFlash, when } from './ui';
import { ManualOrderModal } from './manual-order-modal';
import './orders-workspace.css';
import { SlidersHorizontal, MoreHorizontal, ChevronDown, Package, UserRound } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { orderStatusT, orderT } from '@/lib/i18n';

function money(value:number,currency:string){return currency==='IQD'?`${new Intl.NumberFormat('en-US').format(value)} د.ع`:formatMoney(value,currency);}
function StatusBadge({status}:{status:string}){const {language}=useLanguage();const payments:Record<string,[string,string]>={paid:['Paid','مدفوع'],unpaid:['Unpaid','غير مدفوع'],refunded:['Refunded','مسترجع'],partial:['Partially paid','مدفوع جزئياً']};const label=payments[status]?(language==='ar'?payments[status][1]:payments[status][0]):orderStatuses.includes(status as OrderStatus)?orderStatusT(status as OrderStatus,language):status;return <span className={`ow-badge ow-status-${status}`}>{label}</span>;}

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
  const map: Record<string, [string, string]> = { cod: ['Cash on delivery', 'الدفع عند الاستلام'], electronic: ['Electronic payment', 'دفع إلكتروني'], cash: ['Cash', 'نقداً'], bank_transfer: ['Bank transfer', 'تحويل مصرفي'] };
  const hit = map[method];
  return hit ? (ar ? hit[1] : hit[0]) : method;
}
export type OrderRow = { id: number; reference: string; name: string; phone: string; email: string; governorate: string; status: string; paymentStatus: string; paymentMethod: string; currency: string; totalCents: number; subtotalCents: number; shippingCents: number; discountCents: number; codFeeCents: number; couponCode: string | null; createdAt: string; updatedAt: string; items: { productId: string; variantId: number; name: string; color: string; quantity: number; unitPrice?: number; profitIqd?: number | null; priceCents?: number; purchaseCostCents?: number | null; batchAllocations?: { batchId: number; quantity: number }[]; image?: string | null; listPrice?: number; promotionName?: string | null; bundleName?: string | null }[]; address: { governorate?: string; governorateAr?: string; city?: string; line1?: string; line2?: string; landmark?: string; altPhone?: string; country?: string; postalCode?: string }; customerNote: string | null; adminNote: string | null; trackingNumber: string | null; courier: string | null; source: string; sourceNote: string | null };
export type OrderEvent = { id: number; type: string; message: string; createdAt: string };
type CatalogRow = { variantId: number; productId: string; productName: string; productNameAr?: string; color: string; colorAr?: string; stock: number; priceCents: number; salePriceIqd: number; image: string | null; published: boolean };

type OrderStats = { byStatus: Record<string, { count: number; total: number }>; today: { count: number; total: number }; stalePending: number };
/** Page heading + live counts for the orders list. */
export function OrdersHeader({ stats }: { stats: OrderStats }) {
  const { language } = useLanguage(); const ar=language==='ar';
  const c=(key:string)=>stats.byStatus[key]?.count??0;
  return <><header className="ow-heading"><div><h1>{ar?'الطلبات':'Orders'}</h1><p>{ar?'متابعة الطلبات من التأكيد إلى التسليم':'Follow orders from confirmation to delivery'}</p></div><button className="ow-btn ow-primary" onClick={()=>window.dispatchEvent(new Event('admin-new-order'))}><Plus size={18}/>{ar?'طلب جديد':'New order'}</button></header>
    <div className="ow-metrics">{[{key:'pending',name:ar?'جديدة':'New',value:c('pending'),icon:<Clock size={22}/>},{key:'preparing',name:ar?'قيد التجهيز':'Preparing',value:c('confirmed')+c('processing'),icon:<Package size={22}/>},{key:'shipped',name:ar?'في التوصيل':'In delivery',value:c('shipped'),icon:<Truck size={22}/>},{key:'delivered',name:ar?'مكتملة':'Completed',value:c('delivered'),icon:<Check size={22}/>}].map(card=><Link key={card.key} href={`/admin/orders?status=${card.key}`} className="ow-metric"><span>{card.name}<strong>{card.value}</strong></span><i>{card.icon}</i></Link>)}</div></>;
}

function nextActionLabel(status:OrderStatus,language:'ar'|'en'){const labels:Partial<Record<OrderStatus,string>>={confirmed:'تأكيد الطلب',processing:'بدء التجهيز',shipped:'تسليم للشحن',delivered:'تم التوصيل'};return language==='ar'?(labels[status]||orderStatusT(status,language)):orderStatusT(status,language);}

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
function OrderStatusBar({ current }: { current: OrderStatus }) {
 const {language}=useLanguage(); const index=FLOW.indexOf(current);
 return <ol className="ow-steps" aria-label={language==='ar'?'مراحل الطلب':'Order progress'}>{FLOW.map((step,i)=><li key={step} className={i===index?'current':i<index?'done':''} aria-current={i===index?'step':undefined}><span>{i<index?<Check size={18}/>:i===3?<Truck size={18}/>:<Package size={18}/>}</span><b>{orderStatusT(step,language)}</b></li>)}</ol>;
}

function EditOrderModal({ order, catalog, onClose }: { order: OrderRow; catalog: CatalogRow[]; onClose: () => void }) {
  const { language } = useLanguage(); const tr = (label: keyof typeof import('@/lib/i18n').orderTranslations) => orderT(label, language);
  const router = useRouter();
  const [name,setName]=useState(order.name),[phone,setPhone]=useState(order.phone),[email,setEmail]=useState(order.email);
  const [governorate,setGovernorate]=useState(order.governorate || 'baghdad'),[city,setCity]=useState(order.address?.city || ''),[address,setAddress]=useState(order.address?.line1 || ''),[landmark,setLandmark]=useState(order.address?.landmark || '');
  const [source,setSource]=useState(order.source || 'website'),[sourceNote,setSourceNote]=useState(order.sourceNote || ''),[shipping,setShipping]=useState(String(order.shippingCents || '')),[discount,setDiscount]=useState(String(order.discountCents || '')),[paymentMethod,setPaymentMethod]=useState(order.paymentMethod),[paymentStatus,setPaymentStatus]=useState(order.paymentStatus),[note,setNote]=useState(order.customerNote || '');
  const [items,setItems]=useState(order.items.map(item => ({ variantId:item.variantId, quantity:item.quantity, unitPrice:item.unitPrice ?? item.priceCents ?? 0 })));
  const [busy,setBusy]=useState(false); const {flash,fail}=useFlash();
  async function submit(){setBusy(true);try{const data=await api<{order:OrderRow}>(`/api/admin/orders/${order.id}`,{method:'PATCH',json:{name,phone,email,governorate,city,address,landmark,source,sourceNote,shipping:Number(shipping)||0,discount:Number(discount)||0,paymentMethod,paymentStatus,customerNote:note,...(order.status==='delivered'?{}:{items})}});onClose();window.dispatchEvent(new CustomEvent('admin-order-updated',{detail:data.order}));}catch(e){fail(e);setBusy(false);}}
  function addItem(){ const first=catalog.find(c=>c.stock>0 && !items.some(i=>i.variantId===c.variantId)); if(first) setItems([...items,{variantId:first.variantId,quantity:1,unitPrice:first.salePriceIqd}]); }
  function updateItem(index:number,key:'variantId'|'quantity'|'unitPrice',value:number){ setItems(items.map((item,i)=>i===index?{...item,[key]:value}:item)); }
  function removeItem(index:number){ if(items.length>1) setItems(items.filter((_,i)=>i!==index)); }
  return <Modal title={`تعديل الطلب ${order.reference}`} onClose={onClose} wide>{flash}<div className="admin-form-grid">
    <label className="admin-field"><span>{tr('Customer name *')}</span><input value={name} onChange={e=>setName(e.target.value)} /></label><label className="admin-field"><span>{tr('Phone *')}</span><input value={phone} onChange={e=>setPhone(e.target.value)} /></label>
    <label className="admin-field"><span>{tr('Email')}</span><input value={email} onChange={e=>setEmail(e.target.value)} /></label><label className="admin-field"><span>{tr('Order source')}</span><select value={source} onChange={e=>setSource(e.target.value)}><option value="website">{tr('Website')}</option><option value="instagram">{tr('Instagram')}</option><option value="whatsapp">{tr('WhatsApp')}</option><option value="facebook">{tr('Facebook')}</option><option value="phone">{tr('Phone')}</option><option value="store">{tr('Store')}</option><option value="other">{tr('Other')}</option></select></label>
    <label className="admin-field"><span>{tr('Source note')}</span><input value={sourceNote} onChange={e=>setSourceNote(e.target.value)} /></label><label className="admin-field"><span>{tr('Governorate *')}</span><select value={governorate} onChange={e=>setGovernorate(e.target.value)}>{['baghdad','basra','nineveh','erbil','sulaymaniyah','duhok','kirkuk','anbar','babil','karbala','najaf','qadisiyah','muthanna','dhi-qar','maysan','wasit','diyala','saladin'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <label className="admin-field"><span>{tr('City / district *')}</span><input value={city} onChange={e=>setCity(e.target.value)} /></label><label className="admin-field"><span>{tr('Landmark')}</span><input value={landmark} onChange={e=>setLandmark(e.target.value)} /></label>
    <label className="admin-field admin-field-full"><span>{tr('Detailed address *')}</span><input value={address} onChange={e=>setAddress(e.target.value)} /></label>
    <label className="admin-field"><span>{tr('Delivery')}</span><input type="number" min="0" step="500" value={shipping} onChange={e=>setShipping(e.target.value)} /></label><label className="admin-field"><span>{tr('Discount')}</span><input type="number" min="0" step="250" value={discount} onChange={e=>setDiscount(e.target.value)} /></label>
    <label className="admin-field"><span>{tr('Payment')}</span><select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="cod">{tr('Cash on delivery')}</option><option value="cash">{tr('Cash')}</option><option value="bank_transfer">{tr('Bank transfer')}</option><option value="electronic">{tr('Electronic')}</option></select></label><label className="admin-field"><span>{tr('Payment status')}</span><select value={paymentStatus} onChange={e=>setPaymentStatus(e.target.value)}><option value="unpaid">{tr('Unpaid')}</option><option value="paid">{tr('Paid')}</option><option value="refunded">{tr('Refunded')}</option></select></label>
    <label className="admin-field admin-field-full"><span>{tr('Customer note')}</span><textarea value={note} onChange={e=>setNote(e.target.value)} rows={3}/></label>
  </div>
  <fieldset disabled={order.status==='delivered'} className="admin-card" style={{marginTop:16,padding:16}}><div className="admin-card-heading"><h2>{tr('Edit products')}</h2><button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={addItem}><Plus size={13}/> {tr('Add product')}</button></div>{items.map((item,index)=>{const selected=catalog.find(c=>c.variantId===item.variantId);return <div key={`${item.variantId}-${index}`} className="admin-form-grid" style={{marginTop:12,alignItems:'end'}}><label className="admin-field"><span>{tr('Product / color')}</span><div style={{display:'flex',gap:10,alignItems:'center'}}>{selected?.image && <img src={selected.image} alt="" style={{width:44,height:44,objectFit:'cover',borderRadius:8}}/>}<select value={item.variantId} onChange={e=>{const v=catalog.find(c=>c.variantId===Number(e.target.value));setItems(items.map((x,i)=>i===index?{...x,variantId:Number(e.target.value),unitPrice:v?.salePriceIqd ?? x.unitPrice}:x));}}>{catalog.map(c=><option key={c.variantId} value={c.variantId}>{c.productNameAr || c.productName} — {c.colorAr || c.color} · {c.stock} بالمخزون</option>)}</select></div></label><label className="admin-field"><span>{tr('Quantity')}</span><input type="number" min="1" value={item.quantity} onChange={e=>updateItem(index,'quantity',Math.max(1,Number(e.target.value)||1))}/></label><label className="admin-field"><span>{tr('Sale / unit (IQD)')}</span><input type="number" min="0" step="500" value={item.unitPrice} onChange={e=>updateItem(index,'unitPrice',Math.max(0,Number(e.target.value)||0))}/></label><button type="button" className="admin-btn admin-btn-danger-ghost admin-btn-sm" onClick={()=>removeItem(index)} disabled={items.length===1}><Trash2 size={13}/>{tr('Remove')}</button></div>})}</fieldset><div className="admin-alert info" style={{marginTop:16}}>{language==='ar'?(order.status==='delivered'?'منتجات الطلب المسلّم ثابتة؛ يمكنك تعديل بيانات الزبون والتوصيل.':'تعديل المنتجات يحدّث المخزون ويحافظ على سعر البيع المسجل.'):'Product changes update inventory. Delivered items cannot be edited.'}</div><div className="admin-modal-actions"><button className="admin-btn admin-btn-ghost" onClick={onClose}>{tr('Cancel')}</button><button className="admin-btn admin-btn-primary" disabled={busy||!name||!phone||!city||!address} onClick={()=>void submit()}>{busy?<LoaderCircle size={15} className="spin"/>:<Save size={15}/>} {language==='ar'?'حفظ التعديلات':'Save changes'}</button></div></Modal>;
}

export function OrdersTable({ rows, catalog, status, query, page, pages, total, counts, pageSize }: { rows: OrderRow[]; catalog: CatalogRow[]; status: string; query: string; page: number; pages: number; total: number; counts: Record<string, number>; pageSize: number }) {
  const { language } = useLanguage(); const tr = (label: keyof typeof import('@/lib/i18n').orderTranslations) => orderT(label, language);
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [localRows, setLocalRows] = useState(rows);
  // Reset to fresh server rows after a refresh (adjusting state during render, not in an effect).
  const [sourceRows, setSourceRows] = useState(rows);
  if (sourceRows !== rows) { setSourceRows(rows); setLocalRows(rows); }
  const [manualOpen, setManualOpen] = useState(false);
  const [filtersOpen,setFiltersOpen]=useState(false),[selecting,setSelecting]=useState(false);
  useEffect(()=>{const open=()=>setManualOpen(true);window.addEventListener('admin-new-order',open);return()=>window.removeEventListener('admin-new-order',open);},[]);
  useEffect(() => { const handler=(event:Event)=>{ const order=(event as CustomEvent<OrderRow>).detail; if(order?.id) setLocalRows(current=>current.map(item=>item.id===order.id?order:item)); }; window.addEventListener('admin-order-updated',handler); return ()=>window.removeEventListener('admin-order-updated',handler); }, []);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Bulk actions: selected orders on this page.
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>('confirmed');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectionRows,setSelectionRows]=useState(rows);
  if(selectionRows!==rows){setSelectionRows(rows);setSelected([]);}
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
  const pageRows = localRows;
  const pageIndex = page - 1;
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const from = total ? pageIndex * pageSize + 1 : 0, to = Math.min(total, pageIndex * pageSize + localRows.length);
  async function advance(row: OrderRow) { const current=(orderStatuses.includes(row.status as OrderStatus)?row.status:'pending') as OrderStatus;const next=statusTransitions[current].find(x=>x!=='cancelled'&&x!=='returned');if(!next||!confirmStatusChange(current,next,language))return;setBusyId(row.id);try{const data=await api<{order:OrderRow}>(`/api/admin/orders/${row.id}`,{method:'PATCH',json:{status:next}});setLocalRows(current=>current.map(item=>item.id===row.id?data.order:item));router.refresh();}catch(e){window.alert(e instanceof Error?e.message:'Could not update status.');}finally{setBusyId(null);}}
  const tabs=[{key:'all',label:language==='ar'?'الكل':'All',count:allCount},{key:'pending',label:language==='ar'?'الجديدة':'New',count:counts.pending??0},{key:'preparing',label:language==='ar'?'التجهيز':'Preparing',count:(counts.confirmed??0)+(counts.processing??0)},{key:'shipped',label:language==='ar'?'التوصيل':'Delivery',count:counts.shipped??0},{key:'delivered',label:language==='ar'?'المكتملة':'Completed',count:counts.delivered??0}];
  return <>{manualOpen&&<ManualOrderModal catalog={catalog} onClose={()=>setManualOpen(false)}/>}<section className="ow-panel">
    <div className="ow-list-tools"><nav className="ow-tabs" aria-label={language==='ar'?'حالات الطلبات':'Order statuses'}>{tabs.map(t=><button key={t.key} aria-pressed={status===t.key} className={status===t.key?'active':''} onClick={()=>go({status:t.key})}>{t.label}<small>{t.count}</small></button>)}</nav><label className="ow-search"><Search size={18}/><input aria-label={language==='ar'?'البحث في الطلبات':'Search orders'} placeholder={language==='ar'?'ابحث برقم الطلب أو اسم الزبون':'Search orders or customers'} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')go({q:draft.trim()});}}/>{navigating&&<LoaderCircle size={16} className="spin"/>}</label><button className="ow-btn" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={16}/>{language==='ar'?'تصفية وأدوات':'Filters & tools'}</button></div>
    {(filtersOpen||!tabs.some(t=>t.key===status))&&<div className="ow-filter-tools"><label>{tr('Status')}<select value={status} onChange={e=>go({status:e.target.value})}><option value="all">{language==='ar'?'الكل':'All'}</option><option value="preparing">{language==='ar'?'التجهيز':'Preparing'}</option>{orderStatuses.map(st=><option key={st} value={st}>{orderStatusT(st,language)} ({counts[st]??0})</option>)}</select></label><a className="ow-btn" href={exportHref}><Download size={15}/>{language==='ar'?'تصدير Excel':'Export Excel'}</a><button className="ow-btn" aria-pressed={selecting} onClick={()=>{setSelecting(!selecting);setSelected([]);}}>{language==='ar'?(selecting?'إلغاء وضع التحديد':'تحديد طلبات'):(selecting?'Exit selection':'Select orders')}</button></div>}
    {selected.length > 0 && <div className="admin-bulk-bar" role="region" aria-label={language === 'ar' ? 'إجراءات جماعية' : 'Bulk actions'}>
      <b>{language === 'ar' ? `${selected.length} طلب محدد` : `${selected.length} selected`}</b>
      <label><span>{language === 'ar' ? 'تغيير الحالة إلى' : 'Move to'}</span><select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as OrderStatus)}>{orderStatuses.map(item => <option key={item} value={item}>{orderStatusT(item, language)}</option>)}</select></label>
      <button className="admin-btn admin-btn-primary admin-btn-sm" disabled={bulkBusy} onClick={() => void applyBulk()}>{bulkBusy ? <LoaderCircle size={13} className="spin" /> : <Check size={13} />} {language === 'ar' ? 'تطبيق' : 'Apply'}</button>
      <a className="admin-btn admin-btn-ghost admin-btn-sm" href={`/admin/print/orders?type=invoice&ids=${selected.join(',')}`} target="_blank" rel="noreferrer"><Printer size={13} /> {language === 'ar' ? 'طباعة الفواتير' : 'Print invoices'}</a>
      <a className="admin-btn admin-btn-ghost admin-btn-sm" href={`/admin/print/orders?type=label&ids=${selected.join(',')}`} target="_blank" rel="noreferrer"><Printer size={13} /> {language === 'ar' ? 'طباعة ملصقات الشحن' : 'Print labels'}</a>
      <a className="admin-btn admin-btn-ghost admin-btn-sm" href={`/api/admin/orders/export?ids=${selected.join(',')}`}><Download size={13} /> Excel</a>
      <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setSelected([])}><X size={13} /> {language === 'ar' ? 'إلغاء التحديد' : 'Clear'}</button>
    </div>}
    <div className="ow-table-scroll"><table className="ow-table"><thead><tr>{selecting&&<th><input type="checkbox" aria-label={language==='ar'?'تحديد الكل':'Select all'} checked={pageRows.length>0&&pageRows.every(r=>selected.includes(r.id))} onChange={e=>setSelected(e.target.checked?pageRows.map(r=>r.id):[])}/></th>}<th>{tr('Order')}</th><th>{tr('Customer')}</th><th>{tr('Total')}</th><th>{tr('Status')}</th><th>{tr('Actions')}</th></tr></thead><tbody>{pageRows.map(row=>{const current=(orderStatuses.includes(row.status as OrderStatus)?row.status:'pending') as OrderStatus;const next=statusTransitions[current].find(x=>x!=='cancelled'&&x!=='returned');return <tr key={row.id}>{selecting&&<td><input type="checkbox" aria-label={`${language==='ar'?'تحديد':'Select'} ${row.reference}`} checked={selected.includes(row.id)} onChange={()=>toggle(row.id)}/></td>}<td data-label={tr('Order')}><Link href={`/admin/orders/${row.id}`} className="ow-reference">{row.reference}</Link><small>{when(row.createdAt)}</small></td><td data-label={tr('Customer')}><strong>{row.name}</strong><small dir="ltr">{row.phone||row.email}</small></td><td data-label={tr('Total')}><strong className="ow-money">{money(row.totalCents,row.currency)}</strong></td><td data-label={tr('Status')}><StatusBadge status={row.status}/><small><StatusBadge status={row.paymentStatus}/></small></td><td data-label={tr('Actions')}><div className="ow-row-actions"><Link className="ow-btn" href={`/admin/orders/${row.id}`}>{language==='ar'?'فتح الطلب':'Open order'}</Link>{next&&<button className="ow-btn ow-outline" disabled={busyId!==null} onClick={()=>void advance(row)}>{busyId===row.id?<LoaderCircle size={15} className="spin"/>:null}{nextActionLabel(next,language)}</button>}</div></td></tr>})}{!visible.length&&<tr><td colSpan={selecting?6:5} className="ow-empty">{tr('No orders match that filter.')}</td></tr>}</tbody></table></div>
    <footer className="ow-pagination"><span>{language==='ar'?`${from}–${to} من ${total} طلب`:`${from}–${to} of ${total} orders`}</span>{query&&<button className="ow-btn" onClick={()=>{setDraft('');go({q:''});}}>{language==='ar'?'مسح البحث':'Clear search'}</button>}<div><button className="ow-btn" disabled={page<=1||navigating} onClick={()=>go({page:page-1})}>{language==='ar'?'السابق':'Previous'}</button><span>{page} / {pages}</span><button className="ow-btn" disabled={page>=pages||navigating} onClick={()=>go({page:page+1})}>{language==='ar'?'التالي':'Next'}</button></div></footer></section></>;

}

export function OrderDetail({ initial, events: initialEvents, catalog }: { initial: OrderRow; events: OrderEvent[]; catalog: CatalogRow[] }) {
 const {language}=useLanguage();const ar=language==='ar';const tt=(en:string,arabic:string)=>ar?arabic:en;
 const router=useRouter();const [order,setOrder]=useState(initial),[events,setEvents]=useState(initialEvents);
 const [editing,setEditing]=useState(false),[busy,setBusy]=useState<string|null>(null);
 const [tracking,setTracking]=useState(initial.trackingNumber??''),[courier,setCourier]=useState(initial.courier??''),[note,setNote]=useState(initial.adminNote??'');
 const {flash,success,fail}=useFlash();
 useEffect(()=>{const update=(event:Event)=>{const updated=(event as CustomEvent<OrderRow>).detail;if(updated?.id===order.id){setOrder(updated);router.refresh();}};window.addEventListener('admin-order-updated',update);return()=>window.removeEventListener('admin-order-updated',update);},[order.id,router]);
 const [eventSource,setEventSource]=useState(initialEvents);if(eventSource!==initialEvents){setEventSource(initialEvents);setEvents(initialEvents);}
 const current=(orderStatuses.includes(order.status as OrderStatus)?order.status:'pending') as OrderStatus;
 const next=statusTransitions[current].find(x=>x!=='cancelled'&&x!=='returned');const address=order.address??{};
 async function patch(body:Record<string,unknown>){setBusy('saving');try{const data=await api<{order:OrderRow;events:OrderEvent[]}>(`/api/admin/orders/${order.id}`,{method:'PATCH',json:body});setOrder(data.order);setEvents(data.events);success(tt('Saved.','تم الحفظ.'));router.refresh();}catch(e){fail(e);}finally{setBusy(null);}}
 function changeStatus(status:OrderStatus){if(status===current||!confirmStatusChange(current,status,language))return;void patch({status,trackingNumber:tracking,courier,force:!statusTransitions[current].includes(status)});}
 async function remove(){if(!window.confirm(tt(`Delete ${order.reference}? Stock will be returned.`,`حذف الطلب ${order.reference}؟ ترجع الكميات إلى المخزون.`)))return;setBusy('delete');try{await api(`/api/admin/orders/${order.id}`,{method:'DELETE'});router.push('/admin/orders');router.refresh();}catch(e){fail(e);setBusy(null);}}
 const productName=(item:OrderRow['items'][number])=>{const row=catalog.find(c=>c.variantId===item.variantId);return ar?(row?.productNameAr||item.name):item.name;};
 const colorName=(item:OrderRow['items'][number])=>ar?(catalog.find(c=>c.variantId===item.variantId)?.colorAr||item.color):item.color;
 return <main className="admin-page ow-page ow-detail">{editing&&<EditOrderModal order={order} catalog={catalog} onClose={()=>setEditing(false)}/>}
 <header className="ow-heading"><div><Link href="/admin/orders" className="ow-back">{tt('Back to orders','العودة إلى الطلبات')}</Link><h1>{tt('Order details','تفاصيل الطلب')} <bdi>{order.reference}</bdi></h1><p>{order.name} · {when(order.createdAt)}</p></div><div className="ow-heading-actions">
 {next&&<button className="ow-btn ow-primary" disabled={busy!==null} onClick={()=>changeStatus(next)}>{busy?<LoaderCircle size={16} className="spin"/>:<Check size={16}/>} {nextActionLabel(next,language)}</button>}
 <button className="ow-btn" disabled={busy!==null} onClick={()=>setEditing(true)}><Pencil size={16}/>{tt('Edit order','تعديل الطلب')}</button>
 <details className="ow-menu"><summary className="ow-btn"><Printer size={16}/>{tt('Print','طباعة')}<ChevronDown size={14}/></summary><div><a href={`/admin/print/orders?type=invoice&ids=${order.id}`} target="_blank" rel="noreferrer">{tt('Invoice','فاتورة')}</a><a href={`/admin/print/orders?type=label&ids=${order.id}`} target="_blank" rel="noreferrer">{tt('Shipping label','ملصق الشحن')}</a></div></details>
 <details className="ow-menu"><summary className="ow-btn"><MoreHorizontal size={18}/>{tt('More','المزيد')}</summary><div><label>{tt('Change status','تغيير الحالة')}<select aria-label={tt('Change order status','تغيير حالة الطلب')} value={current} disabled={busy!==null} onChange={e=>changeStatus(e.target.value as OrderStatus)}>{orderStatuses.map(st=><option key={st} value={st}>{orderStatusT(st,language)}</option>)}</select></label><button className="ow-danger" disabled={busy!==null||current==='delivered'} onClick={()=>void remove()}><Trash2 size={15}/>{tt('Delete order','حذف الطلب')}</button>{current==='delivered'&&<small>{tt('Return the order before deleting it.','يجب إرجاع الطلب قبل حذفه.')}</small>}</div></details>
 </div></header>{flash}
 <section className="ow-summary"><span>{tt('Order status','حالة الطلب')}: <StatusBadge status={order.status}/></span><span>{tt('Payment status','حالة الدفع')}: <StatusBadge status={order.paymentStatus}/></span><strong>{tt('Total','الإجمالي')}: {money(order.totalCents,order.currency)}</strong></section>
 <OrderStatusBar current={current}/>
 <div className="ow-detail-grid"><section className="ow-panel ow-products"><h2><Package size={19}/>{tt('Products','المنتجات')}</h2><div className="ow-table-scroll"><table className="ow-table"><thead><tr><th>{tt('Product','المنتج')}</th><th>{tt('Quantity','الكمية')}</th><th>{tt('Unit price','سعر القطعة')}</th><th>{tt('Total','المجموع')}</th></tr></thead><tbody>{order.items.map((item,i)=>{const unit=item.unitPrice??item.priceCents??0;return <tr key={i}><td data-label={tt('Product','المنتج')}><div className="ow-product">{item.image?<img src={item.image} alt=""/>:<span><Package size={24}/></span>}<div><Link href={`/admin/products/${item.productId}`}>{productName(item)}</Link><small>{colorName(item)}</small>{(item.bundleName||item.promotionName)&&<small>{item.bundleName||item.promotionName}</small>}</div></div></td><td data-label={tt('Quantity','الكمية')}>{item.quantity}</td><td data-label={tt('Unit price','سعر القطعة')}>{money(unit,order.currency)}{item.listPrice&&item.listPrice>unit?<small><s>{money(item.listPrice,order.currency)}</s></small>:null}</td><td data-label={tt('Total','المجموع')}><strong>{money(unit*item.quantity,order.currency)}</strong></td></tr>})}</tbody></table></div>
 <dl className="ow-totals"><div><dt>{tt('Products subtotal','مجموع المنتجات')}</dt><dd>{money(order.subtotalCents,order.currency)}</dd></div>{order.discountCents>0&&<div><dt>{tt('Discount','الخصم')} {order.couponCode}</dt><dd>− {money(order.discountCents,order.currency)}</dd></div>}<div><dt>{tt('Delivery','التوصيل')}</dt><dd>{money(order.shippingCents,order.currency)}</dd></div>{order.codFeeCents>0&&<div><dt>{tt('Cash handling','رسوم الدفع عند الاستلام')}</dt><dd>{money(order.codFeeCents,order.currency)}</dd></div>}<div className="ow-grand-total"><dt>{tt('Total','الإجمالي')}</dt><dd>{money(order.totalCents,order.currency)}</dd></div></dl></section>
 <aside className="ow-side"><section className="ow-panel"><h2><UserRound size={19}/>{tt('Customer details','بيانات الزبون')}</h2><div className="ow-customer"><strong>{order.name}</strong><a href={`tel:${order.phone}`} dir="ltr">{order.phone}</a>{address.altPhone&&<a href={`tel:${address.altPhone}`} dir="ltr">{address.altPhone}</a>}{order.email&&<span dir="ltr">{order.email}</span>}<p><MapPin size={16}/> {[ar?(address.governorateAr||address.governorate||order.governorate):(address.governorate||order.governorate),address.city,address.line1,address.line2,address.landmark].filter(Boolean).join(' — ')}</p><div className="ow-row-actions">{order.phone&&<><a className="ow-btn" href={`tel:${order.phone}`}><Phone size={15}/>{tt('Call','اتصال')}</a><a className="ow-btn" href={whatsappLink(order,current==='shipped'?'shipped':'confirm')} target="_blank" rel="noreferrer"><MessageCircle size={15}/>{tt('WhatsApp','واتساب')}</a></>}</div><Link className="ow-back" href={`/admin/customers?q=${encodeURIComponent(order.phone||order.email)}`}>{tt('Customer history','سجل الزبون')}</Link></div></section>
 <section className="ow-panel"><h2><Banknote size={19}/>{tt('Payment','الدفع')}</h2><div className="ow-payment"><p>{paymentMethodLabel(order.paymentMethod,language)}</p><StatusBadge status={order.paymentStatus}/>{current!=='delivered'&&order.source!=='wholesale'&&<small>{tt('Confirming delivery marks the order paid.','عند تأكيد التوصيل تتحول حالة الدفع إلى مدفوع.')}</small>}<details><summary>{tt('Manage payment','إدارة الدفع')}</summary><div className="ow-row-actions">{order.paymentStatus!=='paid'&&<button className="ow-btn" disabled={busy!==null} onClick={()=>void patch({paymentStatus:'paid'})}>{tt('Mark paid','تسجيل كمدفوع')}</button>}{current!=='delivered'&&order.paymentStatus==='paid'&&<button className="ow-btn" disabled={busy!==null} onClick={()=>void patch({paymentStatus:'refunded'})}>{tt('Mark refunded','تسجيل كمسترجع')}</button>}{current==='delivered'&&<small>{tt('Use More to mark a returned order before recording a refund.','لتسجيل إرجاع الطلب استخدم تغيير الحالة من «المزيد».')}</small>}</div></details></div></section></aside></div>
 <details className="ow-panel ow-fold"><summary>{tt('Order notes & shipping','ملاحظات الطلب والشحن')}<ChevronDown size={17}/></summary><div className="ow-fold-body">{order.customerNote&&<p><strong>{tt('Customer note','ملاحظة الزبون')}: </strong>{order.customerNote}</p>}<p>{tt('Source','المصدر')}: {order.source}{order.sourceNote?` · ${order.sourceNote}`:''}</p><div className="admin-form-grid"><label className="admin-field"><span>{tt('Courier','شركة التوصيل')}</span><input value={courier} onChange={e=>setCourier(e.target.value)}/></label><label className="admin-field"><span>{tt('Tracking number','رقم التتبع')}</span><input value={tracking} onChange={e=>setTracking(e.target.value)}/></label><label className="admin-field admin-field-full"><span>{tt('Internal note','ملاحظة داخلية')}</span><textarea rows={3} value={note} onChange={e=>setNote(e.target.value)}/></label></div><button className="ow-btn" disabled={busy!==null} onClick={()=>void patch({trackingNumber:tracking,courier,adminNote:note})}><Save size={15}/>{tt('Save details','حفظ التفاصيل')}</button></div></details>
 <details className="ow-panel ow-fold"><summary>{tt('Costs & profit','التكلفة والربح')}<ChevronDown size={17}/></summary><div className="ow-table-scroll"><table className="ow-table"><thead><tr><th>{tt('Product','المنتج')}</th><th>{tt('Unit cost','تكلفة القطعة')}</th><th>{tt('Line profit after discount','ربح السطر بعد الخصم')}</th></tr></thead><tbody>{order.items.map((item,i)=>{const gross=order.items.reduce((s,x)=>s+(x.unitPrice??x.priceCents??0)*x.quantity,0),line=(item.unitPrice??item.priceCents??0)*item.quantity,discount=Math.min(Math.max(0,order.discountCents),gross),profit=item.purchaseCostCents==null?null:line-(gross?discount*line/gross:0)-item.purchaseCostCents*item.quantity;return <tr key={i}><td>{productName(item)}</td><td>{item.purchaseCostCents==null?tt('Unknown','غير معروفة'):money(item.purchaseCostCents,order.currency)}</td><td>{profit==null?'—':money(profit,order.currency)}</td></tr>})}</tbody></table></div></details>
 <details className="ow-panel ow-fold"><summary>{tt('Change history','سجل التغييرات')}<ChevronDown size={17}/></summary><ol className="admin-timeline">{events.map(event=><li key={event.id}><span>{when(event.createdAt)}</span><strong>{orderStatuses.includes(event.type as OrderStatus)?orderStatusT(event.type as OrderStatus,language):event.type}</strong><p>{event.message}</p></li>)}</ol></details>
 </main>;
}
