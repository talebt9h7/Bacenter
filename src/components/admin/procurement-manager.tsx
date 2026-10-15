'use client';

import { Fragment, useMemo, useState } from 'react';
import { AlertTriangle, Archive, Banknote, Building2, CalendarClock, ChevronDown, CircleDollarSign, ClipboardList, FileText, HandCoins, LoaderCircle, MessageCircle, Minus, PackageCheck, Pencil, Phone, Plus, Printer, RotateCcw, Search, ShoppingCart, Trash2, Truck, Undo2, Users, Wallet, X } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { VariantOption } from '@/lib/admin-catalog';
import type { PaymentView, PurchaseView, SupplierView } from '@/lib/procurement';
import { supplierLedger } from '@/lib/procurement-ledger';
import { api, Modal, useFlash } from './ui';
import { Card, Kpi, PageHero, iqd } from './dash-ui';

type Data = { purchases: PurchaseView[]; suppliers: SupplierView[]; payments: PaymentView[] };
type Tab = 'purchases' | 'suppliers' | 'payments';
type Line = { variantId: number; quantity: string; unitCost: string; salePrice: string };
type PayTarget = { supplierId: number; purchase?: PurchaseView };

const thumb = (url: string | null) => url ? (url.startsWith('/api/media/') ? `${url}?w=120` : url) : '/images/placeholder.svg';
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' }) : '—';
const todayInput = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
const addDays = (date: string, days: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const METHODS = { cash: ['Cash', 'نقد'], transfer: ['Bank transfer', 'حوالة'], zaincash: ['ZainCash', 'زين كاش'], other: ['Other', 'أخرى'] } as const;

/** Admin → Purchases & suppliers: buying stock, landed cost, what we owe each supplier and when. */
export function ProcurementManager({ initial, catalog, exchangeRate, canManage }: { initial: Data; catalog: VariantOption[]; exchangeRate: number; canManage: boolean }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, a: string) => ar ? a : en;
  const lang = ar ? 'ar' : 'en';
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>('purchases');
  const [filter, setFilter] = useState<'all' | 'ordered' | 'unpaid' | 'overdue' | 'cancelled'>('all');
  const [supplierFilter, setSupplierFilter] = useState<number | 'all'>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierView | 'new' | null>(null);
  const [paying, setPaying] = useState<PayTarget | null>(null);
  const [statement, setStatement] = useState<SupplierView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { flash, success, fail } = useFlash();

  const refresh = async () => setData(await api<Data>('/api/admin/purchases'));
  const supplierById = useMemo(() => new Map(data.suppliers.map(s => [s.id, s])), [data.suppliers]);

  const live = data.purchases.filter(p => p.status !== 'cancelled');
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const thisMonth = live.filter(p => p.status === 'received' && new Date(p.purchaseDate) >= monthStart);
  const owed = data.suppliers.reduce((s, x) => s + Math.max(0, x.balanceIqd), 0);
  const overdue = live.filter(p => p.overdue);
  const ordered = live.filter(p => p.status === 'ordered');
  const units = thisMonth.reduce((s, p) => s + p.units, 0);

  const visible = data.purchases.filter(p =>
    (filter === 'all' ? true : filter === 'ordered' ? p.status === 'ordered' : filter === 'unpaid' ? p.remainingIqd > 0 : filter === 'overdue' ? p.overdue : p.status === 'cancelled') &&
    (supplierFilter === 'all' || p.supplierId === supplierFilter) &&
    (!q || `${p.reference} ${p.supplierName ?? ''} ${p.supplierInvoice ?? ''} ${p.lines.map(l => `${l.productName} ${l.productNameAr}`).join(' ')}`.toLowerCase().includes(q.toLowerCase())));

  async function act(id: number, action: 'receive' | 'cancel') {
    if (action === 'cancel' && !confirm(tt('Cancel this purchase? If it was received, its units leave stock.', 'تلغي هالفاتورة؟ إذا مستلمة، بضاعتها تنشال من المخزون.'))) return;
    setBusy(`${action}-${id}`);
    try { await api(`/api/admin/purchases/${id}`, { method: 'POST', json: { action } }); await refresh(); success(action === 'receive' ? tt('Received. Stock updated.', 'انستلمت وانضافت للمخزون.') : tt('Purchase cancelled.', 'انلغت الفاتورة.')); }
    catch (e) { fail(e); } finally { setBusy(null); }
  }
  async function deletePayment(p: PaymentView) {
    if (!confirm(tt(`Delete payment of ${iqd(p.amountIqd)}?`, `تحذف دفعة ${iqd(p.amountIqd)}؟`))) return;
    try { await api(`/api/admin/supplier-payments/${p.id}`, { method: 'DELETE' }); await refresh(); success(tt('Payment deleted.', 'انحذفت الدفعة.')); } catch (e) { fail(e); }
  }
  async function toggleArchive(s: SupplierView) {
    try { await api(`/api/admin/suppliers/${s.id}`, { method: 'PATCH', json: { active: !s.active } }); await refresh(); success(s.active ? tt('Supplier archived.', 'انأرشف المورد.') : tt('Supplier restored.', 'رجع المورد.')); } catch (e) { fail(e); }
  }

  const statusBadge = (p: PurchaseView) => p.status === 'cancelled' ? <span className="admin-badge">{tt('Cancelled', 'ملغية')}</span>
    : p.status === 'ordered' ? <span className="admin-badge warning"><Truck size={12} /> {tt('On the way', 'بالطريق')}</span>
    : <span className="admin-badge success"><PackageCheck size={12} /> {tt('Received', 'مستلمة')}</span>;
  const payBadge = (p: PurchaseView) => p.status === 'cancelled' || p.supplierId == null ? null
    : p.remainingIqd <= 0 ? <span className="pr-pay paid">{tt('Paid', 'مسددة')}</span>
    : p.overdue ? <span className="pr-pay overdue">{tt('Overdue', 'متأخرة')}</span>
    : p.paidIqd > 0 ? <span className="pr-pay partial">{tt('Partly paid', 'مسددة جزئياً')}</span>
    : <span className="pr-pay due">{tt('Unpaid', 'غير مسددة')}</span>;

  const suppliersShown = data.suppliers.filter(s => showArchived || s.active);

  return <main className="admin-page dash procurement">
    {flash}
    <PageHero eyebrow={tt('Catalog', 'الكتالوج')} title={tt('Purchases & suppliers', 'المشتريات والموردون')}
      description={tt('Buy stock in dinars or dollars, spread shipping and customs over each unit, and track what you owe every supplier.', 'سجّل مشترياتك بالدينار أو الدولار، وزّع الشحن والكمرك على كل قطعة حتى تعرف تكلفتها الحقيقية، وتابع شكد عليك لكل مورد.')}
      actions={canManage && <><button type="button" className="admin-btn admin-btn-ghost" onClick={() => setEditingSupplier('new')}><Building2 size={15} /> {tt('New supplier', 'مورد جديد')}</button><button type="button" className="admin-btn admin-btn-primary" onClick={() => setCreating(true)}><Plus size={15} /> {tt('New purchase', 'فاتورة شراء')}</button></>} />

    <section className="dash-kpis" data-cols="5">
      <Kpi lang={lang} icon={<ShoppingCart size={17} />} tone="accent" label={tt('Bought this month', 'مشتريات هذا الشهر')} value={thisMonth.reduce((s, p) => s + p.totalIqd, 0)} format={iqd} note={tt(`${thisMonth.length} purchases · ${units} units`, `${thisMonth.length} فاتورة · ${units} قطعة`)} />
      <Kpi lang={lang} delay={50} icon={<Wallet size={17} />} tone="danger" label={tt('We owe suppliers', 'علينا للموردين')} value={owed} format={iqd} note={tt('unpaid balance', 'رصيد غير مسدد')} />
      <Kpi lang={lang} delay={100} icon={<AlertTriangle size={17} />} tone="gold" label={tt('Overdue', 'متأخر السداد')} value={overdue.reduce((s, p) => s + p.remainingIqd, 0)} format={iqd} note={tt(`${overdue.length} purchases past due`, `${overdue.length} فاتورة فات موعدها`)} />
      <Kpi lang={lang} delay={150} icon={<Truck size={17} />} tone="blue" label={tt('On the way', 'بضاعة بالطريق')} value={ordered.reduce((s, p) => s + p.totalIqd, 0)} format={iqd} note={tt(`${ordered.length} orders · ${ordered.reduce((s, p) => s + p.units, 0)} units`, `${ordered.length} طلب · ${ordered.reduce((s, p) => s + p.units, 0)} قطعة`)} />
      <Kpi lang={lang} delay={200} icon={<Users size={17} />} tone="violet" label={tt('Active suppliers', 'موردون فعالون')} value={data.suppliers.filter(s => s.active).length} />
    </section>

    <div className="pr-tabs" role="tablist">
      {([['purchases', tt('Purchases', 'فواتير الشراء'), ClipboardList, data.purchases.length], ['suppliers', tt('Suppliers', 'الموردون'), Building2, data.suppliers.filter(s => s.active).length], ['payments', tt('Payments', 'الدفعات'), HandCoins, data.payments.length]] as const).map(([key, label, Icon, count]) =>
        <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}><Icon size={15} /> {label} <em>{count}</em></button>)}
    </div>

    {tab === 'purchases' && <Card title={tt('Purchases', 'فواتير الشراء')} icon={<FileText size={16} />} action={<div className="admin-segmented">{(['all', 'ordered', 'unpaid', 'overdue', 'cancelled'] as const).map(f => <button key={f} type="button" className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{{ all: tt('All', 'الكل'), ordered: tt('On the way', 'بالطريق'), unpaid: tt('Unpaid', 'غير مسددة'), overdue: tt('Overdue', 'متأخرة'), cancelled: tt('Cancelled', 'ملغية') }[f]}</button>)}</div>}>
      <div className="pr-toolbar">
        <label className="admin-search"><Search size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder={tt('Search number, supplier or product…', 'ابحث برقم الفاتورة أو المورد أو المنتج…')} /></label>
        <select className="pr-select" value={supplierFilter} onChange={e => setSupplierFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}><option value="all">{tt('All suppliers', 'كل الموردين')}</option>{data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </div>
      {!visible.length ? <div className="pr-empty"><ShoppingCart size={28} /><p>{data.purchases.length ? tt('No purchases match.', 'ماكو فواتير مطابقة.') : tt('No purchases yet. Record your first one to add stock with its real cost.', 'ماكو فواتير شراء بعد. سجّل أول فاتورة حتى تنضاف البضاعة للمخزون بتكلفتها الحقيقية.')}</p>{canManage && !data.purchases.length && <button type="button" className="admin-btn admin-btn-primary" onClick={() => setCreating(true)}><Plus size={14} /> {tt('New purchase', 'فاتورة شراء')}</button>}</div> :
        <div className="admin-table-wrap"><table className="admin-table pr-table"><thead><tr><th /><th>{tt('Purchase', 'الفاتورة')}</th><th>{tt('Supplier', 'المورد')}</th><th>{tt('Status', 'الحالة')}</th><th className="num">{tt('Total', 'الإجمالي')}</th><th className="num">{tt('Remaining', 'المتبقي')}</th><th>{tt('Actions', 'إجراءات')}</th></tr></thead><tbody>
          {visible.map(p => <Fragment key={p.id}>
            <tr className={`${p.status === 'cancelled' ? 'is-muted' : ''} ${open === p.id ? 'is-open' : ''}`}>
              <td><button type="button" className="pr-expand" aria-expanded={open === p.id} aria-label={tt('Details', 'التفاصيل')} onClick={() => setOpen(open === p.id ? null : p.id)}><ChevronDown size={15} /></button></td>
              <td><b className="pr-ref" dir="ltr">{p.reference}</b><small>{day(p.purchaseDate)} · {p.units} {tt('units', 'قطعة')}{p.supplierInvoice ? ` · ${tt('inv.', 'فاتورة')} ${p.supplierInvoice}` : ''}</small></td>
              <td>{p.supplierName ?? <span className="admin-muted">—</span>}{p.dueDate && p.remainingIqd > 0 && <small className={p.overdue ? 'pr-late' : ''}><CalendarClock size={11} /> {tt('due', 'الاستحقاق')} {day(p.dueDate)}</small>}</td>
              <td><div className="pr-badges">{statusBadge(p)}{payBadge(p)}</div></td>
              <td className="num"><b>{iqd(p.totalIqd)}</b>{p.currency === 'USD' && <small dir="ltr">USD @ {p.exchangeRate}</small>}</td>
              <td className="num">{p.status === 'cancelled' || p.supplierId == null ? '—' : <b className={p.remainingIqd > 0 ? 'pr-owed' : 'pr-clear'}>{iqd(p.remainingIqd)}</b>}</td>
              <td><div className="admin-order-actions">
                {canManage && p.status === 'ordered' && <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" disabled={busy === `receive-${p.id}`} onClick={() => void act(p.id, 'receive')}>{busy === `receive-${p.id}` ? <LoaderCircle size={13} className="spin" /> : <PackageCheck size={13} />} {tt('Receive', 'استلام')}</button>}
                {canManage && p.remainingIqd > 0 && p.supplierId != null && <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setPaying({ supplierId: p.supplierId!, purchase: p })}><HandCoins size={13} /> {tt('Pay', 'تسديد')}</button>}
                <a className="admin-btn admin-btn-ghost admin-btn-sm" href={`/admin/print/purchase/${p.id}`} target="_blank" rel="noreferrer" aria-label={tt('Print', 'طباعة')}><Printer size={13} /></a>
                {canManage && p.status !== 'cancelled' && <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm pr-danger" disabled={busy === `cancel-${p.id}`} onClick={() => void act(p.id, 'cancel')} aria-label={tt('Cancel purchase', 'إلغاء الفاتورة')}>{busy === `cancel-${p.id}` ? <LoaderCircle size={13} className="spin" /> : <Undo2 size={13} />}</button>}
              </div></td>
            </tr>
            {open === p.id && <tr className="pr-detail-row"><td colSpan={7}><PurchaseDetail p={p} payments={data.payments.filter(x => x.purchaseId === p.id)} /></td></tr>}
          </Fragment>)}
        </tbody></table></div>}
    </Card>}

    {tab === 'suppliers' && <Card title={tt('Suppliers', 'الموردون')} icon={<Building2 size={16} />} action={<label className="pr-check"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> {tt('Show archived', 'إظهار المؤرشفين')}</label>}>
      {!suppliersShown.length ? <div className="pr-empty"><Building2 size={28} /><p>{tt('No suppliers yet.', 'ماكو موردين بعد.')}</p>{canManage && <button type="button" className="admin-btn admin-btn-primary" onClick={() => setEditingSupplier('new')}><Plus size={14} /> {tt('New supplier', 'مورد جديد')}</button>}</div> :
        <div className="pr-suppliers">{suppliersShown.map(s => { const wa = s.phone ? s.phone.replace(/\D/g, '').replace(/^0/, '964') : ''; return <article key={s.id} className={`pr-supplier ${s.active ? '' : 'is-archived'}`}>
          <header><div className="pr-avatar">{s.name.trim().charAt(0)}</div><div><h3>{s.name}</h3><small>{[s.contactPerson, s.city || s.country].filter(Boolean).join(' · ') || tt('No details', 'بدون تفاصيل')}</small></div>{!s.active && <span className="admin-badge">{tt('Archived', 'مؤرشف')}</span>}</header>
          <div className={`pr-balance ${s.balanceIqd > 0 ? 'owe' : s.balanceIqd < 0 ? 'credit' : ''}`}><span>{s.balanceIqd > 0 ? tt('We owe', 'علينا') : s.balanceIqd < 0 ? tt('Credit with supplier', 'رصيد لنا عنده') : tt('Settled', 'مسدد')}</span><b>{iqd(Math.abs(s.balanceIqd))}</b>{s.overdueIqd > 0 && <em><AlertTriangle size={12} /> {tt('overdue', 'متأخر')} {iqd(s.overdueIqd)}</em>}</div>
          <dl><div><dt>{tt('Purchased', 'المشتريات')}</dt><dd>{iqd(s.purchasedIqd)}</dd></div><div><dt>{tt('Paid', 'المدفوع')}</dt><dd>{iqd(s.paidIqd)}</dd></div><div><dt>{tt('Purchases', 'الفواتير')}</dt><dd>{s.purchases}{s.openOrders > 0 && <small> · {s.openOrders} {tt('on the way', 'بالطريق')}</small>}</dd></div><div><dt>{tt('Last purchase', 'آخر شراء')}</dt><dd>{day(s.lastPurchase)}</dd></div></dl>
          {s.phone && <div className="pr-contact"><a href={`tel:${s.phone}`} dir="ltr"><Phone size={13} /> {s.phone}</a>{wa.length >= 12 && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={13} /> {tt('WhatsApp', 'واتساب')}</a>}</div>}
          <footer>
            <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setStatement(s)}><FileText size={13} /> {tt('Statement', 'كشف حساب')}</button>
            {canManage && s.active && <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setPaying({ supplierId: s.id })}><HandCoins size={13} /> {tt('Pay', 'تسديد')}</button>}
            {canManage && <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setEditingSupplier(s)} aria-label={tt('Edit', 'تعديل')}><Pencil size={13} /></button>}
            {canManage && <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => void toggleArchive(s)} aria-label={s.active ? tt('Archive', 'أرشفة') : tt('Restore', 'استرجاع')}>{s.active ? <Archive size={13} /> : <RotateCcw size={13} />}</button>}
          </footer>
        </article>; })}</div>}
    </Card>}

    {tab === 'payments' && <Card title={tt('Payments to suppliers', 'الدفعات للموردين')} icon={<HandCoins size={16} />} action={canManage && data.suppliers.some(s => s.active) ? <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => setPaying({ supplierId: data.suppliers.find(s => s.active)!.id })}><Plus size={13} /> {tt('Record payment', 'تسجيل دفعة')}</button> : undefined}>
      {!data.payments.length ? <div className="pr-empty"><HandCoins size={28} /><p>{tt('No payments recorded yet.', 'ماكو دفعات مسجلة بعد.')}</p></div> :
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{tt('Date', 'التاريخ')}</th><th>{tt('Supplier', 'المورد')}</th><th>{tt('For', 'عن')}</th><th>{tt('Method', 'الطريقة')}</th><th className="num">{tt('Amount', 'المبلغ')}</th><th /></tr></thead><tbody>
          {data.payments.map(p => <tr key={p.id}><td>{day(p.paidAt)}{p.createdBy && <small>{p.createdBy}</small>}</td><td><b>{p.supplierName}</b></td><td>{p.purchaseRef ? <span dir="ltr">{p.purchaseRef}</span> : tt('Account', 'على الحساب')}{p.note && <small>{p.note}</small>}</td><td>{ar ? METHODS[p.method as keyof typeof METHODS]?.[1] ?? p.method : METHODS[p.method as keyof typeof METHODS]?.[0] ?? p.method}</td><td className="num"><b>{iqd(p.amountIqd)}</b></td><td>{canManage && <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm pr-danger" onClick={() => void deletePayment(p)} aria-label={tt('Delete', 'حذف')}><Trash2 size={13} /></button>}</td></tr>)}
        </tbody></table></div>}
    </Card>}

    {creating && <PurchaseEditor catalog={catalog} suppliers={data.suppliers.filter(s => s.active)} exchangeRate={exchangeRate} onClose={() => setCreating(false)} onNewSupplier={() => setEditingSupplier('new')} onSaved={async (ref, received) => { setCreating(false); await refresh(); setTab('purchases'); success(received ? tt(`${ref} saved. Stock updated.`, `انحفظت ${ref} وانضافت البضاعة للمخزون.`) : tt(`${ref} saved as on the way.`, `انحفظت ${ref} كبضاعة بالطريق.`)); }} onError={fail} />}
    {editingSupplier && <SupplierEditor supplier={editingSupplier === 'new' ? null : editingSupplier} onClose={() => setEditingSupplier(null)} onSaved={async () => { setEditingSupplier(null); await refresh(); success(tt('Supplier saved.', 'انحفظ المورد.')); }} onError={fail} />}
    {paying && <PaymentEditor target={paying} suppliers={data.suppliers.filter(s => s.active || s.id === paying.supplierId)} purchases={data.purchases} onClose={() => setPaying(null)} onSaved={async () => { setPaying(null); await refresh(); success(tt('Payment recorded.', 'انسجلت الدفعة.')); }} onError={fail} />}
    {statement && <StatementModal supplier={supplierById.get(statement.id) ?? statement} purchases={data.purchases.filter(p => p.supplierId === statement.id)} payments={data.payments.filter(p => p.supplierId === statement.id)} onClose={() => setStatement(null)} />}
  </main>;
}

function PurchaseDetail({ p, payments }: { p: PurchaseView; payments: PaymentView[] }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, a: string) => ar ? a : en;
  const unitLabel = (l: PurchaseView['lines'][number]) => p.currency === 'USD' ? `$${(l.unitCost / 100).toFixed(2)}` : iqd(l.unitCost);
  return <div className="pr-detail">
    <table className="pr-lines"><thead><tr><th>{tt('Product', 'المنتج')}</th><th className="num">{tt('Qty', 'العدد')}</th><th className="num">{tt('Unit price', 'سعر الوحدة')}</th><th className="num">{tt('Landed cost', 'التكلفة الفعلية')}</th><th className="num">{tt('Sale price', 'سعر البيع')}</th><th className="num">{tt('Margin', 'هامش الربح')}</th><th className="num">{tt('Sold', 'انباع')}</th></tr></thead><tbody>
      {p.lines.map(l => { const margin = l.salePriceIqd ? (l.salePriceIqd - l.landedCostIqd) / l.salePriceIqd : null; return <tr key={l.id}>
        <td><div className="pr-prod"><img src={thumb(l.image)} alt="" /><span><b>{ar ? l.productNameAr : l.productName}</b><small><i style={{ background: l.hex }} />{ar ? l.colorAr : l.color}</small></span></div></td>
        <td className="num">{l.quantity}</td><td className="num">{unitLabel(l)}</td><td className="num"><b>{iqd(l.landedCostIqd)}</b></td>
        <td className="num">{l.salePriceIqd ? iqd(l.salePriceIqd) : '—'}</td>
        <td className="num">{margin == null ? '—' : <span className={margin < 0.2 ? 'pr-low' : 'pr-good'}>{Math.round(margin * 100)}%</span>}</td>
        <td className="num">{p.status === 'received' ? `${l.sold}/${l.quantity}` : '—'}</td>
      </tr>; })}
    </tbody></table>
    <div className="pr-detail-side">
      <div className="pr-sum"><div><span>{tt('Goods', 'قيمة البضاعة')}</span><b>{iqd(p.subtotalIqd)}</b></div>{p.extraCostsIqd > 0 && <div><span>{tt('Shipping & customs', 'شحن وكمرك')}</span><b>+ {iqd(p.extraCostsIqd)}</b></div>}{p.discountIqd > 0 && <div><span>{tt('Discount', 'خصم')}</span><b>− {iqd(p.discountIqd)}</b></div>}<div className="total"><span>{tt('Total', 'الإجمالي')}</span><b>{iqd(p.totalIqd)}</b></div>{p.supplierId != null && p.status !== 'cancelled' && <><div><span>{tt('Paid', 'المدفوع')}</span><b>{iqd(p.paidIqd)}</b></div><div className={p.remainingIqd > 0 ? 'owe' : ''}><span>{tt('Remaining', 'المتبقي')}</span><b>{iqd(p.remainingIqd)}</b></div></>}</div>
      {payments.length > 0 && <ul className="ws-payments">{payments.map(x => <li key={x.id}><span>{day(x.paidAt)}{x.note ? ` · ${x.note}` : ''}</span><b>{iqd(x.amountIqd)}</b></li>)}</ul>}
      {p.notes && <p className="pr-note">{p.notes}</p>}
      <small className="admin-muted">{p.createdBy ? `${tt('By', 'بواسطة')} ${p.createdBy}` : ''}{p.receivedAt ? ` · ${tt('received', 'استلام')} ${day(p.receivedAt)}` : ''}</small>
    </div>
  </div>;
}

function PurchaseEditor({ catalog, suppliers, exchangeRate, onClose, onSaved, onError, onNewSupplier }: { catalog: VariantOption[]; suppliers: SupplierView[]; exchangeRate: number; onClose: () => void; onSaved: (reference: string, received: boolean) => void; onError: (e: unknown) => void; onNewSupplier: () => void }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, a: string) => ar ? a : en;
  const [supplierId, setSupplierId] = useState<string>(suppliers.length === 1 ? String(suppliers[0].id) : '');
  const [currency, setCurrency] = useState<'IQD' | 'USD'>('IQD');
  const [rate, setRate] = useState(String(exchangeRate));
  const [status, setStatus] = useState<'received' | 'ordered'>('received');
  const [date, setDate] = useState(todayInput());
  const [invoice, setInvoice] = useState('');
  const [extra, setExtra] = useState(''), [discount, setDiscount] = useState('');
  const [paid, setPaid] = useState(''), [method, setMethod] = useState<keyof typeof METHODS>('cash');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const byId = useMemo(() => new Map(catalog.map(v => [v.variantId, v])), [catalog]);
  const supplier = suppliers.find(s => String(s.id) === supplierId);
  const results = catalog.filter(v => !q || `${v.productName} ${v.productNameAr} ${v.color} ${v.colorAr}`.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  const r = currency === 'USD' ? Number(rate) || 0 : 1;
  const toIqd = (v: string) => currency === 'USD' ? (Number(v) || 0) * r : Number(v) || 0;
  const subtotal = lines.reduce((s, l) => s + toIqd(l.unitCost) * (Number(l.quantity) || 0), 0);
  const adjust = (Number(extra) || 0) - (Number(discount) || 0);
  const total = Math.max(0, Math.round(subtotal + adjust));
  const landed = (l: Line) => { const value = toIqd(l.unitCost) * (Number(l.quantity) || 0); const share = subtotal > 0 ? value / subtotal : 0; const qty = Number(l.quantity) || 0; return qty > 0 ? Math.max(0, Math.round((value + adjust * share) / qty)) : 0; };
  const add = (v: VariantOption) => setLines(ls => ls.some(l => l.variantId === v.variantId) ? ls.map(l => l.variantId === v.variantId ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) } : l) : [...ls, { variantId: v.variantId, quantity: '1', unitCost: '', salePrice: '' }]);
  const set = (id: number, patch: Partial<Line>) => setLines(ls => ls.map(l => l.variantId === id ? { ...l, ...patch } : l));
  const remove = (id: number) => setLines(ls => ls.filter(l => l.variantId !== id));
  const pickSupplier = (id: string) => { setSupplierId(id); const s = suppliers.find(x => String(x.id) === id); if (s?.paymentTermsDays) setDueDate(addDays(date, s.paymentTermsDays)); };
  const valid = lines.length > 0 && lines.every(l => Number(l.quantity) > 0 && Number(l.unitCost) >= 0 && l.unitCost !== '') && (currency === 'IQD' || r >= 100) && (Number(paid) || 0) <= total && (!(Number(paid) > 0) || !!supplierId);
  async function submit() {
    setBusy(true);
    try {
      const res = await api<{ reference: string }>('/api/admin/purchases', { method: 'POST', json: {
        supplierId: supplierId || null, currency, exchangeRate: currency === 'USD' ? Math.round(r) : undefined, status, purchaseDate: date, supplierInvoice: invoice, notes,
        extraCostsIqd: Math.round(Number(extra) || 0), discountIqd: Math.round(Number(discount) || 0), paidNow: Math.round(Number(paid) || 0), paymentMethod: method, dueDate: dueDate || null,
        items: lines.map(l => ({ variantId: l.variantId, quantity: Math.round(Number(l.quantity)), unitCost: currency === 'USD' ? Math.round((Number(l.unitCost) || 0) * 100) : Math.round(Number(l.unitCost) || 0), salePriceIqd: l.salePrice === '' ? null : Math.round(Number(l.salePrice)) })),
      } });
      onSaved(res.reference, status === 'received');
    } catch (e) { onError(e); } finally { setBusy(false); }
  }
  return <Modal title={tt('New purchase', 'فاتورة شراء جديدة')} onClose={onClose} wide>
    <div className="pr-editor">
      <section>
        <h3 className="pce-title">{tt('1. Supplier & invoice', '1. المورد والفاتورة')}</h3>
        <div className="pce-pair">
          <label className="admin-field"><span>{tt('Supplier', 'المورد')}</span><div className="pr-inline"><select value={supplierId} onChange={e => pickSupplier(e.target.value)}><option value="">{tt('— No supplier —', '— بدون مورد —')}</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={onNewSupplier} aria-label={tt('New supplier', 'مورد جديد')}><Plus size={13} /></button></div>{supplier && supplier.balanceIqd !== 0 && <small>{supplier.balanceIqd > 0 ? tt('Current balance we owe', 'رصيدنا الحالي عليه') : tt('Our credit', 'رصيد لنا')}: {iqd(Math.abs(supplier.balanceIqd))}</small>}</label>
          <label className="admin-field"><span>{tt('Supplier invoice no. (optional)', 'رقم فاتورة المورد (اختياري)')}</span><input value={invoice} onChange={e => setInvoice(e.target.value)} dir="auto" /></label>
          <label className="admin-field"><span>{tt('Date', 'التاريخ')}</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          <div className="admin-field"><span>{tt('Goods', 'البضاعة')}</span><div className="ws-pay-type">{(['received', 'ordered'] as const).map(s => <button key={s} type="button" className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s === 'received' ? <><PackageCheck size={15} /> {tt('Received now', 'مستلمة هسه')}</> : <><Truck size={15} /> {tt('Ordered, on the way', 'مطلوبة، بالطريق')}</>}</button>)}</div></div>
        </div>
        <div className="pce-pair">
          <div className="admin-field"><span>{tt('Currency', 'العملة')}</span><div className="ws-pay-type">{(['IQD', 'USD'] as const).map(c => <button key={c} type="button" className={currency === c ? 'on' : ''} onClick={() => setCurrency(c)}>{c === 'IQD' ? tt('Iraqi dinar', 'دينار عراقي') : tt('US dollar', 'دولار')}</button>)}</div></div>
          {currency === 'USD' && <label className="admin-field"><span>{tt('Rate (IQD per $1)', 'سعر الصرف (دينار لكل دولار)')}</span><input type="number" min="100" value={rate} onChange={e => setRate(e.target.value)} /></label>}
        </div>
        <h3 className="pce-title">{tt('2. Products', '2. المنتجات')}</h3>
        <label className="admin-search"><Search size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder={tt('Search products…', 'ابحث عن منتج…')} /></label>
        <div className="bundle-pick">{results.map(v => <button type="button" key={v.variantId} onClick={() => add(v)} className={lines.some(l => l.variantId === v.variantId) ? 'on' : ''}>
          <img src={thumb(v.image)} alt="" /><span><b>{ar ? v.productNameAr || v.productName : v.productName}</b><small><i style={{ background: v.hex }} /> {ar ? v.colorAr || v.color : v.color} · {tt(`${v.available} in stock`, `بالمخزون ${v.available}`)}</small></span><Plus size={14} />
        </button>)}</div>
      </section>
      <section>
        <h3 className="pce-title">{tt('3. Lines', '3. أسطر الفاتورة')}</h3>
        {!lines.length ? <p className="admin-hint">{tt('Pick products from the list.', 'اختار منتجات من القائمة.')}</p> : <div className="ws-lines">{lines.map(l => { const v = byId.get(l.variantId)!; const unit = landed(l); const sale = Number(l.salePrice) || v.salePriceIqd; const margin = sale > 0 && unit > 0 ? (sale - unit) / sale : null; return <div key={l.variantId} className="ws-line">
          <img src={thumb(v.image)} alt="" />
          <div className="ws-line-main"><b>{ar ? v.productNameAr || v.productName : v.productName}</b><small>{ar ? v.colorAr || v.color : v.color}</small>
            <div className="ws-line-fields pr-line-fields">
              <label><span>{currency === 'USD' ? tt('Cost / unit ($)', 'سعر الوحدة ($)') : tt('Cost / unit', 'سعر الوحدة')}</span><input type="number" min="0" step={currency === 'USD' ? '0.01' : '250'} value={l.unitCost} onChange={e => set(l.variantId, { unitCost: e.target.value })} /></label>
              <label><span>{tt('New sale price (optional)', 'سعر بيع جديد (اختياري)')}</span><input type="number" min="0" step="250" value={l.salePrice} placeholder={v.salePriceIqd ? String(v.salePriceIqd) : ''} onChange={e => set(l.variantId, { salePrice: e.target.value })} /></label>
              <div className="bundle-qty"><button type="button" onClick={() => set(l.variantId, { quantity: String(Math.max(1, (Number(l.quantity) || 1) - 1)) })}><Minus size={12} /></button><input type="number" min="1" value={l.quantity} onChange={e => set(l.variantId, { quantity: e.target.value })} /><button type="button" onClick={() => set(l.variantId, { quantity: String((Number(l.quantity) || 0) + 1) })}><Plus size={12} /></button></div>
            </div>
            {unit > 0 && <small className="ws-profit">{tt('Landed', 'التكلفة الفعلية')}: <b>{iqd(unit)}</b>{margin != null && <> · {tt('margin', 'هامش')} <b className={margin < 0.2 ? 'pr-low' : 'pr-good'}>{Math.round(margin * 100)}%</b></>} · {tt('line', 'السطر')} {iqd(toIqd(l.unitCost) * (Number(l.quantity) || 0))}</small>}
          </div>
          <button type="button" className="ws-remove" aria-label={tt('Remove', 'حذف')} onClick={() => remove(l.variantId)}><Trash2 size={14} /></button>
        </div>; })}</div>}
        <div className="bundle-sum">
          <div><span>{tt('Goods', 'قيمة البضاعة')}</span><b>{iqd(subtotal)}</b></div>
          <div className="pce-pair">
            <label className="admin-field"><span>{tt('Shipping & customs (IQD)', 'شحن وكمرك (دينار)')}</span><input type="number" min="0" step="250" value={extra} onChange={e => setExtra(e.target.value)} placeholder="0" /></label>
            <label className="admin-field"><span>{tt('Supplier discount (IQD)', 'خصم المورد (دينار)')}</span><input type="number" min="0" step="250" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" /></label>
          </div>
          <div className="good"><span>{tt('Purchase total', 'إجمالي الفاتورة')}</span><b>{iqd(total)}</b></div>
          {adjust !== 0 && subtotal > 0 && <small className="admin-hint">{tt('Shipping, customs and discount are spread over each unit by value.', 'الشحن والكمرك والخصم يتوزعون على كل قطعة حسب قيمتها.')}</small>}
          <div className="pce-pair">
            <label className="admin-field"><span>{tt('Paid now (IQD)', 'المدفوع هسه (دينار)')}</span><input type="number" min="0" step="250" value={paid} onChange={e => setPaid(e.target.value)} placeholder="0" disabled={!supplierId} /><small>{!supplierId ? tt('Choose a supplier to record payment.', 'اختار مورد حتى تسجل الدفع.') : `${tt('Remaining', 'المتبقي')}: ${iqd(Math.max(0, total - (Number(paid) || 0)))}`}</small></label>
            <label className="admin-field"><span>{tt('Paid by', 'طريقة الدفع')}</span><select value={method} onChange={e => setMethod(e.target.value as keyof typeof METHODS)}>{Object.entries(METHODS).map(([k, [en, a]]) => <option key={k} value={k}>{ar ? a : en}</option>)}</select></label>
          </div>
          <div className="pr-quickpay"><button type="button" onClick={() => setPaid(String(total))} disabled={!supplierId || !total}>{tt('Paid in full', 'مدفوعة كاملة')}</button><button type="button" onClick={() => setPaid('')} disabled={!supplierId}>{tt('On credit', 'آجل')}</button></div>
          {supplierId && (Number(paid) || 0) < total && <label className="admin-field"><span>{tt('Pay by (due date)', 'موعد السداد')}</span><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>}
        </div>
        <label className="admin-field"><span>{tt('Notes (optional)', 'ملاحظات (اختياري)')}</span><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></label>
      </section>
    </div>
    <div className="admin-modal-actions"><button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}><X size={14} /> {tt('Cancel', 'إلغاء')}</button><button type="button" className="admin-btn admin-btn-primary" disabled={!valid || busy} onClick={() => void submit()}>{busy ? <LoaderCircle size={14} className="spin" /> : status === 'received' ? <PackageCheck size={14} /> : <Truck size={14} />} {status === 'received' ? tt('Save & add to stock', 'حفظ وإضافة للمخزون') : tt('Save order', 'حفظ الطلب')}</button></div>
  </Modal>;
}

function SupplierEditor({ supplier, onClose, onSaved, onError }: { supplier: SupplierView | null; onClose: () => void; onSaved: () => void; onError: (e: unknown) => void }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, a: string) => ar ? a : en;
  const [f, setF] = useState({ name: supplier?.name ?? '', contactPerson: supplier?.contactPerson ?? '', phone: supplier?.phone ?? '', email: supplier?.email ?? '', country: supplier?.country ?? (ar ? 'العراق' : 'Iraq'), city: supplier?.city ?? '', address: supplier?.address ?? '', paymentTermsDays: String(supplier?.paymentTermsDays ?? 0), openingBalanceIqd: String(supplier?.openingBalanceIqd ?? 0), notes: supplier?.notes ?? '' });
  const [busy, setBusy] = useState(false);
  const field = (key: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => <label className="admin-field"><span>{label}</span><input value={f[key]} onChange={e => setF({ ...f, [key]: e.target.value })} {...props} /></label>;
  async function submit() {
    setBusy(true);
    try { await api(supplier ? `/api/admin/suppliers/${supplier.id}` : '/api/admin/suppliers', { method: supplier ? 'PATCH' : 'POST', json: { ...f, paymentTermsDays: Number(f.paymentTermsDays) || 0, openingBalanceIqd: Math.round(Number(f.openingBalanceIqd) || 0) } }); onSaved(); }
    catch (e) { onError(e); } finally { setBusy(false); }
  }
  return <Modal title={supplier ? tt(`Edit ${supplier.name}`, `تعديل ${supplier.name}`) : tt('New supplier', 'مورد جديد')} onClose={onClose}>
    <div className="pce-pair">
      {field('name', tt('Name', 'الاسم'), { autoFocus: true, required: true })}
      {field('contactPerson', tt('Contact person', 'الشخص المسؤول'))}
      {field('phone', tt('Phone', 'الهاتف'), { dir: 'ltr', inputMode: 'tel', placeholder: '07XXXXXXXXX' })}
      {field('email', tt('Email', 'البريد الإلكتروني'), { dir: 'ltr', type: 'email' })}
      {field('country', tt('Country', 'الدولة'))}
      {field('city', tt('City', 'المدينة'))}
    </div>
    {field('address', tt('Address', 'العنوان'))}
    <div className="pce-pair">
      <label className="admin-field"><span>{tt('Payment terms (days)', 'مهلة السداد (أيام)')}</span><input type="number" min="0" max="365" value={f.paymentTermsDays} onChange={e => setF({ ...f, paymentTermsDays: e.target.value })} /><small>{tt('Sets the due date on credit purchases. 0 = cash.', 'يحدد موعد السداد للفواتير الآجلة. 0 = نقد.')}</small></label>
      <label className="admin-field"><span>{tt('Opening balance we owe (IQD)', 'رصيد سابق علينا (دينار)')}</span><input type="number" step="250" value={f.openingBalanceIqd} onChange={e => setF({ ...f, openingBalanceIqd: e.target.value })} /><small>{tt('Debt from before this system. Negative = credit with them.', 'دين قديم قبل النظام. بالسالب = رصيد إلنا عنده.')}</small></label>
    </div>
    <label className="admin-field"><span>{tt('Notes', 'ملاحظات')}</span><textarea rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></label>
    <div className="admin-modal-actions"><button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>{tt('Cancel', 'إلغاء')}</button><button type="button" className="admin-btn admin-btn-primary" disabled={busy || f.name.trim().length < 2} onClick={() => void submit()}>{busy && <LoaderCircle size={14} className="spin" />} {tt('Save supplier', 'حفظ المورد')}</button></div>
  </Modal>;
}

function PaymentEditor({ target, suppliers, purchases, onClose, onSaved, onError }: { target: PayTarget; suppliers: SupplierView[]; purchases: PurchaseView[]; onClose: () => void; onSaved: () => void; onError: (e: unknown) => void }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, a: string) => ar ? a : en;
  const [supplierId, setSupplierId] = useState(String(target.supplierId));
  const [purchaseId, setPurchaseId] = useState(target.purchase ? String(target.purchase.id) : '');
  const supplier = suppliers.find(s => String(s.id) === supplierId);
  const open = purchases.filter(p => String(p.supplierId) === supplierId && p.remainingIqd > 0);
  const chosen = open.find(p => String(p.id) === purchaseId);
  const [amount, setAmount] = useState(String(target.purchase?.remainingIqd ?? Math.max(0, supplier?.balanceIqd ?? 0)));
  const [method, setMethod] = useState<keyof typeof METHODS>('cash');
  const [date, setDate] = useState(todayInput());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try { await api('/api/admin/supplier-payments', { method: 'POST', json: { supplierId: Number(supplierId), purchaseId: purchaseId || null, amountIqd: Math.round(Number(amount)), method, paidAt: date, note } }); onSaved(); }
    catch (e) { onError(e); } finally { setBusy(false); }
  }
  return <Modal title={tt('Pay supplier', 'تسديد للمورد')} onClose={onClose}>
    <label className="admin-field"><span>{tt('Supplier', 'المورد')}</span><select value={supplierId} onChange={e => { setSupplierId(e.target.value); setPurchaseId(''); const s = suppliers.find(x => String(x.id) === e.target.value); setAmount(String(Math.max(0, s?.balanceIqd ?? 0))); }}>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>{supplier && <small>{supplier.balanceIqd > 0 ? tt('We owe', 'علينا') : tt('Balance', 'الرصيد')}: <b>{iqd(supplier.balanceIqd)}</b></small>}</label>
    <label className="admin-field"><span>{tt('For', 'عن')}</span><select value={purchaseId} onChange={e => { setPurchaseId(e.target.value); const p = open.find(x => String(x.id) === e.target.value); if (p) setAmount(String(p.remainingIqd)); }}><option value="">{tt('The account (oldest purchases first)', 'على الحساب (الأقدم أولاً)')}</option>{open.map(p => <option key={p.id} value={p.id}>{p.reference} · {tt('remaining', 'متبقي')} {iqd(p.remainingIqd)}</option>)}</select></label>
    <div className="pce-pair">
      <label className="admin-field"><span>{tt('Amount (IQD)', 'المبلغ (دينار)')}</span><input type="number" min="1" step="250" value={amount} onChange={e => setAmount(e.target.value)} />{chosen && Number(amount) > chosen.remainingIqd && <small>{tt('More than this purchase; the rest goes to older ones.', 'أكثر من متبقي الفاتورة؛ الباقي يروح للفواتير الأقدم.')}</small>}</label>
      <label className="admin-field"><span>{tt('Paid by', 'طريقة الدفع')}</span><select value={method} onChange={e => setMethod(e.target.value as keyof typeof METHODS)}>{Object.entries(METHODS).map(([k, [en, a]]) => <option key={k} value={k}>{ar ? a : en}</option>)}</select></label>
      <label className="admin-field"><span>{tt('Date', 'التاريخ')}</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <label className="admin-field"><span>{tt('Note (optional)', 'ملاحظة (اختياري)')}</span><input value={note} onChange={e => setNote(e.target.value)} /></label>
    </div>
    <div className="admin-modal-actions"><button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>{tt('Cancel', 'إلغاء')}</button><button type="button" className="admin-btn admin-btn-primary" disabled={busy || !(Number(amount) > 0)} onClick={() => void submit()}>{busy ? <LoaderCircle size={14} className="spin" /> : <Banknote size={14} />} {tt('Record payment', 'تسجيل الدفعة')}</button></div>
  </Modal>;
}

function StatementModal({ supplier, purchases, payments, onClose }: { supplier: SupplierView; purchases: PurchaseView[]; payments: PaymentView[]; onClose: () => void }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, a: string) => ar ? a : en;
  const ledger = supplierLedger(supplier, purchases, payments);
  return <Modal title={tt(`Statement · ${supplier.name}`, `كشف حساب · ${supplier.name}`)} onClose={onClose} wide>
    <div className="pr-statement-head"><div><span>{tt('Purchased', 'المشتريات')}</span><b>{iqd(supplier.purchasedIqd)}</b></div><div><span>{tt('Paid', 'المدفوع')}</span><b>{iqd(supplier.paidIqd)}</b></div><div className={supplier.balanceIqd > 0 ? 'owe' : ''}><span>{tt('Balance', 'الرصيد')}</span><b>{iqd(supplier.balanceIqd)}</b></div><a className="admin-btn admin-btn-ghost admin-btn-sm" href={`/admin/print/supplier/${supplier.id}`} target="_blank" rel="noreferrer"><Printer size={13} /> {tt('Print', 'طباعة')}</a></div>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{tt('Date', 'التاريخ')}</th><th>{tt('Entry', 'البيان')}</th><th className="num">{tt('Purchase', 'شراء (عليه)')}</th><th className="num">{tt('Payment', 'دفعة (له)')}</th><th className="num">{tt('Balance', 'الرصيد')}</th></tr></thead><tbody>
      <tr className="is-muted"><td>—</td><td>{tt('Opening balance', 'رصيد سابق')}</td><td className="num" /><td className="num" /><td className="num"><b>{iqd(ledger.opening)}</b></td></tr>
      {ledger.rows.map((r, i) => <tr key={i}><td>{day(r.date)}</td><td>{r.kind === 'purchase' ? <>{tt('Purchase', 'فاتورة شراء')} <span dir="ltr">{r.ref}</span></> : <>{tt('Payment', 'دفعة')}{r.ref && <> · <span dir="ltr">{r.ref}</span></>}</>}</td><td className="num">{r.debit ? iqd(r.debit) : ''}</td><td className="num">{r.credit ? iqd(r.credit) : ''}</td><td className="num"><b className={r.balance > 0 ? 'pr-owed' : 'pr-clear'}>{iqd(r.balance)}</b></td></tr>)}
      {!ledger.rows.length && <tr><td colSpan={5}><p className="admin-empty">{tt('No movements yet.', 'ماكو حركات بعد.')}</p></td></tr>}
    </tbody></table></div>
    <p className="admin-hint"><CircleDollarSign size={13} /> {tt('Purchases on the way are not owed until they are received.', 'البضاعة اللي بالطريق ما تنحسب دين إلا بعد الاستلام.')}</p>
  </Modal>;
}
