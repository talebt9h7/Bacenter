'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, Check, ChevronDown, ImagePlus, LayoutTemplate, LoaderCircle, Printer, RotateCcw, Save, Settings2, X } from 'lucide-react';
import type { WholesaleInvoice } from '@/lib/wholesale-data';
import { defaultWholesaleReceipt, receiptLabelDefaults, type ReceiptLabel, type WholesaleReceiptSettings } from '@/lib/wholesale-receipt';
import { api } from './ui';
import './wholesale-receipt.css';

const n = (v: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
const image = (url: string) => url.startsWith('/api/media/') ? `${url}?w=240` : url;

export function ReceiptSheet({ invoice, settings: s }: { invoice: WholesaleInvoice; settings: WholesaleReceiptSettings }) {
  const l = s.labels, thermal = s.paper === 'thermal';
  const cancelled = invoice.status === 'cancelled' || invoice.status === 'returned';
  const units = invoice.items.reduce((sum, i) => sum + i.quantity, 0);
  const metadata = [[l.reference, invoice.reference], [l.date, new Date(invoice.createdAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' })], [l.trader, invoice.name], ...(s.showTraderPhone ? [[l.phone, invoice.phone]] : []), ...(s.showShop && invoice.shop ? [[l.shop, invoice.shop]] : []), ...(s.showCity && invoice.city ? [[l.city, invoice.city]] : []), [l.payment, invoice.payment === 'cash' ? l.cash : l.credit]];
  return <article className={`wr-sheet ${thermal ? 'wr-thermal' : 'wr-a4'} ${s.density === 'compact' ? 'wr-compact' : ''}`} style={{ '--wr-accent': s.accent } as CSSProperties} dir="rtl" lang="ar" aria-label="معاينة الوصل">
    <header className="wr-sheet-head"><div className="wr-brand">{s.showLogo && s.logoUrl && <img className="wr-logo" src={image(s.logoUrl)} alt={s.brand} />}<div>{s.englishName && <p className="wr-english" dir="ltr">{s.englishName}</p>}<h1>{s.brand}</h1>{s.tagline && <p>{s.tagline}</p>}</div></div><div className="wr-title"><span>{s.title}</span><b dir="ltr">{invoice.reference}</b></div></header>
    {(s.phone || s.address) && <div className="wr-contact">{s.phone && <span dir="ltr">{s.phone}</span>}{s.address && <span>{s.address}</span>}</div>}
    {cancelled && <p className="wr-void">{invoice.status === 'returned' ? 'فاتورة مرتجعة' : 'فاتورة ملغاة'}</p>}
    <section className="wr-meta">{metadata.map(([label, value], k) => <div key={k}><span>{label}</span><b dir={label === l.phone || label === l.reference || label === l.date ? 'ltr' : undefined}>{value}</b></div>)}</section>
    <table className="wr-table"><thead><tr>{s.showImages && !thermal && <th>{l.image}</th>}<th className="wr-product">{l.product}</th>{s.showSku && !thermal && <th>{l.sku}</th>}<th>{l.quantity}</th><th>{l.wholesale}</th>{s.showRetail && !thermal && <th>{l.retail}</th>}{s.showProfit && !thermal && <th>{l.profit}</th>}{s.showMargin && !thermal && <th>{l.margin}</th>}<th>{l.lineTotal}</th></tr></thead><tbody>{invoice.items.map((i, k) => {
      const profit = i.listPrice - i.unitPrice;
      return <tr key={k}>{s.showImages && !thermal && <td>{i.image ? <img src={image(i.image)} alt="" /> : <span className="wr-no-image">UR</span>}</td>}<td className="wr-product"><b>{i.nameAr || i.name}</b><small>{i.colorAr || i.color}</small>{thermal && s.showSku && <small dir="ltr">{i.productId}</small>}{thermal && s.showRetail && <small>{l.retail}: {n(i.listPrice)}</small>}{thermal && s.showProfit && <small>{l.profit}: {n(profit)}</small>}{thermal && s.showMargin && <small>{l.margin}: {i.listPrice > 0 ? n(profit / i.listPrice * 100) : '0'}%</small>}</td>{s.showSku && !thermal && <td dir="ltr">{i.productId}</td>}<td>{n(i.quantity)}</td><td>{n(i.unitPrice)}</td>{s.showRetail && !thermal && <td>{n(i.listPrice)}</td>}{s.showProfit && !thermal && <td>{n(profit)}</td>}{s.showMargin && !thermal && <td>{i.listPrice > 0 ? n(profit / i.listPrice * 100) : '0'}%</td>}<td><b>{n(i.quantity * i.unitPrice)}</b></td></tr>;
    })}</tbody></table>
    <section className="wr-summary"><div className="wr-summary-note"><span>{l.units}</span><strong>{n(units)}</strong>{s.showNote && invoice.note && <p><b>{l.note}</b><br />{invoice.note}</p>}</div><dl><div><dt>{l.subtotal}</dt><dd>{n(invoice.subtotal)} <small>{s.currency}</small></dd></div>{invoice.discount > 0 && <div><dt>{l.discount}</dt><dd>−{n(invoice.discount)} <small>{s.currency}</small></dd></div>}<div className="wr-total"><dt>{l.total}</dt><dd>{n(invoice.total)} <small>{s.currency}</small></dd></div>{s.showPayments && <><div><dt>{l.paid}</dt><dd>{n(invoice.paid)} <small>{s.currency}</small></dd></div><div className="wr-due"><dt>{l.remaining}</dt><dd>{n(invoice.remaining)} <small>{s.currency}</small></dd></div></>}</dl></section>
    {s.terms && <p className="wr-terms">{s.terms}</p>}{s.showSignatures && <div className="wr-signatures"><span>{l.receiver}</span><span>{l.issuer}</span></div>}
    <footer className="wr-footer">{s.footer}</footer>
  </article>;
}

type Props = { invoice: WholesaleInvoice; initialSettings: WholesaleReceiptSettings; canManage?: boolean; onClose?: () => void; onSaved?: (s: WholesaleReceiptSettings) => void; embedded?: boolean };
export function WholesaleReceipt({ invoice, initialSettings, canManage = false, onClose, onSaved, embedded = false }: Props) {
  const [draft, setDraft] = useState(initialSettings), [saved, setSaved] = useState(JSON.stringify(initialSettings));
  const [panel, setPanel] = useState(canManage), [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [height, setHeight] = useState(297), [printing, setPrinting] = useState(false);
  const sheet = useRef<HTMLDivElement>(null), fileInput = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== saved;
  const set = (patch: Partial<WholesaleReceiptSettings>) => { setDraft(d => ({ ...d, ...patch })); setMessage(''); setError(''); };
  useEffect(() => {
    const target = sheet.current?.querySelector('.wr-sheet'); if (!target) return;
    const observer = new ResizeObserver(() => { setHeight(Math.min(2000, Math.max(80, Math.ceil(target.getBoundingClientRect().height * 25.4 / 96 + 8)))); });
    observer.observe(target); return () => observer.disconnect();
  }, []);
  useEffect(() => { if (!dirty) return; const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  async function save() {
    setBusy(true); setError(''); setMessage('');
    try { const r = await api<{ settings: WholesaleReceiptSettings }>('/api/admin/wholesale/receipt-settings', { method: 'PUT', json: draft }); setDraft(r.settings); setSaved(JSON.stringify(r.settings)); onSaved?.(r.settings); setMessage('تم حفظ قالب الوصل لكل فواتير الجملة.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'تعذر حفظ الإعدادات.'); } finally { setBusy(false); }
  }
  async function upload(file: File | undefined) {
    if (!file) return; setUploading(true); setError('');
    try { const form = new FormData(); form.append('files', file); const r = await api<{ urls: string[] }>('/api/admin/media', { method: 'POST', body: form }); if (r.urls[0]) set({ logoUrl: r.urls[0], showLogo: true }); }
    catch (e) { setError(e instanceof Error ? e.message : 'تعذر رفع الشعار.'); } finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  async function print() {
    const target = sheet.current; if (!target) return; setPrinting(true);
    try {
      await document.fonts.ready;
      await Promise.all([...target.querySelectorAll('img')].filter(img => !img.complete).map(img => new Promise<void>(resolve => {
        const finish = () => { img.removeEventListener('load', finish); img.removeEventListener('error', finish); clearTimeout(timer); resolve(); };
        const timer = setTimeout(finish, 5000); img.addEventListener('load', finish); img.addEventListener('error', finish);
      })));
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (sheet.current === target) window.print();
    } finally { setPrinting(false); }
  }
  function close() { if (!dirty || window.confirm('توجد تعديلات على قالب الوصل لم تُحفظ. تريد إغلاقها؟')) onClose?.(); }
  const textField = (key: 'brand' | 'englishName' | 'tagline' | 'title' | 'phone' | 'address' | 'currency' | 'logoUrl', label: string) => <label className="wr-field" key={key}><span>{label}</span><input value={draft[key]} onChange={e => set({ [key]: e.target.value })} dir={key === 'englishName' || key === 'logoUrl' || key === 'phone' ? 'ltr' : undefined} maxLength={key === 'logoUrl' ? 2000 : key === 'address' ? 300 : 160} /></label>;
  const toggles: [keyof WholesaleReceiptSettings, string][] = [['showLogo','شعار المتجر'], ['showImages','صور المنتجات (A4)'], ['showSku','رمز المنتج'], ['showRetail','سعر المفرد'], ['showProfit','ربح التاجر للقطعة'], ['showMargin','نسبة ربح التاجر'], ['showPayments','المقبوض والمتبقي'], ['showNote','ملاحظة الفاتورة'], ['showSignatures','التواقيع والختم'], ['showTraderPhone','هاتف التاجر'], ['showShop','اسم المحل'], ['showCity','مدينة التاجر']];
  return <div className={`wr-workspace ${embedded ? 'wr-embedded' : ''}`} dir="rtl">
    <style>{`@media print { @page { size: ${draft.paper === 'thermal' ? `80mm ${height}mm` : 'A4'}; margin: ${draft.paper === 'thermal' ? '4mm' : '12mm'}; } }`}</style>
    <header className="wr-toolbar"><div className="wr-toolbar-title"><span className="wr-toolbar-icon"><LayoutTemplate size={20} /></span><div><h2>استوديو الوصل</h2><p>{invoice.id ? invoice.reference : 'قالب تجريبي · لا ينشئ فاتورة'}{dirty && <span className="wr-unsaved">تعديلات غير محفوظة</span>}</p></div></div><div className="wr-toolbar-actions">{canManage && <button type="button" className="wr-button" onClick={() => setPanel(p => !p)} aria-expanded={panel}><Settings2 size={16} /> تخصيص</button>}{canManage && <button type="button" className="wr-button" disabled={busy || uploading || !dirty || !draft.brand.trim() || !draft.title.trim() || !draft.currency.trim()} onClick={() => void save()}>{busy ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />} حفظ التصميم</button>}{invoice.id > 0 && (embedded ? <a className="wr-button wr-primary" aria-disabled={dirty} onClick={e => { if (dirty) { e.preventDefault(); setError('احفظ القالب أولاً حتى يفتح الوصل بنفس التصميم.'); } }} href={`/admin/print/wholesale/${invoice.id}`} target="_blank" rel="noreferrer"><Printer size={16} /> فتح للطباعة</a> : <button type="button" className="wr-button wr-primary" disabled={printing} onClick={() => void print()}>{printing ? <LoaderCircle size={16} className="spin" /> : <Printer size={16} />} طباعة / PDF</button>)}{onClose ? <button type="button" className="wr-icon-button" onClick={close} aria-label="إغلاق إعدادات الوصل"><X size={20} /></button> : <Link className="wr-button" href="/admin/wholesale"><ArrowRight size={16} /> بيع الجملة</Link>}</div></header>
    {(error || message) && <div className={`wr-messagebar ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</div>}
    <div className={`wr-layout ${!panel ? 'wr-no-panel' : ''}`}>
      {panel && canManage && <aside className="wr-controls"><div className="wr-controls-heading"><h3>إعدادات القالب</h3><p>التغييرات تظهر مباشرة في المعاينة. الحفظ يطبّق القالب على كل الفواتير.</p></div>
        <details open><summary>المقاس والتصميم <ChevronDown size={15} /></summary><div className="wr-control-body"><div className="wr-paper-options"><button type="button" className={draft.paper === 'a4' ? 'is-active' : ''} onClick={() => set({ paper: 'a4' })}><b>A4</b><small>ورقة كاملة</small></button><button type="button" className={draft.paper === 'thermal' ? 'is-active' : ''} onClick={() => set({ paper: 'thermal' })}><b>80 mm</b><small>طابعة حرارية</small></button></div><div className="wr-field-pair"><label className="wr-field"><span>لون القالب</span><input type="color" value={draft.accent} onChange={e => set({ accent: e.target.value })} /></label><label className="wr-field"><span>المسافات</span><select value={draft.density} onChange={e => set({ density: e.target.value as WholesaleReceiptSettings['density'] })}><option value="comfortable">مريحة</option><option value="compact">مختصرة</option></select></label></div></div></details>
        <details open><summary>هوية المتجر <ChevronDown size={15} /></summary><div className="wr-control-body">{textField('brand','اسم المتجر')}{textField('englishName','الاسم بالإنكليزي')}{textField('title','عنوان الوصل')}{textField('tagline','وصف تحت الاسم')}{textField('logoUrl','رابط الشعار')}<input type="file" ref={fileInput} accept="image/*" hidden onChange={e => void upload(e.target.files?.[0])} /><button className="wr-button wr-upload" type="button" disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? <LoaderCircle size={15} className="spin" /> : <ImagePlus size={15} />} رفع شعار من الجهاز</button>{textField('phone','هاتف المتجر')}{textField('address','عنوان المتجر')}{textField('currency','رمز الدينار العراقي')}</div></details>
        <details><summary>الأعمدة والمحتوى <ChevronDown size={15} /></summary><div className="wr-control-body">{toggles.map(([key,label]) => <label className="wr-switch" key={key}><span>{label}</span><input type="checkbox" checked={draft[key] as boolean} onChange={e => set({ [key]: e.target.checked })} /><i aria-hidden="true" /></label>)}</div></details>
        <details><summary>الملاحظات والتواقيع <ChevronDown size={15} /></summary><div className="wr-control-body"><label className="wr-field"><span>شروط أسفل الوصل</span><textarea rows={3} maxLength={1000} value={draft.terms} onChange={e => set({ terms: e.target.value })} /></label><label className="wr-field"><span>رسالة ختامية</span><textarea rows={2} maxLength={1000} value={draft.footer} onChange={e => set({ footer: e.target.value })} /></label>{(['receiver','issuer'] as ReceiptLabel[]).map(key => <label className="wr-field" key={key}><span>{receiptLabelDefaults[key]}</span><input value={draft.labels[key]} maxLength={80} onChange={e => set({ labels: { ...draft.labels, [key]: e.target.value } })} /></label>)}</div></details>
        <details><summary>تعديل عناوين الحقول <ChevronDown size={15} /></summary><div className="wr-control-body">{(Object.keys(receiptLabelDefaults) as ReceiptLabel[]).filter(key => key !== 'receiver' && key !== 'issuer').map(key => <label className="wr-field" key={key}><span>{receiptLabelDefaults[key]}</span><input maxLength={80} value={draft.labels[key]} onChange={e => set({ labels: { ...draft.labels, [key]: e.target.value } })} /></label>)}</div></details>
        <div className="wr-save-area">{error && <p className="wr-error">{error}</p>}{message && <p className="wr-success"><Check size={15} /> {message}</p>}<button type="button" className="wr-button wr-primary" disabled={busy || uploading || !dirty || !draft.brand.trim() || !draft.title.trim() || !draft.currency.trim()} onClick={() => void save()}>{busy ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />} حفظ القالب</button><button type="button" className="wr-reset" onClick={() => { if (window.confirm('تريد استعادة القالب الافتراضي؟ لن يُحفظ إلا بعد الضغط على حفظ.')) setDraft({ ...defaultWholesaleReceipt, phone: initialSettings.phone, address: initialSettings.address, logoUrl: initialSettings.logoUrl }); }}><RotateCcw size={13} /> استعادة الافتراضي</button></div>
      </aside>}
      <main className="wr-preview-area"><div className="wr-preview-caption"><span><i /> معاينة مباشرة</span><span>{draft.paper === 'a4' ? 'A4 · 210 × 297 mm' : 'حراري · 80 mm'}</span></div><div ref={sheet} className="wr-paper-stage"><ReceiptSheet invoice={invoice} settings={draft} /></div><p className="wr-print-tip">{draft.paper === 'thermal' ? 'اختر ورق 80 ملم في إعدادات الطابعة، وأوقف رؤوس وتذييلات المتصفح.' : 'اختر A4 ومقياس 100%، وأوقف رؤوس وتذييلات المتصفح.'}</p></main>
    </div>
  </div>;
}
