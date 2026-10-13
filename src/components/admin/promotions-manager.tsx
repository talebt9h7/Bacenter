'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, CalendarPlus, Copy, Flame, LoaderCircle, Pause, Pencil, Percent, Play, Plus, Search, Square, Tag, Timer, Trash2, TrendingUp, X } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { PromotionRecord } from '@/lib/promotions';
import { promotionalPrice, isLive } from '@/lib/promotion-math';
import { api, Modal, useFlash } from './ui';
import { Card, Kpi, PageHero, fmt, iqd } from './dash-ui';

type ProductOption = { id: string; name: string; nameAr: string; category: string; price: number; image: string; published: boolean };
type CategoryOption = { id: string; name: string; nameAr: string };
type Perf = Record<number, { orders: number; units: number; revenue: number; saved: number }>;
type Draft = { id?: number; name: string; nameAr: string; type: 'percent' | 'amount' | 'price'; value: string; scope: 'all' | 'categories' | 'products'; categoryIds: string[]; productIds: string[]; startMode: 'now' | 'later'; start: string; end: string; active: boolean; showCountdown: boolean; badge: string; badgeAr: string };

const HOUR = 3_600_000;
const BAGHDAD = 3 * HOUR;
/** "YYYY-MM-DDTHH:mm" in Baghdad time, for datetime-local inputs. */
const toLocal = (ms: number) => new Date(ms + BAGHDAD).toISOString().slice(0, 16);
const fromLocal = (value: string) => new Date(`${value}:00+03:00`).getTime();
const DURATIONS: [number, string, string][] = [[6, '6 hours', '6 ساعات'], [12, '12 hours', '12 ساعة'], [24, '1 day', 'يوم'], [48, '2 days', 'يومين'], [72, '3 days', '3 أيام'], [168, '1 week', 'أسبوع'], [336, '2 weeks', 'أسبوعين'], [720, '30 days', '30 يوم']];

function blankDraft(): Draft { const start = Math.ceil(Date.now() / (5 * 60_000)) * 5 * 60_000; return { name: '', nameAr: '', type: 'percent', value: '20', scope: 'all', categoryIds: [], productIds: [], startMode: 'now', start: toLocal(start), end: toLocal(start + 48 * HOUR), active: true, showCountdown: true, badge: '', badgeAr: '' }; }
function draftFrom(p: PromotionRecord, copy = false): Draft {
  const start = copy ? Math.ceil(Date.now() / 300_000) * 300_000 : new Date(p.startsAt).getTime();
  const end = copy ? start + (new Date(p.endsAt).getTime() - new Date(p.startsAt).getTime()) : new Date(p.endsAt).getTime();
  return { id: copy ? undefined : p.id, name: copy ? `${p.name} (copy)` : p.name, nameAr: copy ? `${p.nameAr} (نسخة)` : p.nameAr, type: p.type as Draft['type'], value: String(p.value), scope: p.scope as Draft['scope'], categoryIds: p.categoryIds, productIds: p.productIds, startMode: 'later', start: toLocal(start), end: toLocal(end), active: copy ? true : p.active, showCountdown: p.showCountdown, badge: p.badge, badgeAr: p.badgeAr };
}
function statusOf(p: PromotionRecord, now: number) {
  if (!p.active) return 'paused';
  if (now < new Date(p.startsAt).getTime()) return 'scheduled';
  if (now >= new Date(p.endsAt).getTime()) return 'ended';
  return 'live';
}
function span(ms: number, ar: boolean) {
  const m = Math.max(0, Math.round(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), min = m % 60;
  if (d) return ar ? `${d} يوم${h ? ` و${h} س` : ''}` : `${d}d ${h}h`;
  if (h) return ar ? `${h} س${min ? ` و${min} د` : ''}` : `${h}h ${min}m`;
  return ar ? `${min} دقيقة` : `${min} min`;
}

export function PromotionsManager({ promotions, products, categories, performance, canManage }: { promotions: PromotionRecord[]; products: ProductOption[]; categories: CategoryOption[]; performance: Perf; canManage: boolean }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const lang = ar ? 'ar' : 'en';
  const tt = (en: string, arText: string) => ar ? arText : en;
  const router = useRouter();
  const { flash, success, fail } = useFlash();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);
  const [filter, setFilter] = useState<'all' | 'live' | 'scheduled' | 'ended' | 'paused'>('all');
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const rows = useMemo(() => promotions.map(p => ({ ...p, status: statusOf(p, now) })), [promotions, now]);
  const counts = { live: rows.filter(r => r.status === 'live').length, scheduled: rows.filter(r => r.status === 'scheduled').length, ended: rows.filter(r => r.status === 'ended').length, paused: rows.filter(r => r.status === 'paused').length };
  const onSaleNow = products.filter(p => promotions.some(promo => isLive(promo, now) && (promo.scope === 'all' || (promo.scope === 'categories' ? promo.categoryIds.includes(p.category) : promo.productIds.includes(p.id))) && promotionalPrice(p.price, promo) < p.price)).length;
  const totals = Object.values(performance).reduce((s, p) => ({ revenue: s.revenue + p.revenue, units: s.units + p.units, saved: s.saved + p.saved }), { revenue: 0, units: 0, saved: 0 });
  const visible = rows.filter(r => filter === 'all' || r.status === filter);
  const statusLabel: Record<string, [string, string, string]> = { live: ['Live', 'شغّال', 'success'], scheduled: ['Scheduled', 'مجدول', 'info'], ended: ['Ended', 'منتهي', 'muted'], paused: ['Paused', 'متوقف', 'warning'] };
  const typeText = (p: Pick<PromotionRecord, 'type' | 'value'>) => p.type === 'percent' ? `−${p.value}%` : p.type === 'amount' ? tt(`−${fmt(p.value)} IQD each`, `−${fmt(p.value)} د.ع للقطعة`) : tt(`Fixed ${fmt(p.value)} IQD`, `سعر ثابت ${fmt(p.value)} د.ع`);
  const scopeText = (p: PromotionRecord) => p.scope === 'all' ? tt('Whole store', 'كل المتجر') : p.scope === 'categories' ? p.categoryIds.map(id => { const c = categories.find(x => x.id === id); return c ? (ar ? c.nameAr : c.name) : id; }).join('، ') : tt(`${p.productIds.length} products`, `${p.productIds.length} منتج`);


  const payload = (d: Draft) => ({ name: d.name, nameAr: d.nameAr, type: d.type, value: Number(d.value), scope: d.scope, categoryIds: d.categoryIds, productIds: d.productIds, startsAt: new Date(d.startMode === 'now' ? Date.now() : fromLocal(d.start)).toISOString(), endsAt: new Date(fromLocal(d.end)).toISOString(), active: d.active, showCountdown: d.showCountdown, badge: d.badge, badgeAr: d.badgeAr });
  const asPayload = (p: PromotionRecord, patch: Partial<PromotionRecord> = {}) => ({ ...p, ...patch });

  async function save(d: Draft) {
    try {
      if (d.id) await api(`/api/admin/promotions/${d.id}`, { method: 'PUT', json: payload(d) });
      else await api('/api/admin/promotions', { method: 'POST', json: payload(d) });
      setEditing(null); success(tt('Offer saved.', 'تم حفظ العرض.')); router.refresh();
    } catch (e) { fail(e); throw e; }
}
  async function quick(p: PromotionRecord, patch: Partial<PromotionRecord>, message: string) {
    setBusy(p.id);
    try { await api(`/api/admin/promotions/${p.id}`, { method: 'PUT', json: asPayload(p, patch) }); success(message); router.refresh(); }
    catch (e) { fail(e); } finally { setBusy(null); }
}
  async function remove(p: PromotionRecord) {
    if (!window.confirm(tt(`Delete the offer “${p.name}”? Past orders keep their prices.`, `حذف العرض «${p.nameAr || p.name}»؟ الطلبات السابقة تبقى بأسعارها.`))) return;
    setBusy(p.id);
    try { await api(`/api/admin/promotions/${p.id}`, { method: 'DELETE' }); success(tt('Offer deleted.', 'تم حذف العرض.')); router.refresh(); }
    catch (e) { fail(e); } finally { setBusy(null); }
}

  return <main className="admin-page dash">
    <PageHero eyebrow={tt('Marketing', 'التسويق')} title={tt('Offers & sales', 'العروض والتخفيضات')} description={tt('Time-limited price cuts on the whole store, a category or chosen products. Prices change by themselves when an offer starts and ends; shoppers see the old price struck through and a countdown.', 'تخفيضات لفترة محددة على كل المتجر أو صنف أو منتجات تختارها. الأسعار تتغير بنفسها من يبدي العرض ومن ينتهي، والزبون يشوف السعر القديم مشطوب وعدّاد تنازلي.')}
      actions={canManage ? <div className="dash-quick"><button type="button" className="dash-btn primary" onClick={() => setEditing(blankDraft())}><Plus size={15} /> {tt('New offer', 'عرض جديد')}</button></div> : null} />
    {flash}
    <section className="dash-kpis">
      <Kpi lang={lang} icon={<Flame size={17} />} tone="accent" label={tt('Live now', 'شغّالة الآن')} value={counts.live} />
      <Kpi lang={lang} delay={50} icon={<CalendarClock size={17} />} tone="blue" label={tt('Scheduled', 'مجدولة')} value={counts.scheduled} />
      <Kpi lang={lang} delay={100} icon={<Tag size={17} />} tone="gold" label={tt('Products on sale now', 'منتجات عليها عرض الآن')} value={onSaleNow} note={tt(`of ${products.length}`, `من ${products.length}`)} />
      <Kpi lang={lang} delay={150} icon={<TrendingUp size={17} />} tone="success" label={tt('Sales from offers', 'مبيعات العروض')} value={totals.revenue} format={iqd} note={tt(`${fmt(totals.units)} units`, `${fmt(totals.units)} قطعة`)} />
      <Kpi lang={lang} delay={200} icon={<Percent size={17} />} tone="violet" label={tt('Given to customers', 'وفّرها الزبائن')} value={totals.saved} format={iqd} />
      <Kpi lang={lang} delay={250} icon={<Square size={17} />} tone="danger" label={tt('Ended / paused', 'منتهية / متوقفة')} value={counts.ended + counts.paused} />
    </section>

    <Card icon={<Tag size={17} />} title={tt('All offers', 'كل العروض')} action={<div className="dash-periods">{(['all', 'live', 'scheduled', 'ended', 'paused'] as const).map(key => <button key={key} type="button" className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{key === 'all' ? tt('All', 'الكل') : statusLabel[key][ar ? 1 : 0]}{key !== 'all' && ` (${counts[key]})`}</button>)}</div>}>
      {visible.length ? <div className="dash-table-wrap"><table className="dash-table promo-table">
        <thead><tr><th>{tt('Offer', 'العرض')}</th><th>{tt('Discount', 'الخصم')}</th><th>{tt('Applies to', 'يشمل')}</th><th>{tt('Status', 'الحالة')}</th><th>{tt('When', 'المدة')}</th><th className="num">{tt('Orders', 'الطلبات')}</th><th className="num">{tt('Sales', 'المبيعات')}</th>{canManage && <th />}</tr></thead>
        <tbody>{visible.map(p => {
          const start = new Date(p.startsAt).getTime(), end = new Date(p.endsAt).getTime();
          const perf = performance[p.id];
          const progress = p.status === 'live' ? Math.min(100, ((now - start) / (end - start)) * 100) : p.status === 'ended' ? 100 : 0;
          return <tr key={p.id}>
            <td><b>{ar ? p.nameAr || p.name : p.name}</b>{(p.badge || p.badgeAr) && <small>{tt('Badge', 'الشارة')}: {ar ? p.badgeAr || p.badge : p.badge || p.badgeAr}</small>}</td>
            <td><span className="dash-chip warning">{typeText(p)}</span></td>
            <td>{scopeText(p)}</td>
            <td><span className={`dash-chip ${statusLabel[p.status][2]}`}>{statusLabel[p.status][ar ? 1 : 0]}</span></td>
            <td className="promo-when">
              <small>{new Date(start).toLocaleString(ar ? 'ar-IQ' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Baghdad' })} → {new Date(end).toLocaleString(ar ? 'ar-IQ' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Baghdad' })}</small>
              <span className="promo-progress"><i style={{ width: `${progress}%` }} /></span>
              <small className="promo-left">{p.status === 'live' ? tt(`Ends in ${span(end - now, false)}`, `ينتهي خلال ${span(end - now, true)}`) : p.status === 'scheduled' ? tt(`Starts in ${span(start - now, false)}`, `يبدي خلال ${span(start - now, true)}`) : p.status === 'ended' ? tt('Ended', 'انتهى') : tt('Paused', 'متوقف')}</small>
            </td>
            <td className="num">{perf?.orders ?? 0}</td>
            <td className="num">{perf ? <><strong>{iqd(perf.revenue)}</strong><small>{tt(`${perf.units} units`, `${perf.units} قطعة`)}</small></> : '—'}</td>
            {canManage && <td className="num"><div className="promo-actions">
              {busy === p.id ? <LoaderCircle size={15} className="spin" /> : <>
                <button type="button" title={tt('Edit', 'تعديل')} onClick={() => setEditing(draftFrom(p))}><Pencil size={14} /></button>
                {p.status === 'live' && <button type="button" title={tt('Extend by 1 day', 'تمديد يوم')} onClick={() => void quick(p, { endsAt: new Date(end + 24 * HOUR).toISOString() }, tt('Extended by a day.', 'تم التمديد يوم.'))}><CalendarPlus size={14} /></button>}
                {p.status === 'live' && <button type="button" title={tt('End now', 'إنهاء الآن')} onClick={() => { if (window.confirm(tt('End this offer now? Prices go back to normal immediately.', 'إنهاء العرض الآن؟ الأسعار ترجع طبيعية فوراً.'))) void quick(p, { endsAt: new Date(Math.max(Date.now(), start + 60_000)).toISOString() }, tt('Offer ended.', 'تم إنهاء العرض.')); }}><Square size={14} /></button>}
                {p.status !== 'ended' && <button type="button" title={p.active ? tt('Pause', 'إيقاف مؤقت') : tt('Resume', 'تشغيل')} onClick={() => void quick(p, { active: !p.active }, p.active ? tt('Offer paused.', 'تم إيقاف العرض.') : tt('Offer resumed.', 'تم تشغيل العرض.'))}>{p.active ? <Pause size={14} /> : <Play size={14} />}</button>}
                <button type="button" title={tt('Run again (copy)', 'تكرار العرض')} onClick={() => setEditing(draftFrom(p, true))}><Copy size={14} /></button>
                <button type="button" className="danger" title={tt('Delete', 'حذف')} onClick={() => void remove(p)}><Trash2 size={14} /></button>
              </>}
            </div></td>}
          </tr>;
        })}</tbody>
      </table></div> : <div className="dash-empty"><Tag size={22} />{promotions.length ? tt('No offers with this status.', 'ماكو عروض بهذه الحالة.') : tt('No offers yet. Create your first one — for example 20% off everything for 2 days.', 'ماكو عروض بعد. سوّي أول عرض — مثلاً خصم 20% على كل المتجر لمدة يومين.')}{!promotions.length && canManage && <button type="button" className="dash-btn primary" onClick={() => setEditing(blankDraft())}><Plus size={15} /> {tt('New offer', 'عرض جديد')}</button>}</div>}
    </Card>

    {editing && <PromotionEditor now={now} draft={editing} products={products} categories={categories} onClose={() => setEditing(null)} onSave={save} ar={ar} />}
  </main>;
}

function PromotionEditor({ now, draft: initial, products, categories, onClose, onSave, ar }: { now: number; draft: Draft; products: ProductOption[]; categories: CategoryOption[]; onClose: () => void; onSave: (d: Draft) => Promise<void>; ar: boolean }) {
  const tt = (en: string, arText: string) => ar ? arText : en;
  const [d, setD] = useState<Draft>(initial);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Draft>) => setD(current => ({ ...current, ...patch }));
  const startMs = d.startMode === 'now' ? now : fromLocal(d.start);
  const endMs = fromLocal(d.end);
  const durationHours = (endMs - startMs) / HOUR;
  const value = Number(d.value) || 0;
  const covered = products.filter(p => d.scope === 'all' || (d.scope === 'categories' ? d.categoryIds.includes(p.category) : d.productIds.includes(p.id)));
  const preview = covered.map(p => ({ ...p, sale: value > 0 ? promotionalPrice(p.price, { type: d.type, value }) : p.price })).filter(p => p.sale < p.price);
  const unaffected = covered.length - preview.length;
  const found = products.filter(p => !query || `${p.name} ${p.nameAr} ${p.id}`.toLowerCase().includes(query.toLowerCase()));
  const valid = (d.name.trim() || d.nameAr.trim()) && value > 0 && endMs > startMs && (d.scope !== 'categories' || d.categoryIds.length) && (d.scope !== 'products' || d.productIds.length) && (d.type !== 'percent' || value <= 95);
  async function submit() { setSaving(true); try { await onSave(d); } catch { /* shown by the page */ } finally { setSaving(false); } }
  const toggle = (list: string[], id: string) => list.includes(id) ? list.filter(x => x !== id) : [...list, id];

  return <Modal title={d.id ? tt('Edit offer', 'تعديل العرض') : tt('New offer', 'عرض جديد')} onClose={onClose} wide>
    <div className="promo-editor">
      <section>
        <h3>{tt('1. Name', '1. اسم العرض')}</h3>
        <div className="admin-form-grid">
          <label className="admin-field"><span>{tt('Name — Arabic', 'الاسم — عربي')}</span><input value={d.nameAr} onChange={e => set({ nameAr: e.target.value })} dir="rtl" placeholder="عروض الجمعة البيضاء" /></label>
          <label className="admin-field"><span>{tt('Name — English', 'الاسم — إنكليزي')}</span><input value={d.name} onChange={e => set({ name: e.target.value })} dir="ltr" placeholder="Black Friday" /></label>
        </div>
      </section>

      <section>
        <h3>{tt('2. Discount', '2. نوع الخصم')}</h3>
        <div className="promo-types">{([['percent', tt('Percentage off', 'نسبة مئوية'), '%'], ['amount', tt('Amount off each unit', 'مبلغ من كل قطعة'), 'IQD −'], ['price', tt('Fixed sale price', 'سعر ثابت'), 'IQD =']] as const).map(([key, label, sign]) => <button key={key} type="button" className={d.type === key ? 'active' : ''} onClick={() => set({ type: key })}><b>{sign}</b>{label}</button>)}</div>
        <label className="admin-field promo-value"><span>{d.type === 'percent' ? tt('Percent (1–95)', 'النسبة (1–95)') : d.type === 'amount' ? tt('IQD off each unit', 'المبلغ المخصوم من كل قطعة (د.ع)') : tt('Sale price (IQD)', 'سعر البيع (د.ع)')}</span><input type="number" min="1" max={d.type === 'percent' ? 95 : undefined} step={d.type === 'percent' ? 1 : 250} value={d.value} onChange={e => set({ value: e.target.value })} /></label>
      </section>

      <section>
        <h3>{tt('3. Products', '3. المنتجات المشمولة')}</h3>
        <div className="promo-types small">{([['all', tt('Whole store', 'كل المتجر')], ['categories', tt('Categories', 'أصناف')], ['products', tt('Chosen products', 'منتجات محددة')]] as const).map(([key, label]) => <button key={key} type="button" className={d.scope === key ? 'active' : ''} onClick={() => set({ scope: key })}>{label}</button>)}</div>
        {d.scope === 'categories' && <div className="promo-checks">{categories.map(c => <label key={c.id} className={d.categoryIds.includes(c.id) ? 'on' : ''}><input type="checkbox" checked={d.categoryIds.includes(c.id)} onChange={() => set({ categoryIds: toggle(d.categoryIds, c.id) })} />{ar ? c.nameAr : c.name}<small>{products.filter(p => p.category === c.id).length}</small></label>)}</div>}
        {d.scope === 'products' && <>
          <label className="admin-search promo-search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={tt('Search products…', 'ابحث عن منتج…')} /></label>
          <div className="promo-products">{found.map(p => <label key={p.id} className={d.productIds.includes(p.id) ? 'on' : ''}><input type="checkbox" checked={d.productIds.includes(p.id)} onChange={() => set({ productIds: toggle(d.productIds, p.id) })} />{p.image ? <img src={p.image} alt="" /> : <span className="dash-thumb" />}<span><b>{ar ? p.nameAr : p.name}</b><small>{iqd(p.price)}{!p.published && ` · ${tt('draft', 'مسودة')}`}</small></span></label>)}</div>
          <p className="dash-muted">{tt(`${d.productIds.length} selected`, `${d.productIds.length} منتج مختار`)}</p>
        </>}
      </section>

      <section>
        <h3>{tt('4. When', '4. مدة العرض')}</h3>
        <div className="promo-types small"><button type="button" className={d.startMode === 'now' ? 'active' : ''} onClick={() => set({ startMode: 'now' })}>{tt('Start now', 'يبدي الآن')}</button><button type="button" className={d.startMode === 'later' ? 'active' : ''} onClick={() => set({ startMode: 'later' })}>{tt('Schedule start', 'يبدي بوقت محدد')}</button></div>
        <div className="admin-form-grid">
          {d.startMode === 'later' && <label className="admin-field"><span>{tt('Starts (Baghdad time)', 'يبدي (بتوقيت بغداد)')}</span><input type="datetime-local" value={d.start} onChange={e => set({ start: e.target.value })} /></label>}
          <label className="admin-field"><span>{tt('Ends (Baghdad time)', 'ينتهي (بتوقيت بغداد)')}</span><input type="datetime-local" value={d.end} onChange={e => set({ end: e.target.value })} /></label>
        </div>
        <div className="promo-durations"><span><Timer size={14} /> {tt('Run for', 'المدة')}:</span>{DURATIONS.map(([hours, en, arText]) => <button key={hours} type="button" className={Math.abs(durationHours - hours) < 0.1 ? 'active' : ''} onClick={() => set({ end: toLocal(startMs + hours * HOUR) })}>{ar ? arText : en}</button>)}</div>
        <p className={`promo-summary ${endMs <= startMs ? 'bad' : ''}`}>{endMs <= startMs ? tt('The end must be after the start.', 'لازم النهاية تكون بعد البداية.') : tt(`Runs for ${span(endMs - startMs, false)}, until ${new Date(endMs).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Baghdad' })}.`, `مدة العرض ${span(endMs - startMs, true)}، لغاية ${new Date(endMs).toLocaleString('ar-IQ', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Baghdad' })}.`)}</p>
      </section>

      <section>
        <h3>{tt('5. On the storefront', '5. شكله بالموقع')}</h3>
        <div className="admin-form-grid">
          <label className="admin-field"><span>{tt('Badge — Arabic (optional)', 'الشارة — عربي (اختياري)')}</span><input value={d.badgeAr} onChange={e => set({ badgeAr: e.target.value })} dir="rtl" maxLength={30} placeholder={d.type === 'percent' ? `خصم ${d.value}%` : 'عرض خاص'} /></label>
          <label className="admin-field"><span>{tt('Badge — English (optional)', 'الشارة — إنكليزي (اختياري)')}</span><input value={d.badge} onChange={e => set({ badge: e.target.value })} dir="ltr" maxLength={30} placeholder={d.type === 'percent' ? `${d.value}% off` : 'Special offer'} /></label>
        </div>
        <label className="promo-toggle"><input type="checkbox" checked={d.showCountdown} onChange={e => set({ showCountdown: e.target.checked })} /> {tt('Show a countdown to the end', 'إظهار عدّاد تنازلي لنهاية العرض')}</label>
        <label className="promo-toggle"><input type="checkbox" checked={d.active} onChange={e => set({ active: e.target.checked })} /> {tt('Offer is switched on', 'العرض مفعّل')}</label>
      </section>

      <section className="promo-preview">
        <h3>{tt('Preview', 'معاينة الأسعار')} <small>{tt(`${preview.length} products get a lower price`, `${preview.length} منتج ينزل سعره`)}{unaffected > 0 && tt(` · ${unaffected} unchanged (price already lower)`, ` · ${unaffected} ما يتغير (سعره أقل أصلاً)`)}</small></h3>
        {preview.length ? <ul>{preview.slice(0, 8).map(p => <li key={p.id}>{p.image ? <img src={p.image} alt="" /> : <span className="dash-thumb" />}<span>{ar ? p.nameAr : p.name}</span><s>{iqd(p.price)}</s><b>{iqd(p.sale)}</b><em>−{Math.round((1 - p.sale / p.price) * 100)}%</em></li>)}</ul> : <p className="dash-muted">{tt('No product would get a lower price with these settings.', 'ماكو منتج ينزل سعره بهالإعدادات.')}</p>}
        {preview.length > 8 && <p className="dash-muted">{tt(`+ ${preview.length - 8} more`, `+ ${preview.length - 8} منتج آخر`)}</p>}
      </section>
    </div>
    <div className="admin-modal-actions"><button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}><X size={14} /> {tt('Cancel', 'إلغاء')}</button><button type="button" className="admin-btn admin-btn-primary" disabled={!valid || saving} onClick={() => void submit()}>{saving ? <LoaderCircle size={15} className="spin" /> : <Tag size={15} />} {d.id ? tt('Save offer', 'حفظ العرض') : tt('Create offer', 'إنشاء العرض')}</button></div>
  </Modal>;
}
