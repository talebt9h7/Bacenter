'use client';

import { useMemo, useState } from 'react';
import { Boxes, Eye, EyeOff, LoaderCircle, Minus, Package, Pencil, Plus, Search, Tag, Trash2, X } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { BundleView } from '@/lib/bundles';
import type { VariantOption } from '@/lib/admin-catalog';
import { api, ImageField, Modal, useFlash } from './ui';
import { Card, Kpi, PageHero, iqd } from './dash-ui';

type Draft = { id?: number; name: string; nameAr: string; description: string; descriptionAr: string; image: string; priceIqd: string; items: { variantId: number; quantity: number }[]; active: boolean; sortOrder: number };
const blank = (): Draft => ({ name: '', nameAr: '', description: '', descriptionAr: '', image: '', priceIqd: '', items: [], active: true, sortOrder: 0 });
const thumb = (url: string | null) => url ? (url.startsWith('/api/media/') ? `${url}?w=160` : url) : '/images/placeholder.svg';

/** Admin → Bundles: pick product colours, set one price; stock is taken from each item when sold. */
export function BundlesManager({ initial, catalog, sold }: { initial: BundleView[]; catalog: VariantOption[]; sold: Record<number, { orders: number; revenue: number }> }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, a: string) => ar ? a : en;
  const lang = ar ? 'ar' : 'en';
  const [rows, setRows] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { flash, success, fail } = useFlash();
  const live = rows.filter(b => b.active && b.available > 0).length;
  const totalSold = Object.values(sold).reduce((s, v) => s + v.orders, 0);
  const revenue = Object.values(sold).reduce((s, v) => s + v.revenue, 0);

  async function save(d: Draft) {
    setBusy('save');
    try {
      const body = { ...d, priceIqd: Number(d.priceIqd) };
      const data = d.id ? await api<{ items: BundleView[] }>(`/api/admin/bundles/${d.id}`, { method: 'PUT', json: body }) : await api<{ items: BundleView[] }>('/api/admin/bundles', { method: 'POST', json: body });
      setRows(data.items); setDraft(null); success(tt('Bundle saved.', 'انحفظ البكج.'));
    } catch (e) { fail(e); } finally { setBusy(null); }
  }
  async function toggle(b: BundleView) {
    setBusy(`t${b.id}`);
    try { const data = await api<{ items: BundleView[] }>(`/api/admin/bundles/${b.id}`, { method: 'PUT', json: { ...b, items: b.parts.map(p => ({ variantId: p.variantId, quantity: p.quantity })), active: !b.active } }); setRows(data.items); }
    catch (e) { fail(e); } finally { setBusy(null); }
  }
  async function remove(b: BundleView) {
    if (!confirm(tt(`Delete “${b.name}”? Orders already placed keep their lines.`, `تمسح "${b.nameAr || b.name}"؟ الطلبات القديمة تبقى مثل ما هي.`))) return;
    setBusy(`d${b.id}`);
    try { const data = await api<{ items: BundleView[] }>(`/api/admin/bundles/${b.id}`, { method: 'DELETE' }); setRows(data.items); success(tt('Deleted.', 'انمسح.')); }
    catch (e) { fail(e); } finally { setBusy(null); }
  }

  return <main className="admin-page dash">
    {flash}
    <PageHero eyebrow={tt('Sales', 'المبيعات')} title={tt('Bundles', 'البكجات')} description={tt('Sell two or more items together at one price — e.g. a phone case with a wallet. Stock is taken from every item in the bundle when it is sold.', 'بيع قطعتين أو أكثر سوا بسعر واحد، مثلاً كفر ويا محفظة. لما ينباع البكج ينقص المخزون من كل قطعة بيه.')} actions={<button type="button" className="admin-btn admin-btn-primary" onClick={() => setDraft(blank())}><Plus size={15} /> {tt('New bundle', 'بكج جديد')}</button>} />
    <section className="dash-kpis" data-cols="4">
      <Kpi lang={lang} icon={<Boxes size={17} />} tone="accent" label={tt('Bundles', 'البكجات')} value={rows.length} />
      <Kpi lang={lang} delay={50} icon={<Eye size={17} />} tone="success" label={tt('On sale now', 'معروضة هسه')} value={live} note={tt('active and in stock', 'فعالة وبيها مخزون')} />
      <Kpi lang={lang} delay={100} icon={<Package size={17} />} tone="blue" label={tt('Orders with a bundle', 'طلبات بيها بكج')} value={totalSold} />
      <Kpi lang={lang} delay={150} icon={<Tag size={17} />} tone="gold" label={tt('Bundle sales', 'مبيعات البكجات')} value={revenue} format={iqd} note={tt('excl. cancelled & returned', 'بدون الملغية والمرتجعة')} />
    </section>
    <Card title={tt('All bundles', 'كل البكجات')} icon={<Boxes size={16} />}>
      {!rows.length ? <p className="admin-empty">{tt('No bundles yet. Create one: choose the items, set a price, done.', 'ماكو بكجات بعد. سوّ واحد: اختار القطع، حط السعر، وخلصت.')}</p> :
        <div className="bundle-admin-list">{rows.map(b => <article key={b.id} className={`bundle-admin-row ${b.active ? '' : 'is-off'}`}>
          <div className="bundle-admin-thumbs">{b.parts.slice(0, 3).map(p => <img key={p.variantId} src={thumb(p.image)} alt="" />)}</div>
          <div className="bundle-admin-main">
            <strong>{ar ? b.nameAr || b.name : b.name}</strong>
            <small>{b.parts.map(p => `${p.quantity > 1 ? `${p.quantity}× ` : ''}${ar ? p.nameAr || p.name : p.name} · ${ar ? p.colorAr || p.color : p.color}`).join(' + ')}</small>
            <div className="bundle-admin-tags">
              <span className={`admin-badge ${b.active ? (b.available > 0 ? 'success' : 'warning') : 'muted'}`}>{!b.active ? tt('Hidden', 'مخفي') : b.available > 0 ? tt(`${b.available} available`, `متوفر ${b.available}`) : tt('Out of stock', 'نافد')}</span>
              {sold[b.id] && <span className="admin-badge info">{tt(`${sold[b.id].orders} orders`, `${sold[b.id].orders} طلب`)}</span>}
            </div>
          </div>
          <div className="bundle-admin-price"><b>{iqd(b.priceIqd)}</b>{b.savingIqd > 0 && <><s>{iqd(b.regularIqd)}</s><em>{tt(`saves ${iqd(b.savingIqd)}`, `توفير ${iqd(b.savingIqd)}`)}</em></>}</div>
          <div className="bundle-admin-actions">
            <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setDraft({ id: b.id, name: b.name, nameAr: b.nameAr, description: b.description, descriptionAr: b.descriptionAr, image: b.image && !b.parts.some(p => p.image === b.image) ? b.image : '', priceIqd: String(b.priceIqd), items: b.parts.map(p => ({ variantId: p.variantId, quantity: p.quantity })), active: b.active, sortOrder: b.sortOrder })}><Pencil size={13} /> {tt('Edit', 'تعديل')}</button>
            <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" disabled={busy !== null} onClick={() => void toggle(b)}>{busy === `t${b.id}` ? <LoaderCircle size={13} className="spin" /> : b.active ? <EyeOff size={13} /> : <Eye size={13} />} {b.active ? tt('Hide', 'إخفاء') : tt('Show', 'إظهار')}</button>
            <button type="button" className="admin-btn admin-btn-danger-ghost admin-btn-sm" disabled={busy !== null} onClick={() => void remove(b)}><Trash2 size={13} /></button>
          </div>
        </article>)}</div>}
    </Card>
    {draft && <BundleEditor draft={draft} catalog={catalog} busy={busy === 'save'} onClose={() => setDraft(null)} onSave={d => void save(d)} />}
  </main>;
}

function BundleEditor({ draft, catalog, busy, onClose, onSave }: { draft: Draft; catalog: VariantOption[]; busy: boolean; onClose: () => void; onSave: (d: Draft) => void }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, a: string) => ar ? a : en;
  const [d, setD] = useState(draft);
  const [q, setQ] = useState('');
  const set = (patch: Partial<Draft>) => setD(cur => ({ ...cur, ...patch }));
  const byId = useMemo(() => new Map(catalog.map(v => [v.variantId, v])), [catalog]);
  const chosen = d.items.map(i => ({ ...i, v: byId.get(i.variantId) })).filter(i => i.v);
  const regular = chosen.reduce((s, i) => s + (i.v!.salePriceIqd * i.quantity), 0);
  const price = Number(d.priceIqd) || 0;
  const available = chosen.length ? Math.min(...chosen.map(i => Math.floor(i.v!.available / i.quantity))) : 0;
  const results = catalog.filter(v => !q || `${v.productName} ${v.productNameAr} ${v.color} ${v.colorAr}`.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
  const add = (variantId: number) => set({ items: d.items.some(i => i.variantId === variantId) ? d.items.map(i => i.variantId === variantId ? { ...i, quantity: Math.min(10, i.quantity + 1) } : i) : [...d.items, { variantId, quantity: 1 }] });
  const qty = (variantId: number, delta: number) => set({ items: d.items.map(i => i.variantId === variantId ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0) });
  const valid = (d.name || d.nameAr) && price > 0 && (d.items.length >= 2 || d.items.some(i => i.quantity > 1));
  return <Modal title={d.id ? tt('Edit bundle', 'تعديل البكج') : tt('New bundle', 'بكج جديد')} onClose={onClose} wide>
    <div className="bundle-editor">
      <section>
        <h3 className="pce-title">{tt('1. Items in the bundle', '1. القطع داخل البكج')}</h3>
        <label className="admin-search"><Search size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder={tt('Search products or colours…', 'ابحث عن منتج أو لون…')} /></label>
        <div className="bundle-pick">{results.map(v => <button type="button" key={v.variantId} onClick={() => add(v.variantId)} className={d.items.some(i => i.variantId === v.variantId) ? 'on' : ''} disabled={!v.published}>
          <img src={thumb(v.image)} alt="" /><span><b>{ar ? v.productNameAr || v.productName : v.productName}</b><small><i style={{ background: v.hex }} /> {ar ? v.colorAr || v.color : v.color} · {iqd(v.salePriceIqd)} · {tt(`${v.available} left`, `باقي ${v.available}`)}</small></span><Plus size={14} />
        </button>)}</div>
      </section>
      <section>
        <h3 className="pce-title">{tt('2. Your bundle', '2. البكج مالتك')}</h3>
        {!chosen.length ? <p className="admin-hint">{tt('Tap items on the left to add them.', 'اضغط على القطع حتى تضيفها.')}</p> : <ul className="bundle-chosen">{chosen.map(i => <li key={i.variantId}>
          <img src={thumb(i.v!.image)} alt="" /><span><b>{ar ? i.v!.productNameAr || i.v!.productName : i.v!.productName}</b><small>{ar ? i.v!.colorAr || i.v!.color : i.v!.color} · {iqd(i.v!.salePriceIqd)}</small></span>
          <div className="bundle-qty"><button type="button" onClick={() => qty(i.variantId, -1)}><Minus size={12} /></button><b>{i.quantity}</b><button type="button" onClick={() => qty(i.variantId, 1)} disabled={i.quantity >= 10}><Plus size={12} /></button></div>
        </li>)}</ul>}
        <div className="bundle-sum">
          <div><span>{tt('Regular price of the items', 'سعر القطع بشكل منفصل')}</span><b>{iqd(regular)}</b></div>
          <label className="admin-field"><span>{tt('Bundle price (IQD)', 'سعر البكج (دينار)')}</span><input type="number" min="0" step="250" value={d.priceIqd} onChange={e => set({ priceIqd: e.target.value })} placeholder={String(Math.round(regular * 0.85 / 250) * 250 || '')} /></label>
          {price > 0 && regular > 0 && <div className={price < regular ? 'good' : 'warn'}><span>{price < regular ? tt('Customer saves', 'الزبون يوفّر') : tt('Bundle costs more than the items alone', 'البكج أغلى من القطع لوحدها')}</span><b>{price < regular ? `${iqd(regular - price)} (${Math.round((1 - price / regular) * 100)}%)` : iqd(price - regular)}</b></div>}
          <div><span>{tt('Bundles you can sell now', 'عدد البكجات الممكن بيعها هسه')}</span><b>{available}</b></div>
        </div>
        <h3 className="pce-title">{tt('3. Name & photo', '3. الاسم والصورة')}</h3>
        <div className="pce-pair">
          <label className="admin-field"><span>العربية</span><input dir="rtl" value={d.nameAr} onChange={e => set({ nameAr: e.target.value })} placeholder="بكج الكفر والمحفظة" /></label>
          <label className="admin-field"><span>English</span><input dir="ltr" value={d.name} onChange={e => set({ name: e.target.value })} placeholder="Case + wallet set" /></label>
          <label className="admin-field"><span>{tt('Short description (Arabic)', 'وصف قصير (عربي)')}</span><textarea dir="rtl" rows={2} value={d.descriptionAr} onChange={e => set({ descriptionAr: e.target.value })} placeholder="هدية كاملة بجلد طبيعي…" /></label>
          <label className="admin-field"><span>{tt('Short description (English)', 'وصف قصير (إنكليزي)')}</span><textarea dir="ltr" rows={2} value={d.description} onChange={e => set({ description: e.target.value })} /></label>
        </div>
        <ImageField label={tt('Bundle photo (optional — otherwise the item photos are shown)', 'صورة البكج (اختياري — إذا ما حطيت تظهر صور القطع)')} value={d.image} onChange={image => set({ image })} />
        <label className="admin-check" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}><input type="checkbox" checked={d.active} onChange={e => set({ active: e.target.checked })} /> {tt('Show in the store', 'إظهاره بالمتجر')}</label>
      </section>
    </div>
    <div className="admin-modal-actions"><button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}><X size={14} /> {tt('Cancel', 'إلغاء')}</button><button type="button" className="admin-btn admin-btn-primary" disabled={!valid || busy} onClick={() => onSave(d)}>{busy ? <LoaderCircle size={14} className="spin" /> : null} {tt('Save bundle', 'حفظ البكج')}</button></div>
  </Modal>;
}
