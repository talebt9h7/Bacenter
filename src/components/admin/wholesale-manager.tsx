'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Banknote, CircleDollarSign, Clock, FileText, HandCoins, LoaderCircle, Minus, Plus, Printer, Search, Store, Trash2, Users, X } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { VariantOption } from '@/lib/admin-catalog';
import type { WholesaleInvoice } from '@/lib/wholesale-data';
import { normalizeIraqPhone } from '@/lib/iraq';
import { api, Modal, useFlash } from './ui';
import { Card, Kpi, PageHero, iqd } from './dash-ui';

type Line = { variantId: number; quantity: number; unitPrice: string; retailPrice: string };
const thumb = (url: string | null) => url ? (url.startsWith('/api/media/') ? `${url}?w=120` : url) : '/images/placeholder.svg';
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' });

/** Admin → Wholesale: invoices to traders (cash or credit), balances owed, and printable price invoices. */
export function WholesaleManager({ initial, catalog }: { initial: WholesaleInvoice[]; catalog: VariantOption[] }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, a: string) => ar ? a : en;
  const lang = ar ? 'ar' : 'en';
  const [rows, setRows] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<WholesaleInvoice | null>(null);
  const [filter, setFilter] = useState<'all' | 'owed' | 'cash' | 'credit'>('all');
  const [q, setQ] = useState('');
  const { flash, success, fail } = useFlash();
  const live = rows.filter(r => r.status !== 'cancelled' && r.status !== 'returned');
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const month = live.filter(r => new Date(r.createdAt) >= monthStart);
  const owed = live.reduce((s, r) => s + r.remaining, 0);
  const traders = new Set(live.map(r => r.phone)).size;
  const visible = rows.filter(r => (filter === 'all' || (filter === 'owed' ? r.remaining > 0 : r.payment === filter)) && (!q || `${r.reference} ${r.name} ${r.phone} ${r.shop}`.toLowerCase().includes(q.toLowerCase())));
  const byTrader = (() => {
    const m = new Map<string, { name: string; phone: string; total: number; owed: number; invoices: number }>();
    for (const r of live) { const t = m.get(r.phone) ?? { name: r.name, phone: r.phone, total: 0, owed: 0, invoices: 0 }; t.total += r.total; t.owed += r.remaining; t.invoices++; m.set(r.phone, t); }
    return [...m.values()].sort((a, b) => b.owed - a.owed || b.total - a.total);
  })();

  const refresh = () => location.reload();

  return <main className="admin-page dash">
    {flash}
    <PageHero eyebrow={tt('Sales', 'المبيعات')} title={tt('Wholesale', 'بيع الجملة')} description={tt('Sell to shops at wholesale prices, cash or on credit. Stock is deducted when the invoice is created, and each invoice prints as a price sheet with the trader’s name and number.', 'بيع للمحلات بسعر الجملة، نقد أو آجل. المخزون ينقص لما تسوي الفاتورة، وكل فاتورة تنطبع كوصل أسعار باسم التاجر ورقمه.')} actions={<button type="button" className="admin-btn admin-btn-primary" onClick={() => setCreating(true)}><Plus size={15} /> {tt('New wholesale invoice', 'فاتورة جملة جديدة')}</button>} />
    <section className="dash-kpis" data-cols="5">
      <Kpi lang={lang} icon={<CircleDollarSign size={17} />} tone="accent" label={tt('Wholesale this month', 'جملة هذا الشهر')} value={month.reduce((s, r) => s + r.total, 0)} format={iqd} note={tt(`${month.length} invoices`, `${month.length} فاتورة`)} />
      <Kpi lang={lang} delay={50} icon={<HandCoins size={17} />} tone="danger" label={tt('Owed by traders', 'ديون على التجار')} value={owed} format={iqd} note={tt('credit not yet collected', 'آجل لسه ما انقبض')} />
      <Kpi lang={lang} delay={100} icon={<Banknote size={17} />} tone="success" label={tt('Collected', 'المقبوض')} value={live.reduce((s, r) => s + r.paid, 0)} format={iqd} />
      <Kpi lang={lang} delay={150} icon={<Store size={17} />} tone="gold" label={tt('Profit from wholesale', 'ربح الجملة')} value={live.reduce((s, r) => s + r.profit, 0)} format={iqd} note={tt('after purchase cost', 'بعد تكلفة الشراء')} />
      <Kpi lang={lang} delay={200} icon={<Users size={17} />} tone="blue" label={tt('Traders', 'التجار')} value={traders} />
    </section>
    <div className="dash-grid main">
      <Card title={tt('Invoices', 'الفواتير')} icon={<FileText size={16} />} action={<div className="admin-segmented">{(['all', 'owed', 'cash', 'credit'] as const).map(f => <button key={f} type="button" className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f === 'all' ? tt('All', 'الكل') : f === 'owed' ? tt('Owing', 'عليها دين') : f === 'cash' ? tt('Cash', 'نقد') : tt('Credit', 'آجل')}</button>)}</div>}>
        <label className="admin-search" style={{ marginBottom: 12 }}><Search size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder={tt('Search invoice, trader or phone…', 'ابحث برقم الفاتورة أو اسم التاجر أو الرقم…')} /></label>
        {!visible.length ? <p className="admin-empty">{rows.length ? tt('No invoices match.', 'ماكو فواتير مطابقة.') : tt('No wholesale invoices yet.', 'ماكو فواتير جملة بعد.')}</p> :
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{tt('Invoice', 'الفاتورة')}</th><th>{tt('Trader', 'التاجر')}</th><th className="num">{tt('Total', 'الإجمالي')}</th><th className="num">{tt('Paid', 'المدفوع')}</th><th className="num">{tt('Remaining', 'المتبقي')}</th><th>{tt('Type', 'النوع')}</th><th /></tr></thead><tbody>
            {visible.map(r => <tr key={r.id} className={r.status === 'cancelled' ? 'is-muted' : ''}><td><Link className="admin-strong-link" href={`/admin/orders/${r.id}`}>{r.reference}</Link><br /><small>{day(r.createdAt)} · {r.items.reduce((s, i) => s + i.quantity, 0)} {tt('pcs', 'قطعة')}</small></td><td>{r.name}<br /><small dir="ltr">{r.phone}</small>{r.shop && <small> · {r.shop}</small>}</td><td className="num"><b>{iqd(r.total)}</b></td><td className="num">{iqd(r.paid)}</td><td className="num">{r.remaining > 0 ? <b className="ws-owed">{iqd(r.remaining)}</b> : <span className="admin-badge success">{tt('Paid', 'مسدد')}</span>}</td><td><span className={`admin-badge ${r.payment === 'credit' ? 'warning' : 'info'}`}>{r.payment === 'credit' ? tt('Credit', 'آجل') : tt('Cash', 'نقد')}</span></td>
              <td><div className="admin-order-actions"><a className="admin-btn admin-btn-ghost admin-btn-sm" href={`/admin/print/wholesale/${r.id}`} target="_blank" rel="noreferrer"><Printer size={13} /> {tt('Invoice', 'الوصل')}</a>{r.remaining > 0 && <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => setPaying(r)}><HandCoins size={13} /> {tt('Receive payment', 'قبض دفعة')}</button>}</div></td></tr>)}
          </tbody></table></div>}
      </Card>
      <Card title={tt('Traders & balances', 'التجار والأرصدة')} icon={<Users size={16} />}>
        {!byTrader.length ? <p className="admin-empty">{tt('Traders appear here after their first invoice.', 'التجار يظهرون هنا بعد أول فاتورة.')}</p> : <ul className="ws-traders">{byTrader.map(t => <li key={t.phone}><div><b>{t.name}</b><small dir="ltr">{t.phone} · {t.invoices} {tt('invoices', 'فاتورة')}</small></div><div className="ws-trader-nums"><span>{iqd(t.total)}</span>{t.owed > 0 ? <b className="ws-owed">{tt('owes', 'عليه')} {iqd(t.owed)}</b> : <small className="ws-clear">{tt('no balance', 'ما عليه شي')}</small>}</div></li>)}</ul>}
      </Card>
    </div>
    {creating && <InvoiceEditor catalog={catalog} onClose={() => setCreating(false)} onCreated={id => { setCreating(false); success(tt('Invoice created. Stock updated.', 'انسوت الفاتورة وانقص المخزون.')); window.open(`/admin/print/wholesale/${id}`, '_blank'); void refresh(); }} onError={fail} />}
    {paying && <PaymentModal invoice={paying} onClose={() => setPaying(null)} onDone={(paid, remaining) => { setRows(rs => rs.map(r => r.id === paying.id ? { ...r, paid, remaining, paymentStatus: remaining <= 0 ? 'paid' : 'partial' } : r)); setPaying(null); success(tt('Payment recorded.', 'انسجلت الدفعة.')); }} onError={fail} />}
  </main>;
}

function InvoiceEditor({ catalog, onClose, onCreated, onError }: { catalog: VariantOption[]; onClose: () => void; onCreated: (id: number) => void; onError: (e: unknown) => void }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, a: string) => ar ? a : en;
  const [name, setName] = useState(''), [phone, setPhone] = useState(''), [shop, setShop] = useState(''), [city, setCity] = useState(''), [note, setNote] = useState('');
  const [payment, setPayment] = useState<'cash' | 'credit'>('cash');
  const [paid, setPaid] = useState(''), [discount, setDiscount] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const byId = useMemo(() => new Map(catalog.map(v => [v.variantId, v])), [catalog]);
  const results = catalog.filter(v => !q || `${v.productName} ${v.productNameAr} ${v.color} ${v.colorAr}`.toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  const add = (v: VariantOption) => setLines(ls => ls.some(l => l.variantId === v.variantId) ? ls.map(l => l.variantId === v.variantId ? { ...l, quantity: l.quantity + 1 } : l) : [...ls, { variantId: v.variantId, quantity: 1, unitPrice: String(v.wholesalePriceIqd || ''), retailPrice: String(v.salePriceIqd || '') }]);
  const set = (id: number, patch: Partial<Line>) => setLines(ls => ls.map(l => l.variantId === id ? { ...l, ...patch } : l).filter(l => l.quantity > 0));
  const subtotal = lines.reduce((s, l) => s + (Number(l.unitPrice) || 0) * l.quantity, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));
  const over = lines.some(l => l.quantity > (byId.get(l.variantId)?.available ?? 0));
  const valid = name.trim().length >= 2 && /^07\d{9}$/.test(normalizeIraqPhone(phone)) && lines.length > 0 && lines.every(l => Number(l.unitPrice) > 0) && !over;
  async function submit() {
    setBusy(true);
    try {
      const r = await api<{ id: number }>('/api/admin/wholesale', { method: 'POST', json: { name, phone, shop, city, note, payment, paid: payment === 'credit' ? Number(paid) || 0 : undefined, discount: Number(discount) || 0, items: lines.map(l => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: Math.round(Number(l.unitPrice)), retailPrice: Math.round(Number(l.retailPrice) || 0) })) } });
      onCreated(r.id);
    } catch (e) { onError(e); } finally { setBusy(false); }
  }
  return <Modal title={tt('New wholesale invoice', 'فاتورة جملة جديدة')} onClose={onClose} wide>
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
          <div className="ws-pay-type">{(['cash', 'credit'] as const).map(p => <button key={p} type="button" className={payment === p ? 'on' : ''} onClick={() => setPayment(p)}>{p === 'cash' ? <><Banknote size={15} /> {tt('Cash — paid now', 'نقد — مدفوع هسه')}</> : <><Clock size={15} /> {tt('Credit (آجل)', 'آجل')}</>}</button>)}</div>
          {payment === 'credit' && <label className="admin-field"><span>{tt('Paid now (optional)', 'المدفوع هسه (اختياري)')}</span><input type="number" min="0" step="250" max={total} value={paid} onChange={e => setPaid(e.target.value)} placeholder="0" /><small>{tt('Remaining', 'المتبقي')}: {iqd(Math.max(0, total - (Number(paid) || 0)))}</small></label>}
        </div>
        <label className="admin-field"><span>{tt('Note (optional)', 'ملاحظة (اختياري)')}</span><textarea rows={2} value={note} onChange={e => setNote(e.target.value)} /></label>
      </section>
    </div>
    <div className="admin-modal-actions"><button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}><X size={14} /> {tt('Cancel', 'إلغاء')}</button><button type="button" className="admin-btn admin-btn-primary" disabled={!valid || busy} onClick={() => void submit()}>{busy ? <LoaderCircle size={14} className="spin" /> : <Printer size={14} />} {tt('Create invoice & print', 'إنشاء الفاتورة وطباعتها')}</button></div>
  </Modal>;
}

function PaymentModal({ invoice, onClose, onDone, onError }: { invoice: WholesaleInvoice; onClose: () => void; onDone: (paid: number, remaining: number) => void; onError: (e: unknown) => void }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, a: string) => ar ? a : en;
  const [amount, setAmount] = useState(String(invoice.remaining));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try { const r = await api<{ paid: number; remaining: number }>(`/api/admin/wholesale/${invoice.id}/payments`, { method: 'POST', json: { amount: Number(amount), note } }); onDone(r.paid, r.remaining); }
    catch (e) { onError(e); } finally { setBusy(false); }
  }
  return <Modal title={tt(`Receive payment · ${invoice.reference}`, `قبض دفعة · ${invoice.reference}`)} onClose={onClose}>
    <p className="admin-hint">{invoice.name} · {tt('owes', 'عليه')} <b>{iqd(invoice.remaining)}</b> {tt(`of ${iqd(invoice.total)}`, `من ${iqd(invoice.total)}`)}</p>
    <label className="admin-field"><span>{tt('Amount received (IQD)', 'المبلغ المستلم (دينار)')}</span><input type="number" min="1" max={invoice.remaining} step="250" value={amount} onChange={e => setAmount(e.target.value)} /></label>
    <label className="admin-field"><span>{tt('Note (optional)', 'ملاحظة (اختياري)')}</span><input value={note} onChange={e => setNote(e.target.value)} /></label>
    {invoice.payments.length > 0 && <ul className="ws-payments">{invoice.payments.map(p => <li key={p.id}><span>{day(p.createdAt)}{p.note ? ` · ${p.note}` : ''}</span><b>{iqd(p.amount)}</b></li>)}</ul>}
    <div className="admin-modal-actions"><button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>{tt('Cancel', 'إلغاء')}</button><button type="button" className="admin-btn admin-btn-primary" disabled={busy || !(Number(amount) > 0)} onClick={() => void submit()}>{busy ? <LoaderCircle size={14} className="spin" /> : <HandCoins size={14} />} {tt('Record payment', 'تسجيل الدفعة')}</button></div>
  </Modal>;
}
