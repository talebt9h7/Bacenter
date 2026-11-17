'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowRight, Check, ChevronDown, LoaderCircle, Plus, Printer, RotateCcw, Save, Settings2, Trash2, FileSpreadsheet } from 'lucide-react';
import { defaultPriceList, type PriceListData, type PriceListRow, type PriceListSettings, type PriceTerm, type PriceTier } from '@/lib/wholesale-price-list';
import { api } from './ui';
import './wholesale-receipt.css';
import './price-list.css';

const n = (v: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(v));
const thumb = (url: string) => (url.startsWith('/api/media/') ? `${url}?w=240` : url);

/** The printable list itself (A4). Quantities are typed on the preview to turn it into a quote; they are not saved. */
export function PriceListSheet({ data, s, qty, onQty }: { data: PriceListData; s: PriceListSettings; qty: Record<string, number>; onQty?: (key: string, value: number) => void }) {
  const source = s.rowMode === 'product' ? data.productRows : data.rows;
  const hidden = new Set(s.hidden);
  const visible = source.filter(r => !hidden.has(r.key) && !hidden.has(r.productKey));
  const grand = visible.reduce((sum, r) => sum + (qty[r.key] ?? 0) * r.wholesale, 0);
  return <article className="pl-sheet" dir="rtl" lang="ar" style={{ '--pl-accent': s.accent } as CSSProperties}>
    <header className="pl-cover">
      {s.englishName && <p className="pl-en" dir="ltr">{s.englishName}</p>}
      <h1>{s.brand}</h1>
      {s.tagline && <p className="pl-tagline">{s.tagline}</p>}
      {s.title && <div className="pl-title">{s.title}</div>}
    </header>
    <hr className="pl-rule" />
    {data.categories.map(c => {
      const rows = visible.filter(r => r.categoryId === c.id);
      if (!rows.length) return null;
      return <section key={c.id} className="pl-category">
        <h2>{s.categoryTitles[c.id] || c.title}</h2>
        <table className="pl-table">
          <thead><tr>
            {s.showImages && <th className="pl-img-col">الصورة</th>}
            <th className="pl-name-col">المنتج</th>
            <th>سعر الجملة<br /><small>(دينار)</small></th>
            {s.showRetail && <th>سعر البيع الملزم<br /><small>(دينار)</small></th>}
            {s.showProfit && <th>ربح التاجر<br /><small>للقطعة</small></th>}
            {s.showMargin && <th>نسبة الربح</th>}
            {s.showQuantity && <th>العدد</th>}
            {s.showQuantity && <th>الإجمالي<br /><small>(جملة)</small></th>}
          </tr></thead>
          <tbody>{rows.map(r => <Row key={r.key} r={r} s={s} qty={qty[r.key] ?? 0} onQty={onQty} />)}</tbody>
        </table>
      </section>;
    })}
    {!visible.length && <p className="pl-empty">ماكو منتجات عليها سعر جملة. أضف سعر الجملة من صفحة المنتج.</p>}
    {s.showQuantity && grand > 0 && <div className="pl-grand"><span>الإجمالي الكلي للطلبية:</span><strong>{n(grand)} <small>د.ع</small></strong><em>{visible.reduce((t, r) => t + (qty[r.key] ?? 0), 0)} قطعة</em></div>}
    {s.showTiers && s.tiers.length > 0 && <section className="pl-block"><h2>{s.tiersTitle}</h2><div className="pl-tiers" style={{ gridTemplateColumns: `repeat(${Math.min(3, s.tiers.length)}, minmax(0, 1fr))` }}>{s.tiers.map((t, i) => <div key={i} className="pl-tier"><b>{t.title}</b>{t.subtitle && <strong>{t.subtitle}</strong>}{t.note && <small>{t.note}</small>}</div>)}</div></section>}
    {(s.showTerms && s.terms.length > 0) || s.showPolicy ? <section className="pl-block"><h2>{s.termsTitle}</h2><div className="pl-terms">
      {s.showTerms && <ol>{s.terms.map((t, i) => <li key={i}>{t.label && <b>{t.label}: </b>}{t.text}</li>)}</ol>}
      {s.showPolicy && <div className="pl-policy"><b>⚠ {s.policyTitle}</b><p>{s.policyText}</p></div>}
    </div></section> : null}
    <footer className="pl-footer"><hr className="pl-rule" /><div className="pl-sign"><span className="pl-sign-ar">{s.brand}</span>{s.englishName && <span className="pl-sign-en" dir="ltr">— {s.englishName}</span>}</div>{s.footerLine && <p>{s.footerLine}</p>}{s.validityNote && <small>{s.validityNote}</small>}</footer>
  </article>;
}

function Row({ r, s, qty, onQty }: { r: PriceListRow; s: PriceListSettings; qty: number; onQty?: (key: string, value: number) => void }) {
  const profit = r.retail - r.wholesale;
  const margin = r.retail > 0 ? Math.round((profit / r.retail) * 100) : 0;
  return <tr>
    {s.showImages && <td className="pl-img-col">{r.image ? <img src={thumb(r.image)} alt="" /> : <span className="pl-noimg">UR</span>}</td>}
    <td className="pl-name-col"><b>{r.nameAr}</b>{s.showEnglish && r.nameEn && <small dir="ltr">{r.nameEn}</small>}</td>
    <td className="pl-num">{n(r.wholesale)}</td>
    {s.showRetail && <td className="pl-num"><strong className="pl-retail">{n(r.retail)}</strong>{s.showFixedNote && s.fixedNote && <small className="pl-fixed">{s.fixedNote}</small>}</td>}
    {s.showProfit && <td className="pl-num pl-profit">{n(profit)} <small>د.ع</small></td>}
    {s.showMargin && <td className="pl-num"><b>{margin}%</b></td>}
    {s.showQuantity && <td className="pl-num">{onQty ? <input className="pl-qty" type="number" min="0" inputMode="numeric" value={qty || ''} onChange={e => onQty(r.key, Math.max(0, Math.round(Number(e.target.value) || 0)))} aria-label={`عدد ${r.nameAr}`} /> : qty || ''}</td>}
    {s.showQuantity && <td className="pl-num pl-line">{qty ? <>{n(qty * r.wholesale)} <small>د.ع</small></> : '—'}</td>}
  </tr>;
}

export function PriceListStudio({ data, initial, canManage }: { data: PriceListData; initial: PriceListSettings; canManage: boolean }) {
  const [s, setS] = useState(initial), [saved, setSaved] = useState(JSON.stringify(initial));
  const [panel, setPanel] = useState(canManage), [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [err, setErr] = useState('');
  const [qty, setQty] = useState<Record<string, number>>({});
  const dirty = JSON.stringify(s) !== saved;
  const set = (patch: Partial<PriceListSettings>) => { setS(d => ({ ...d, ...patch })); setMsg(''); setErr(''); };
  useEffect(() => { if (!dirty) return; const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  async function save() {
    setBusy(true); setErr(''); setMsg('');
    try { const r = await api<{ settings: PriceListSettings }>('/api/admin/wholesale/price-list-settings', { method: 'PUT', json: s }); setS(r.settings); setSaved(JSON.stringify(r.settings)); setMsg('انحفظت القائمة.'); }
    catch (e) { setErr(e instanceof Error ? e.message : 'ما انحفظت.'); } finally { setBusy(false); }
  }
  async function print() { await document.fonts.ready; window.print(); }
  const source = s.rowMode === 'product' ? data.productRows : data.rows;
  const hidden = useMemo(() => new Set(s.hidden), [s.hidden]);
  const toggleRow = (key: string) => set({ hidden: hidden.has(key) ? s.hidden.filter(h => h !== key) : [...s.hidden, key] });
  const text = (key: 'englishName' | 'brand' | 'tagline' | 'title' | 'fixedNote' | 'tiersTitle' | 'termsTitle' | 'policyTitle' | 'footerLine' | 'validityNote', label: string) => <label className="wr-field" key={key}><span>{label}</span><input value={s[key]} maxLength={200} dir={key === 'englishName' ? 'ltr' : undefined} onChange={e => set({ [key]: e.target.value })} /></label>;
  const sw = (key: 'showImages' | 'showEnglish' | 'showRetail' | 'showFixedNote' | 'showProfit' | 'showMargin' | 'showQuantity' | 'showTiers' | 'showTerms' | 'showPolicy', label: string) => <label className="wr-switch" key={key}><span>{label}</span><input type="checkbox" checked={s[key]} onChange={e => set({ [key]: e.target.checked })} /><i aria-hidden="true" /></label>;
  const setTier = (i: number, patch: Partial<PriceTier>) => set({ tiers: s.tiers.map((t, k) => (k === i ? { ...t, ...patch } : t)) });
  const setTerm = (i: number, patch: Partial<PriceTerm>) => set({ terms: s.terms.map((t, k) => (k === i ? { ...t, ...patch } : t)) });
  const quoteTotal = source.filter(r => !hidden.has(r.key) && !hidden.has(r.productKey)).reduce((sum, r) => sum + (qty[r.key] ?? 0) * r.wholesale, 0);

  return <div className="wr-workspace pl-workspace" dir="rtl">
    <style>{'@media print { @page { size: A4; margin: 10mm; } }'}</style>
    <header className="wr-toolbar"><div className="wr-toolbar-title"><span className="wr-toolbar-icon"><FileSpreadsheet size={20} /></span><div><h2>قائمة أسعار الجملة</h2><p>{source.length} سطر من المنتجات اللي عليها سعر جملة{dirty && <span className="wr-unsaved">تعديلات غير محفوظة</span>}</p></div></div>
      <div className="wr-toolbar-actions">
        <Link className="wr-button" href="/admin/wholesale"><ArrowRight size={16} /> بيع الجملة</Link>
        {canManage && <button type="button" className="wr-button" onClick={() => setPanel(p => !p)} aria-expanded={panel}><Settings2 size={16} /> تعديل التصميم</button>}
        <button type="button" className="wr-button wr-primary" onClick={() => void print()}><Printer size={16} /> طباعة / حفظ PDF</button>
      </div>
    </header>
    <div className={`wr-layout ${!panel ? 'wr-no-panel' : ''}`}>
      {panel && canManage && <aside className="wr-controls">
        <div className="wr-controls-heading"><h3>تعديل القائمة</h3><p>كل تغيير يبين بالمعاينة مباشرة. الأسعار والصور تنسحب من المنتجات.</p></div>
        <details open><summary>الهوية والعنوان <ChevronDown size={15} /></summary><div className="wr-control-body">{text('englishName', 'الاسم بالإنكليزي')}{text('brand', 'اسم المتجر')}{text('tagline', 'الوصف تحت الاسم')}{text('title', 'عنوان القائمة')}<label className="wr-field"><span>لون القائمة</span><input type="color" value={s.accent} onChange={e => set({ accent: e.target.value })} /></label></div></details>
        <details open><summary>الجدول <ChevronDown size={15} /></summary><div className="wr-control-body">
          <div className="wr-paper-options"><button type="button" className={s.rowMode === 'variant' ? 'is-active' : ''} onClick={() => set({ rowMode: 'variant' })}><b>كل لون</b><small>سطر لكل لون</small></button><button type="button" className={s.rowMode === 'product' ? 'is-active' : ''} onClick={() => set({ rowMode: 'product' })}><b>كل منتج</b><small>سطر لكل منتج</small></button></div>
          {sw('showImages', 'صور المنتجات')}{sw('showEnglish', 'الاسم بالإنكليزي تحت المنتج')}{sw('showRetail', 'سعر البيع الملزم')}{sw('showFixedNote', 'ملاحظة تحت سعر البيع')}{s.showFixedNote && text('fixedNote', 'نص الملاحظة')}{sw('showProfit', 'ربح التاجر للقطعة')}{sw('showMargin', 'نسبة الربح')}{sw('showQuantity', 'خانة العدد والإجمالي (عرض سعر)')}
        </div></details>
        <details><summary>المنتجات بالقائمة <ChevronDown size={15} /></summary><div className="wr-control-body">
          {data.categories.map(c => <div key={c.id} className="pl-pick-group"><label className="wr-field"><span>عنوان قسم «{c.title}»</span><input value={s.categoryTitles[c.id] ?? ''} placeholder={c.title} maxLength={60} onChange={e => set({ categoryTitles: { ...s.categoryTitles, [c.id]: e.target.value } })} /></label>
            {source.filter(r => r.categoryId === c.id).map(r => <label key={r.key} className="pl-pick"><input type="checkbox" checked={!hidden.has(r.key) && !hidden.has(r.productKey)} disabled={hidden.has(r.productKey) && r.key !== r.productKey} onChange={() => toggleRow(r.key)} /><span>{r.nameAr}</span><small>{n(r.wholesale)}</small></label>)}</div>)}
        </div></details>
        <details><summary>شرائح الكميات <ChevronDown size={15} /></summary><div className="wr-control-body">{sw('showTiers', 'إظهار الشرائح')}{s.showTiers && <>{text('tiersTitle', 'العنوان')}{s.tiers.map((t, i) => <div key={i} className="pl-edit-card"><input value={t.title} placeholder="مثلاً: 10 — 24 قطعة" onChange={e => setTier(i, { title: e.target.value })} /><input value={t.subtitle} placeholder="مثلاً: خصم إضافي 5%" onChange={e => setTier(i, { subtitle: e.target.value })} /><input value={t.note} placeholder="ملاحظة صغيرة" onChange={e => setTier(i, { note: e.target.value })} /><button type="button" className="wr-reset" onClick={() => set({ tiers: s.tiers.filter((_, k) => k !== i) })}><Trash2 size={13} /> حذف</button></div>)}{s.tiers.length < 6 && <button type="button" className="wr-button" onClick={() => set({ tiers: [...s.tiers, { title: '', subtitle: '', note: '' }] })}><Plus size={14} /> شريحة</button>}</>}</div></details>
        <details><summary>الشروط والسياسة <ChevronDown size={15} /></summary><div className="wr-control-body">{sw('showTerms', 'إظهار الشروط')}{s.showTerms && <>{text('termsTitle', 'العنوان')}{s.terms.map((t, i) => <div key={i} className="pl-edit-card"><input value={t.label} placeholder="العنوان (مثلاً: الدفع)" onChange={e => setTerm(i, { label: e.target.value })} /><textarea rows={2} value={t.text} placeholder="النص" onChange={e => setTerm(i, { text: e.target.value })} /><button type="button" className="wr-reset" onClick={() => set({ terms: s.terms.filter((_, k) => k !== i) })}><Trash2 size={13} /> حذف</button></div>)}{s.terms.length < 15 && <button type="button" className="wr-button" onClick={() => set({ terms: [...s.terms, { label: '', text: '' }] })}><Plus size={14} /> شرط</button>}</>}
          {sw('showPolicy', 'مربع سياسة السعر')}{s.showPolicy && <>{text('policyTitle', 'عنوان المربع')}<label className="wr-field"><span>النص</span><textarea rows={5} maxLength={1500} value={s.policyText} onChange={e => set({ policyText: e.target.value })} /></label></>}</div></details>
        <details><summary>الخاتمة <ChevronDown size={15} /></summary><div className="wr-control-body">{text('footerLine', 'سطر التواصل')}{text('validityNote', 'ملاحظة أخيرة')}</div></details>
        <div className="wr-save-area">{err && <p className="wr-error">{err}</p>}{msg && <p className="wr-success"><Check size={15} /> {msg}</p>}
          <button type="button" className="wr-button wr-primary" disabled={busy || !dirty} onClick={() => void save()}>{busy ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />} حفظ القائمة</button>
          <button type="button" className="wr-reset" onClick={() => { if (window.confirm('ترجع القائمة للتصميم الافتراضي؟ (ما تنحفظ إلا تضغط حفظ)')) set({ ...defaultPriceList }); }}><RotateCcw size={13} /> التصميم الافتراضي</button>
        </div>
      </aside>}
      <main className="wr-preview-area">
        <div className="wr-preview-caption"><span><i /> معاينة · A4</span>{s.showQuantity && <span>{quoteTotal > 0 ? `عرض سعر: ${n(quoteTotal)} د.ع` : 'اكتب العدد بالجدول حتى تطلع عرض سعر'}</span>}</div>
        <div className="wr-paper-stage pl-stage"><PriceListSheet data={data} s={s} qty={qty} onQty={(key, value) => setQty(q => ({ ...q, [key]: value }))} /></div>
        <p className="wr-print-tip">بالطباعة اختر A4 ومقياس 100%، وأوقف «الرأس والتذييل» حتى ما يطلع التاريخ والرابط على الورقة. «حفظ كـ PDF» يطلعلك ملف ترسله للتجار.</p>
      </main>
    </div>
  </div>;
}

