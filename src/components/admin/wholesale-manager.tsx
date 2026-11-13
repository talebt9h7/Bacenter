'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Banknote, Check, CheckCheck, ChevronLeft, ChevronRight, CircleDollarSign, Clock, Download, Eye, FileText, HandCoins, LayoutTemplate, LoaderCircle, Minus, Pencil, Plus, Printer, Save, Search, SlidersHorizontal, TrendingUp, Trash2, Users, Wallet, X } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { VariantOption } from '@/lib/admin-catalog';
import type { WholesaleInvoice } from '@/lib/wholesale-data';
import { defaultWholesaleReceipt, receiptPreviewInvoice, type WholesaleReceiptSettings } from '@/lib/wholesale-receipt';
import { normalizeIraqPhone } from '@/lib/iraq';
import { api, Modal, useFlash } from './ui';
import { WholesaleReceipt } from './wholesale-receipt';
import './wholesale-page.css';

type Line = { variantId: number; quantity: number; unitPrice: string; retailPrice: string };
const thumb = (url: string | null) => url ? (url.startsWith('/api/media/') ? `${url}?w=120` : url) : '/images/placeholder.svg';
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' });
const dateKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baghdad', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const number = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
const iqd = (value: number) => `${number(value)} د.ع`;
const isVoid = (r: WholesaleInvoice) => r.status === 'cancelled' || r.status === 'returned';
const PAGE_SIZE = 12;
type InvoiceFilter = 'all' | 'owed' | 'paid' | 'cash' | 'credit' | 'void';

export function WholesaleManager({ initial, catalog, receiptSettings = defaultWholesaleReceipt, canManage = true }: { initial: WholesaleInvoice[]; catalog: VariantOption[]; receiptSettings?: WholesaleReceiptSettings; canManage?: boolean }) {
  const { language } = useLanguage(), ar = language === 'ar';
  const tt = (en: string, a: string) => ar ? a : en;
  const [rows] = useState(initial), [template, setTemplate] = useState(receiptSettings);
  const [creating, setCreating] = useState(false), [editing, setEditing] = useState<WholesaleInvoice | null>(null), [selected, setSelected] = useState<WholesaleInvoice | null>(null), [paying, setPaying] = useState<WholesaleInvoice | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<number | null>(null), [designing, setDesigning] = useState(false);
  const [tab, setTab] = useState<'invoices' | 'traders'>('invoices'), [filter, setFilter] = useState<InvoiceFilter>('all');
  const [q, setQ] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState(''), [sort, setSort] = useState('newest'), [page, setPage] = useState(1), [moreFilters, setMoreFilters] = useState(false);
  const { flash, success, fail } = useFlash();
  const live = rows.filter(r => !isVoid(r)), monthKey = dateKey(new Date().toISOString()).slice(0, 7);
  const month = live.filter(r => dateKey(r.createdAt).startsWith(monthKey));
  const owed = live.reduce((s,r) => s+r.remaining,0), collected = live.reduce((s,r) => s+r.paid,0), revenue = live.reduce((s,r) => s+r.total,0);
  const search = q.trim().toLowerCase();
  const visible = rows.filter(r => {
    const date = dateKey(r.createdAt);
    const match = filter === 'all' || (filter === 'void' ? isVoid(r) : !isVoid(r) && (filter === 'owed' ? r.remaining > 0 : filter === 'paid' ? r.remaining === 0 : r.payment === filter));
    return match && (!search || `${r.reference} ${r.name} ${r.phone} ${r.shop} ${r.city}`.toLowerCase().includes(search)) && (!from || date >= from) && (!to || date <= to);
  }).sort((a,b) => sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : sort === 'owed' ? b.remaining-a.remaining : sort === 'total' ? b.total-a.total : b.createdAt.localeCompare(a.createdAt));
  const pages = Math.max(1, Math.ceil(visible.length/PAGE_SIZE)), currentPage = Math.min(page,pages), displayed = visible.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
  const byTrader = (() => {
    const result = new Map<string,{name:string;phone:string;shop:string;total:number;owed:number;invoices:number}>();
    for (const r of live) { const t=result.get(r.phone) ?? {name:r.name,phone:r.phone,shop:r.shop,total:0,owed:0,invoices:0};t.total+=r.total;t.owed+=r.remaining;t.invoices++;result.set(r.phone,t); }
    return [...result.values()].sort((a,b)=>b.owed-a.owed||b.total-a.total);
  })();
  const matchingTraders = byTrader.filter(t=>!search||`${t.name} ${t.phone} ${t.shop}`.toLowerCase().includes(search));
  const changeFilter = (next: InvoiceFilter) => {setFilter(next);setPage(1);};
  const refresh = () => location.reload();
  async function loadInvoice(id: number, action: 'edit' | 'view' | 'payment') {
    setLoadingEdit(id);
    try { const {invoice}=await api<{invoice:WholesaleInvoice}>(`/api/admin/wholesale/${id}`);setSelected(null);if(action==='edit')setEditing(invoice);else if(action==='payment')setPaying(invoice);else setSelected(invoice); }
    catch(e){fail(e);}finally{setLoadingEdit(null);}
  }
  function exportCsv() {
    const cell=(value:unknown)=>{let s=String(value??'');if(typeof value==='string'&&/^[=+\-@\t\r]/.test(s))s=`'${s}`;return `"${s.replaceAll('"','""')}"`;};
    const content=[['الفاتورة','التاجر','الهاتف','المحل','التاريخ','الإجمالي','المقبوض','المتبقي','الحالة'],...visible.map(r=>[r.reference,r.name,r.phone,r.shop,day(r.createdAt),r.total,r.paid,r.remaining,isVoid(r)?'ملغاة':r.remaining?'غير مسددة':'مسددة'])].map(row=>row.map(cell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download=`wholesale-${dateKey(new Date().toISOString())}.csv`;a.click();URL.revokeObjectURL(url);
  }
  const status = (r:WholesaleInvoice) => <span className={`wd-status ${isVoid(r)?'void':r.remaining===0?'paid':r.paid>0?'partial':'unpaid'}`}><i />{isVoid(r)?tt('Voided','ملغاة / مرتجعة'):r.remaining===0?tt('Paid','مسددة'):r.paid>0?tt('Partially paid','مسددة جزئياً'):tt('Unpaid','غير مسددة')}</span>;
  return <main className="admin-page ws-page" dir={ar?'rtl':'ltr'}>
    {flash}
    <div className="wd-breadcrumb"><span>{tt('Administration','الإدارة')}</span><ChevronLeft size={12}/><span>{tt('Sales','المبيعات')}</span><ChevronLeft size={12}/><b>{tt('Wholesale','بيع الجملة')}</b></div>
    <header className="wd-header"><div><div className="wd-eyebrow"><span/> WHOLESALE MANAGEMENT</div><h1>{tt('Wholesale, made simple.','بيع الجملة، بكل وضوح.')}<span>{tt('Your invoices, traders and balances in one workspace.','فواتيرك، تجارك وأرصدتك بمكان واحد.')}</span></h1></div><div className="wd-header-actions">{canManage&&<><button type="button" className="wd-btn" onClick={()=>setDesigning(true)}><LayoutTemplate size={16}/>{tt('Receipt design','تصميم الوصل')}</button><button type="button" className="wd-btn wd-primary" onClick={()=>setCreating(true)}><Plus size={17}/>{tt('New invoice','فاتورة جديدة')}</button></>}</div></header>
    <section className="wd-metrics" aria-label={tt('Wholesale summary','ملخص بيع الجملة')}>
      <div className="wd-metric"><span className="wd-metric-icon"><CircleDollarSign size={19}/></span><span>{tt('Sales this month','مبيعات هذا الشهر')}</span><strong>{number(month.reduce((s,r)=>s+r.total,0))}<small>{tt('IQD','د.ع')}</small></strong><p><TrendingUp size={12}/>{month.length} {tt('invoices recorded','فاتورة مسجلة')}</p></div>
      <button className="wd-metric wd-metric-owed" type="button" onClick={()=>{setTab('invoices');changeFilter('owed');}}><span className="wd-metric-icon"><Wallet size={19}/></span><span>{tt('Outstanding balances','مبالغ بذمة التجار')}</span><strong>{number(owed)}<small>{tt('IQD','د.ع')}</small></strong><p>{live.filter(r=>r.remaining>0).length} {tt('invoices to collect','فاتورة بانتظار التسديد')}<ArrowLeft size={13}/></p></button>
      <div className="wd-metric"><span className="wd-metric-icon wd-green"><Banknote size={19}/></span><span>{tt('Money received','المبالغ المقبوضة')}</span><strong>{number(collected)}<small>{tt('IQD','د.ع')}</small></strong><p><CheckCheck size={13}/>{tt('Recorded against invoices','دفعات مسجلة على الفواتير')}</p></div>
      <div className="wd-metric"><span className="wd-metric-icon wd-blue"><Users size={19}/></span><span>{tt('Trading partners','التجار المتعاملين')}</span><strong>{number(byTrader.length)}<small>{tt('traders','تاجر')}</small></strong><p>{tt('Wholesale profit','ربح الجملة')}: {iqd(live.reduce((s,r)=>s+r.profit,0))}</p></div>
    </section>
    <div className="wd-workspace-grid"><section className="wd-panel wd-main-panel"><div className="wd-panel-heading"><div className="wd-tabs" role="tablist" aria-label={tt('Wholesale views','أقسام بيع الجملة')}><button type="button" role="tab" aria-selected={tab==='invoices'} className={tab==='invoices'?'is-active':''} onClick={()=>setTab('invoices')}><FileText size={16}/>{tt('Invoices','الفواتير')}<span>{rows.length}</span></button><button type="button" role="tab" aria-selected={tab==='traders'} className={tab==='traders'?'is-active':''} onClick={()=>setTab('traders')}><Users size={16}/>{tt('Traders','التجار')}</button></div><button type="button" className="wd-icon-btn" onClick={exportCsv} title={tt('Export matching invoices','تصدير الفواتير المطابقة')} aria-label={tt('Export invoices to Excel','تصدير الفواتير إلى Excel')}><Download size={16}/></button></div>
      <div className="wd-tools"><label className="wd-search"><Search size={17}/><input value={q} onChange={e=>{setQ(e.target.value);setPage(1);}} placeholder={tt('Search invoice, trader or phone…','ابحث برقم الفاتورة، اسم التاجر أو الموبايل…')} aria-label={tt('Search wholesale','البحث في بيع الجملة')}/>{q&&<button type="button" aria-label={tt('Clear search','مسح البحث')} onClick={()=>{setQ('');setPage(1);}}><X size={14}/></button>}</label><button type="button" className={`wd-btn wd-filter-btn ${moreFilters?'is-active':''}`} onClick={()=>setMoreFilters(v=>!v)} aria-expanded={moreFilters}><SlidersHorizontal size={15}/>{tt('Filters','تصفية')}{(from||to)&&<i/>}</button></div>
      {moreFilters&&<div className="wd-expanded-filters"><label><span>{tt('From date','من تاريخ')}</span><input type="date" value={from} max={to||undefined} onChange={e=>{setFrom(e.target.value);setPage(1);}}/></label><label><span>{tt('To date','إلى تاريخ')}</span><input type="date" value={to} min={from||undefined} onChange={e=>{setTo(e.target.value);setPage(1);}}/></label><label><span>{tt('Order by','الترتيب')}</span><select value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="newest">{tt('Newest first','الأحدث أولاً')}</option><option value="oldest">{tt('Oldest first','الأقدم أولاً')}</option><option value="owed">{tt('Largest balance','الأكثر ديناً')}</option><option value="total">{tt('Largest total','الأعلى قيمة')}</option></select></label><button className="wd-reset-filters" type="button" onClick={()=>{setQ('');setFrom('');setTo('');setSort('newest');setFilter('all');setPage(1);}}>{tt('Reset','مسح التصفية')}</button></div>}
      {tab==='invoices'?<><div className="wd-filter-chips">{(['all','owed','paid','cash','credit','void'] as InvoiceFilter[]).map(f=><button type="button" className={filter===f?'is-active':''} key={f} onClick={()=>changeFilter(f)}>{f==='all'?tt('All invoices','الكل'):f==='owed'?tt('Outstanding','عليها رصيد'):f==='paid'?tt('Paid','مسددة'):f==='cash'?tt('Cash','نقد'):f==='credit'?tt('Credit','آجل'):tt('Voided','ملغاة')}</button>)}</div>
      {!visible.length?<div className="wd-empty"><span><FileText size={28}/></span><h3>{rows.length?tt('No matching invoices','ماكو فواتير مطابقة'):tt('Your first wholesale sale starts here','أول فاتورة جملة تبدأ من هنا')}</h3><p>{rows.length?tt('Try another search or clear your filters.','جرّب بحث ثاني أو امسح التصفية.'):tt('Create an invoice, choose products and keep the balance organized.','أنشئ فاتورة، اختار المنتجات، وخلي الحسابات مرتبة.')}</p>{!rows.length&&canManage&&<button type="button" className="wd-btn wd-primary" onClick={()=>setCreating(true)}><Plus size={16}/>{tt('Create invoice','إنشاء فاتورة')}</button>}</div>:<><div className="wd-table-scroll wd-invoices-table"><table className="wd-table"><thead><tr><th>{tt('Invoice / date','الفاتورة / التاريخ')}</th><th>{tt('Trader','التاجر')}</th><th>{tt('Total','الإجمالي')}</th><th>{tt('Remaining','المتبقي')}</th><th>{tt('Status','الحالة')}</th><th className="wd-actions-heading">{tt('Actions','الإجراءات')}</th></tr></thead><tbody>{displayed.map(r=><tr key={r.id} className={isVoid(r)?'wd-void-row':''}><td><button className="wd-reference" type="button" onClick={()=>void loadInvoice(r.id,'view')} disabled={loadingEdit!==null}>{r.reference}</button><small>{day(r.createdAt)}<span>·</span>{r.items.reduce((s,i)=>s+i.quantity,0)} {tt('pcs','قطعة')}</small></td><td><div className="wd-trader-cell"><span className="wd-avatar">{r.name.slice(0,1)}</span><div><b>{r.name}</b><small>{r.shop||r.phone}</small></div></div></td><td className="wd-money"><b>{number(r.total)}</b><small>{r.payment==='credit'?tt('Credit','آجل'):tt('Cash','نقد')} · {tt('IQD','د.ع')}</small></td><td className={`wd-money ${!isVoid(r)&&r.remaining>0?'wd-outstanding':''}`}><b>{isVoid(r)?'—':number(r.remaining)}</b><small>{!isVoid(r)&&r.remaining>0?`${tt('Received','مقبوض')} ${number(r.paid)}`:isVoid(r)?tt('Voided invoice','فاتورة غير فعالة'):tt('Fully received','مقبوض بالكامل')}</small></td><td>{status(r)}</td><td><div className="wd-row-actions">{canManage&&r.status==='delivered'&&<button type="button" className="wd-icon-btn" title={tt('Edit invoice','تعديل الفاتورة')} aria-label={`${tt('Edit invoice','تعديل الفاتورة')} ${r.reference}`} disabled={loadingEdit!==null} onClick={()=>void loadInvoice(r.id,'edit')}>{loadingEdit===r.id?<LoaderCircle size={15} className="spin"/>:<Pencil size={15}/>}</button>}<a className="wd-icon-btn" title={tt('Preview & print','معاينة وطباعة')} aria-label={`${tt('Print invoice','طباعة الوصل')} ${r.reference}`} href={`/admin/print/wholesale/${r.id}`} target="_blank" rel="noreferrer"><Printer size={15}/></a><button type="button" className="wd-icon-btn" title={tt('Details','التفاصيل')} aria-label={`${tt('Invoice details','تفاصيل الفاتورة')} ${r.reference}`} disabled={loadingEdit!==null} onClick={()=>void loadInvoice(r.id,'view')}><Eye size={15}/></button></div></td></tr>)}</tbody></table></div><div className="wd-invoice-cards">{displayed.map(r=><article key={r.id} className={isVoid(r)?'wd-void-row':''}><div className="wd-mobile-card-top"><button type="button" className="wd-reference" onClick={()=>void loadInvoice(r.id,'view')}>{r.reference}</button>{status(r)}</div><div className="wd-trader-cell"><span className="wd-avatar">{r.name.slice(0,1)}</span><div><b>{r.name}</b><small>{r.shop||r.phone} · {day(r.createdAt)}</small></div></div><dl><div><dt>{tt('Invoice total','إجمالي الفاتورة')}</dt><dd>{iqd(r.total)}</dd></div><div><dt>{tt('Remaining','المتبقي')}</dt><dd className={r.remaining&&!isVoid(r)?'wd-outstanding':''}>{isVoid(r)?'—':iqd(r.remaining)}</dd></div></dl><div className="wd-mobile-card-actions">{canManage&&r.status==='delivered'&&<button type="button" className="wd-btn" disabled={loadingEdit!==null} aria-label={`${tt('Edit invoice','تعديل الفاتورة')} ${r.reference}`} onClick={()=>void loadInvoice(r.id,'edit')}><Pencil size={14}/>{tt('Edit','تعديل')}</button>}<a className="wd-btn" href={`/admin/print/wholesale/${r.id}`} target="_blank" rel="noreferrer"><Printer size={14}/>{tt('Receipt','الوصل')}</a><button type="button" className="wd-btn" disabled={loadingEdit!==null} aria-label={`${tt('Invoice details','تفاصيل الفاتورة')} ${r.reference}`} onClick={()=>void loadInvoice(r.id,'view')}><Eye size={14}/>{tt('Details','التفاصيل')}</button></div></article>)}</div></>}
      <footer className="wd-table-footer"><span>{visible.length?`${(currentPage-1)*PAGE_SIZE+1}–${Math.min(currentPage*PAGE_SIZE,visible.length)}`:'0'} {tt('of','من')} {visible.length} {tt('invoices','فاتورة')}</span><div><button type="button" className="wd-icon-btn" aria-label={tt('Previous page','الصفحة السابقة')} disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}><ChevronRight size={16}/></button><span>{currentPage} / {pages}</span><button type="button" className="wd-icon-btn" aria-label={tt('Next page','الصفحة التالية')} disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}><ChevronLeft size={16}/></button></div></footer></>:<div className="wd-trader-grid">{matchingTraders.map(t=><article key={t.phone}><div className="wd-trader-card-head"><span className="wd-avatar">{t.name.slice(0,1)}</span><div><h3>{t.name}</h3><a href={`tel:${t.phone}`} dir="ltr">{t.phone}</a></div><span>{t.invoices} {tt('invoices','فاتورة')}</span></div><dl><div><dt>{tt('Purchases','المشتريات')}</dt><dd>{iqd(t.total)}</dd></div><div><dt>{tt('Outstanding','المتبقي')}</dt><dd className={t.owed?'wd-outstanding':'wd-settled'}>{iqd(t.owed)}</dd></div></dl><button type="button" onClick={()=>{setTab('invoices');setQ(t.phone);setFilter('all');setPage(1);}}>{tt('View invoices','عرض الفواتير')}<ArrowLeft size={14}/></button></article>)}{!matchingTraders.length&&<p className="wd-empty">{byTrader.length?tt('No traders match your search.','ماكو تجار مطابقين للبحث.'):tt('Traders appear after the first invoice.','التجار يظهرون بعد أول فاتورة.')}</p>}</div>}
    </section>
    <aside className="wd-sidebar"><section className="wd-panel wd-balance-card"><div className="wd-side-heading"><span><Wallet size={16}/>{tt('Collection overview','متابعة التحصيل')}</span><small>{tt('Recorded invoices','الفواتير المسجلة')}</small></div><strong>{revenue?Math.min(100,Math.round(collected/revenue*100)):0}<small>%</small></strong><p>{tt('of invoice value collected','من قيمة الفواتير تم تحصيلها')}</p><div className="wd-progress"><i style={{width:`${revenue?Math.min(100,collected/revenue*100):0}%`}}/></div><dl><div><dt><i/>{tt('Received','مقبوض')}</dt><dd>{iqd(collected)}</dd></div><div><dt><i/>{tt('Outstanding','متبقي')}</dt><dd>{iqd(owed)}</dd></div></dl></section>
    <section className="wd-panel wd-traders-side"><div className="wd-side-heading"><span>{tt('Balances to follow up','أرصدة تحتاج متابعة')}</span><button type="button" onClick={()=>setTab('traders')}>{tt('View all','عرض الكل')}</button></div>{byTrader.filter(t=>t.owed>0).slice(0,5).map(t=><button type="button" className="wd-trader-balance" key={t.phone} onClick={()=>{setQ(t.phone);setTab('invoices');setFilter('owed');setPage(1);}}><span className="wd-avatar">{t.name.slice(0,1)}</span><span><b>{t.name}</b><small>{t.invoices} {tt('invoices','فاتورة')}</small></span><strong>{number(t.owed)}<small>{tt('IQD','د.ع')}</small></strong></button>)}{!owed&&<p className="wd-all-clear"><Check size={18}/>{tt('All balances are settled.','كل الأرصدة مسددة.')}</p>}</section>
    <section className="wd-receipt-promo"><span><LayoutTemplate size={21}/></span><h3>{tt('A receipt that represents your store.','وصل يشبه هوية متجرك.')}</h3><p>{tt('Customize your logo, columns and notes. Preview before you print.','عدّل الشعار والأعمدة والملاحظات، وشوف النتيجة قبل الطباعة.')}</p>{canManage&&<button type="button" onClick={()=>setDesigning(true)}>{tt('Customize receipt','تخصيص الوصل')}<ArrowLeft size={15}/></button>}</section></aside></div>
    <p className="wd-data-note">{tt('Summary and search cover the loaded invoices, up to the latest 300.','الملخص والبحث يشملان الفواتير المحمّلة، بحد أقصى أحدث 300 فاتورة.')}</p>
    {creating&&<InvoiceEditor catalog={catalog} onClose={()=>setCreating(false)} onCreated={id=>{setCreating(false);window.open(`/admin/print/wholesale/${id}`,'_blank');refresh();}} onError={fail}/>}
    {editing&&<InvoiceEditor key={editing.updatedAt} invoice={editing} catalog={catalog} onClose={()=>setEditing(null)} onCreated={()=>{setEditing(null);refresh();}} onError={fail}/>}
    {selected&&<InvoiceDetails invoice={selected} canManage={canManage} onClose={()=>setSelected(null)} onEdit={()=>void loadInvoice(selected.id,'edit')} onPayment={()=>void loadInvoice(selected.id,'payment')} />}
    {paying&&<PaymentModal invoice={paying} onClose={()=>setPaying(null)} onDone={()=>{setPaying(null);success(tt('Payment recorded.','تم تحديث الدفعات.'));refresh();}} onError={fail}/>}
    {designing&&<ReceiptDialog><WholesaleReceipt invoice={rows.find(r=>!isVoid(r))??receiptPreviewInvoice} initialSettings={template} canManage={canManage} embedded onClose={()=>setDesigning(false)} onSaved={setTemplate}/></ReceiptDialog>}
  </main>;
}

function ReceiptDialog({ children }: { children: React.ReactNode }) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const before=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';ref.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')ref.current?.querySelector<HTMLButtonElement>('button[aria-label="إغلاق إعدادات الوصل"]')?.click();if(e.key==='Tab'){const focusable=ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not([type=hidden]),select,textarea,summary');if(!focusable?.length)return;const items=[...focusable].filter(el=>el.getClientRects().length),first=items[0],last=items[items.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',key);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);before?.focus();};},[]);
  return <div className="wd-receipt-overlay" role="dialog" aria-modal="true" aria-label="تصميم وصل الجملة" ref={ref} tabIndex={-1}>{children}</div>;
}

function InvoiceDetails({ invoice:r,canManage,onClose,onEdit,onPayment }: {invoice:WholesaleInvoice;canManage:boolean;onClose:()=>void;onEdit:()=>void;onPayment:()=>void}) {
  return <Modal title={`تفاصيل الفاتورة · ${r.reference}`} onClose={onClose} wide><div className="wd-detail-heading"><div><span>فاتورة بيع بالجملة</span><h3>{r.name}</h3><p>{r.shop}{r.city?` · ${r.city}`:''} · <bdi>{r.phone}</bdi></p></div><b>{iqd(r.total)}</b></div><div className="wd-detail-meta"><span>تاريخ البيع <b>{day(r.createdAt)}</b></span><span>الدفع <b>{r.payment==='credit'?'آجل':'نقد'}</b></span><span>المقبوض <b>{iqd(r.paid)}</b></span><span>المتبقي <b>{iqd(r.remaining)}</b></span></div><div className="wd-table-scroll"><table className="wd-table"><thead><tr><th>المنتج</th><th>الكمية</th><th>سعر الجملة</th><th>الإجمالي</th></tr></thead><tbody>{r.items.map((i,k)=><tr key={k}><td><b>{i.nameAr||i.name}</b><small>{i.colorAr||i.color}</small></td><td>{i.quantity}</td><td>{iqd(i.unitPrice)}</td><td>{iqd(i.unitPrice*i.quantity)}</td></tr>)}</tbody></table></div>{r.discount>0&&<p className="wd-detail-note">الخصم: {iqd(r.discount)}</p>}{r.note&&<p className="wd-detail-note">{r.note}</p>}<h4 className="wd-section-title">الدفعات المسجلة <span>{r.payments.length}</span></h4>{r.payments.length?<div className="wd-payment-list">{r.payments.map(p=><div key={p.id}><span className="wd-payment-icon"><Banknote size={16}/></span><span><b>{iqd(p.amount)}</b><small>{day(p.createdAt)}{p.note?` · ${p.note}`:''}</small></span><Check size={16}/></div>)}</div>:<p className="admin-hint">لا توجد دفعات مسجلة.</p>}<div className="admin-modal-actions"><a className="wd-btn" href={`/admin/print/wholesale/${r.id}`} target="_blank" rel="noreferrer"><Printer size={16}/>معاينة وطباعة</a>{canManage&&r.status==='delivered'&&<><button type="button" className="wd-btn" onClick={onEdit}><Pencil size={15}/>تعديل الفاتورة</button><button type="button" className="wd-btn wd-primary" onClick={onPayment}><HandCoins size={16}/>إدارة الدفعات</button></>}</div></Modal>;
}

function InvoiceEditor({ catalog: sourceCatalog, invoice, onClose, onCreated, onError }: { catalog: VariantOption[]; invoice?: WholesaleInvoice; onClose: () => void; onCreated: (id: number) => void; onError: (e: unknown) => void }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, a: string) => ar ? a : en;
  const [name, setName] = useState(invoice?.name ?? ''), [phone, setPhone] = useState(invoice?.phone ?? ''), [shop, setShop] = useState(invoice?.shop ?? ''), [city, setCity] = useState(invoice?.city ?? ''), [note, setNote] = useState(invoice?.note ?? '');
  const [payment, setPayment] = useState<'cash' | 'credit'>(invoice?.payment ?? 'cash');
  const [paid, setPaid] = useState(''), [discount, setDiscount] = useState(invoice ? String(invoice.discount) : '');
  const [lines, setLines] = useState<Line[]>(() => {
    const grouped = new Map<number, Line>();
    for (const item of invoice?.items ?? []) {
      const before = grouped.get(item.variantId);
      grouped.set(item.variantId, { variantId: item.variantId, quantity: (before?.quantity ?? 0) + item.quantity, unitPrice: before?.unitPrice ?? String(item.unitPrice), retailPrice: before?.retailPrice ?? String(item.listPrice) });
    }
    return [...grouped.values()];
  });
  const catalog = useMemo(() => {
    const own = new Map<number, number>();
    for (const item of invoice?.items ?? []) own.set(item.variantId, (own.get(item.variantId) ?? 0) + item.quantity);
    const result = sourceCatalog.map(v => ({ ...v, available: v.available + (own.get(v.variantId) ?? 0) }));
    for (const item of invoice?.items ?? []) if (!result.some(v => v.variantId === item.variantId)) result.push({ variantId: item.variantId, productId: item.productId, productName: item.name, productNameAr: item.nameAr || item.name, color: item.color, colorAr: item.colorAr || item.color, hex: '#777', available: own.get(item.variantId) ?? 0, salePriceIqd: item.listPrice, wholesalePriceIqd: item.unitPrice, image: item.image, published: false, category: '' });
    return result;
  }, [sourceCatalog, invoice]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const byId = useMemo(() => new Map(catalog.map(v => [v.variantId, v])), [catalog]);
  const results = catalog.filter(v => !q || `${v.productName} ${v.productNameAr} ${v.color} ${v.colorAr}`.toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  const add = (v: VariantOption) => setLines(ls => ls.some(l => l.variantId === v.variantId) ? ls.map(l => l.variantId === v.variantId ? { ...l, quantity: l.quantity + 1 } : l) : [...ls, { variantId: v.variantId, quantity: 1, unitPrice: String(v.wholesalePriceIqd || ''), retailPrice: String(v.salePriceIqd || '') }]);
  const set = (id: number, patch: Partial<Line>) => setLines(ls => ls.map(l => l.variantId === id ? { ...l, ...patch } : l).filter(l => l.quantity > 0));
  const subtotal = lines.reduce((s, l) => s + (Number(l.unitPrice) || 0) * l.quantity, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));
  const over = lines.some(l => l.quantity > (byId.get(l.variantId)?.available ?? 0));
  const overpaid = !!invoice && total < invoice.paid;
  const effectivePayment = invoice && total > invoice.paid ? 'credit' : payment;
  const valid = !overpaid && name.trim().length >= 2 && /^07\d{9}$/.test(normalizeIraqPhone(phone)) && lines.length > 0 && lines.every(l => Number(l.unitPrice) > 0) && !over;
  async function submit() {
    setBusy(true); setSaveError('');
    try {
      const r = await api<{ id: number }>(invoice ? `/api/admin/wholesale/${invoice.id}` : '/api/admin/wholesale', { method: invoice ? 'PUT' : 'POST', json: { expectedUpdatedAt: invoice?.updatedAt, name, phone, shop, city, note, payment: effectivePayment, paid: payment === 'credit' ? Number(paid) || 0 : undefined, discount: Number(discount) || 0, items: lines.map(l => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: Math.round(Number(l.unitPrice)), retailPrice: Math.round(Number(l.retailPrice) || 0) })) } });
      onCreated(r.id);
    } catch (e) { setSaveError(e instanceof Error ? e.message : String(e)); onError(e); } finally { setBusy(false); }
  }
  return <Modal title={invoice ? tt(`Edit invoice · ${invoice.reference}`, `تعديل الفاتورة · ${invoice.reference}`) : tt('New wholesale invoice', 'فاتورة جملة جديدة')} onClose={() => { if (!busy) onClose(); }} wide>
    <div className="ws-editor">
      <section>
        <h3 className="pce-title">{tt('1. Trader', '1. التاجر')}</h3>
        <div className="pce-pair">
          <label className="admin-field"><span>{tt('Name', 'الاسم')}</span><input value={name} onChange={e => setName(e.target.value)} placeholder={tt('Trader name', 'اسم التاجر')} /></label>
          <label className="admin-field"><span>{tt('Mobile', 'رقم الموبايل')}</span><input dir="ltr" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XXXXXXXXX" /></label>
          <label className="admin-field"><span>{tt('Shop (optional)', 'اسم المحل (اختياري)')}</span><input value={shop} onChange={e => setShop(e.target.value)} /></label>
          <label className="admin-field"><span>{tt('City (optional)', 'المدينة (اختياري)')}</span><input value={city} onChange={e => setCity(e.target.value)} /></label>
        </div>
        <h3 className="pce-title">{tt('2. Products', '2. المنتجات')}</h3>
        <label className="admin-search"><Search size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder={tt('Search products…', 'ابحث عن منتج…')} /></label>
        <div className="bundle-pick">{results.map(v => <button type="button" key={v.variantId} onClick={() => add(v)} className={lines.some(l => l.variantId === v.variantId) ? 'on' : ''} disabled={v.available <= 0}>
          <img src={thumb(v.image)} alt="" /><span><b>{ar ? v.productNameAr || v.productName : v.productName}</b><small><i style={{ background: v.hex }} /> {ar ? v.colorAr || v.color : v.color} · {tt('wholesale', 'جملة')} {v.wholesalePriceIqd ? iqd(v.wholesalePriceIqd) : '—'} · {tt(`${v.available} in stock`, `بالمخزون ${v.available}`)}</small></span><Plus size={14} />
        </button>)}</div>
      </section>
      <section>
        <h3 className="pce-title">{tt('3. Invoice', '3. الفاتورة')}</h3>
        {!lines.length ? <p className="admin-hint">{tt('Add products from the list.', 'أضف منتجات من القائمة.')}</p> : <div className="ws-lines">{lines.map(l => { const v = byId.get(l.variantId)!; const profit = (Number(l.retailPrice) || 0) - (Number(l.unitPrice) || 0); return <div key={l.variantId} className={`ws-line ${l.quantity > v.available ? 'is-over' : ''}`}>
          <img src={thumb(v.image)} alt="" />
          <div className="ws-line-main"><b>{ar ? v.productNameAr || v.productName : v.productName}</b><small>{ar ? v.colorAr || v.color : v.color}{l.quantity > v.available ? ` · ${tt(`only ${v.available} in stock`, `بس ${v.available} بالمخزون`)}` : ''}</small>
            <div className="ws-line-fields">
              <label><span>{tt('Wholesale', 'جملة')}</span><input type="number" min="0" step="250" value={l.unitPrice} onChange={e => set(l.variantId, { unitPrice: e.target.value })} /></label>
              <label><span>{tt('Retail (fixed)', 'المفرد (ثابت)')}</span><input type="number" min="0" step="250" value={l.retailPrice} onChange={e => set(l.variantId, { retailPrice: e.target.value })} /></label>
              <div className="bundle-qty"><button type="button" onClick={() => set(l.variantId, { quantity: l.quantity - 1 })}><Minus size={12} /></button><input type="number" min="1" value={l.quantity} onChange={e => set(l.variantId, { quantity: Math.max(0, Math.round(Number(e.target.value) || 0)) })} /><button type="button" onClick={() => set(l.variantId, { quantity: l.quantity + 1 })}><Plus size={12} /></button></div>
            </div>
            {profit > 0 && Number(l.retailPrice) > 0 && <small className="ws-profit">{tt('Trader profit', 'ربح التاجر')}: {iqd(profit)} ({Math.round(profit / Number(l.retailPrice) * 100)}%) · {tt('line total', 'إجمالي السطر')} {iqd((Number(l.unitPrice) || 0) * l.quantity)}</small>}
          </div>
          <button type="button" className="ws-remove" aria-label={tt('Remove', 'حذف')} onClick={() => set(l.variantId, { quantity: 0 })}><Trash2 size={14} /></button>
        </div>; })}</div>}
        <div className="bundle-sum">
          <div><span>{tt('Subtotal', 'المجموع')}</span><b>{iqd(subtotal)}</b></div>
          <label className="admin-field"><span>{tt('Discount (IQD, optional)', 'خصم (دينار، اختياري)')}</span><input type="number" min="0" step="250" value={discount} onChange={e => setDiscount(e.target.value)} /></label>
          <div className="good"><span>{tt('Invoice total', 'إجمالي الفاتورة')}</span><b>{iqd(total)}</b></div>
          <div className="ws-pay-type">{(['cash', 'credit'] as const).map(p => <button key={p} type="button" className={effectivePayment === p ? 'on' : ''} disabled={!!invoice && p === 'cash' && total > invoice.paid} onClick={() => setPayment(p)}>{p === 'cash' ? <><Banknote size={15} /> {invoice ? tt('Cash', 'نقد') : tt('Cash — paid now', 'نقد — مدفوع هسه')}</> : <><Clock size={15} /> {tt('Credit (آجل)', 'آجل')}</>}</button>)}</div>
          {!invoice && payment === 'credit' && <label className="admin-field"><span>{tt('Paid now (optional)', 'المدفوع هسه (اختياري)')}</span><input type="number" min="0" step="250" max={total} value={paid} onChange={e => setPaid(e.target.value)} placeholder="0" /><small>{tt('Remaining', 'المتبقي')}: {iqd(Math.max(0, total - (Number(paid) || 0)))}</small></label>}
          {invoice && <><div><span>{tt('Already received', 'المقبوض سابقاً')}</span><b>{iqd(invoice.paid)}</b></div><div><span>{tt('Remaining after saving', 'المتبقي بعد التعديل')}</span><b>{iqd(Math.max(0, total - invoice.paid))}</b></div><p className="admin-hint">{tt('Recorded payments stay unchanged. An unpaid increase becomes credit. Use Receive payment to collect more.', 'الدفعات المسجلة تبقى مثل ما هي. الزيادة غير المقبوضة تصير آجل؛ استخدم قبض دفعة لتسجيل مبلغ جديد.')}</p>{overpaid && <p role="alert" className="admin-error">{tt('The total cannot be lower than money already received. Resolve the refund before reducing this invoice.', 'الإجمالي أقل من المقبوض. عالج ردّ المبلغ قبل تقليل الفاتورة.')}</p>}</>}
        </div>
        <label className="admin-field"><span>{tt('Note (optional)', 'ملاحظة (اختياري)')}</span><textarea rows={2} value={note} onChange={e => setNote(e.target.value)} /></label>
      </section>
    </div>
    {saveError && <p role="alert" className="admin-error">{saveError}</p>}
    <div className="admin-modal-actions"><button type="button" className="admin-btn admin-btn-ghost" disabled={busy} onClick={onClose}><X size={14} /> {tt('Cancel', 'إلغاء')}</button><button type="button" className="admin-btn admin-btn-primary" disabled={!valid || busy} onClick={() => void submit()}>{busy ? <LoaderCircle size={14} className="spin" /> : invoice ? <Save size={14} /> : <Printer size={14} />} {invoice ? tt('Save changes', 'حفظ التعديلات') : tt('Create invoice & print', 'إنشاء الفاتورة وطباعتها')}</button></div>
  </Modal>;
}

function PaymentModal({ invoice, onClose, onDone, onError }: { invoice: WholesaleInvoice; onClose: () => void; onDone: (paid: number, remaining: number) => void; onError: (e: unknown) => void }) {
  const [correcting, setCorrecting] = useState<WholesaleInvoice['payments'][number] | null>(null);
  const [amount, setAmount] = useState(invoice.remaining > 0 ? String(invoice.remaining) : '');
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const limit = correcting ? invoice.total - invoice.paid + correcting.amount : invoice.remaining;
  const numeric = Number(amount), valid = amount.trim() !== '' && Number.isSafeInteger(numeric) && numeric >= (correcting ? 0 : 1) && numeric <= limit;
  function select(p: WholesaleInvoice['payments'][number] | null) { setCorrecting(p); setAmount(p ? String(p.amount) : String(invoice.remaining)); setNote(p?.note || ''); setError(''); }
  async function submit() {
    if (!valid) return; setBusy(true); setError('');
    try { const r = await api<{ paid: number; remaining: number }>(`/api/admin/wholesale/${invoice.id}/payments`, { method: correcting ? 'PATCH' : 'POST', json: { paymentId: correcting?.id, expectedUpdatedAt: invoice.updatedAt, amount: numeric, note } }); onDone(r.paid, r.remaining); }
    catch (e) { setError(e instanceof Error ? e.message : 'تعذر حفظ الدفعة.'); onError(e); } finally { setBusy(false); }
  }
  return <Modal title={`إدارة الدفعات · ${invoice.reference}`} onClose={() => { if (!busy) onClose(); }}>
    <div className="wd-payment-summary"><span>إجمالي الفاتورة<b>{iqd(invoice.total)}</b></span><span>المقبوض<b>{iqd(invoice.paid)}</b></span><span>المتبقي<b>{iqd(invoice.remaining)}</b></span></div>
    {invoice.payments.length > 0 && <><h4 className="wd-section-title">الدفعات السابقة</h4><div className="wd-payment-list">{invoice.payments.map(p => <div key={p.id}><span className="wd-payment-icon"><Banknote size={16} /></span><span><b>{iqd(p.amount)}</b><small>{day(p.createdAt)}{p.note ? ` · ${p.note}` : ''}</small></span><button type="button" className="wd-icon-btn" disabled={busy} aria-label={`تعديل الدفعة ${p.id}`} title="تصحيح الدفعة" onClick={() => select(p)}><Pencil size={14} /></button></div>)}</div></>}
    <h4 className="wd-section-title">{correcting ? 'تصحيح دفعة مسجلة' : 'قبض دفعة جديدة'}{correcting && <button className="wd-reset-filters" type="button" disabled={busy} onClick={() => select(null)}>إلغاء التصحيح</button>}</h4>
    {correcting && <p className="admin-hint">المبلغ السابق: {iqd(correcting.amount)}. التصحيح يبقى مسجلاً في سجل النشاط، ولا يغيّر تاريخ الدفعة أو المخزون. يمكن إدخال صفر لإلغاء أثر قبض مسجل بالخطأ.</p>}
    {(invoice.remaining > 0 || correcting) ? <><label className="admin-field"><span>المبلغ بالدينار</span><input type="number" min={correcting ? 0 : 1} max={limit} step="1" value={amount} disabled={busy} onChange={e => setAmount(e.target.value)} /></label><label className="admin-field"><span>ملاحظة</span><input value={note} maxLength={200} disabled={busy} onChange={e => setNote(e.target.value)} placeholder="سبب التصحيح أو تفاصيل القبض" /></label>{error && <p className="admin-error" role="alert">{error}</p>}<div className="admin-modal-actions"><button type="button" className="wd-btn" onClick={onClose} disabled={busy}>إلغاء</button><button type="button" className="wd-btn wd-primary" disabled={busy || !valid} onClick={() => void submit()}>{busy ? <LoaderCircle size={15} className="spin" /> : <HandCoins size={15} />}{correcting ? 'حفظ تصحيح الدفعة' : 'تسجيل الدفعة'}</button></div></> : <p className="wd-all-clear"><CheckCheck size={18} /> الفاتورة مسددة بالكامل. تستطيع تصحيح دفعة سابقة من القائمة.</p>}
  </Modal>;
}
