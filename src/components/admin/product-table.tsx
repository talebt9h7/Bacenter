'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, GripVertical, LayoutGrid, List, ListOrdered, LoaderCircle, Pencil, Search, X } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { productT } from '@/lib/i18n';
import { stockLevel } from '@/lib/stock-level';

type Row = { id: string; name: string; image: string; category: string; categoryId: string; price: number; published: boolean; stock: number; colors: { id: number; name: string; hex: string; stock: number; photos: number }[] };
type Category = { id: string; name: string; nameAr?: string };
const iqd = (value: number) => `${Math.round(value).toLocaleString('en-US')} IQD`;
const VIEW_KEY = 'ur-admin-products-view';

/**
 * Admin product list: table or grid view, filters by status and category, and a manual-order mode
 * (drag or arrows) that sets the order products appear in on the storefront.
 */
export function ProductTable({ rows, lowStockThreshold, categories }: { rows: Row[]; lowStockThreshold: number; categories: Category[] }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, a: string) => ar ? a : en;
  const tr = (label: keyof typeof import('@/lib/i18n').productTranslations) => productT(label, language);
  const [order, setOrder] = useState(() => rows.map(r => r.id));
  const [sourceRows, setSourceRows] = useState(rows);
  if (sourceRows !== rows) { setSourceRows(rows); setOrder(rows.map(r => r.id)); }
  const byId = useMemo(() => new Map(rows.map(r => [r.id, r])), [rows]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'soldout' | 'draft'>('all');
  const [category, setCategory] = useState('all');
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [sorting, setSorting] = useState(false);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Remembered view, read after mount so the server and first client render match.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { const v = localStorage.getItem(VIEW_KEY); if (v === 'grid' || v === 'table') setView(v); } catch { /* storage unavailable */ } }, []);
  const chooseView = (v: 'table' | 'grid') => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ } };

  const catName = (id: string) => { const c = categories.find(x => x.id === id); return c ? (ar ? c.nameAr || c.name : c.name) : id; };
  const usedCategories = useMemo(() => { const counts = new Map<string, number>(); rows.forEach(r => counts.set(r.categoryId, (counts.get(r.categoryId) ?? 0) + 1)); return [...counts.entries()].sort((a, b) => catName(a[0]).localeCompare(catName(b[0]))); }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const ordered = order.map(id => byId.get(id)).filter((r): r is Row => !!r);
  const visible = ordered.filter(row => {
    if (category !== 'all' && row.categoryId !== category) return false;
    if (sorting) return true;
    const matches = !query || `${row.name} ${row.category} ${row.id} ${row.colors.map(color => color.name).join(' ')}`.toLowerCase().includes(query.toLowerCase());
    if (!matches) return false;
    if (filter === 'low') return row.colors.some(color => stockLevel(color.stock, lowStockThreshold) === 'low');
    if (filter === 'soldout') return row.colors.some(color => stockLevel(color.stock, lowStockThreshold) === 'out');
    if (filter === 'draft') return !row.published;
    return true;
  });

  function persist(next: string[]) {
    setOrder(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSave('saving');
    saveTimer.current = setTimeout(async () => {
      try { const r = await fetch('/api/admin/products/reorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: next }) }); if (!r.ok) throw new Error(); setSave('saved'); }
      catch { setSave('error'); }
    }, 500);
  }
  /** Moves `id` to where `targetId` is, inside the visible (category) subset, keeping other products in place. */
  function moveTo(id: string, targetId: string) {
    if (id === targetId) return;
    const subset = visible.map(r => r.id);
    const from = subset.indexOf(id), to = subset.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const reordered = [...subset]; reordered.splice(from, 1); reordered.splice(to, 0, id);
    const slots = order.map((pid, i) => subset.includes(pid) ? i : -1).filter(i => i >= 0);
    const next = [...order]; slots.forEach((slot, k) => { next[slot] = reordered[k]; });
    persist(next);
  }
  function step(id: string, dir: -1 | 1) { const subset = visible.map(r => r.id); const i = subset.indexOf(id); const j = i + dir; if (j < 0 || j >= subset.length) return; moveTo(id, subset[j]); }

  const dragProps = (row: Row) => sorting ? {
    draggable: true,
    onDragStart: (e: React.DragEvent) => { setDragId(row.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', row.id); },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); if (overId !== row.id) setOverId(row.id); },
    onDragLeave: () => setOverId(o => o === row.id ? null : o),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); const id = dragId ?? e.dataTransfer.getData('text/plain'); if (id) moveTo(id, row.id); setDragId(null); setOverId(null); },
    onDragEnd: () => { setDragId(null); setOverId(null); },
  } : {};
  const dragClass = (row: Row) => `${sorting ? 'is-sortable' : ''} ${dragId === row.id ? 'is-dragging' : ''} ${overId === row.id && dragId !== row.id ? 'is-over' : ''}`;
  const sortControls = (row: Row, index: number) => <div className="ap-sort"><span className="ap-handle" aria-hidden="true"><GripVertical size={16} /></span><b>{index + 1}</b><button type="button" onClick={() => step(row.id, -1)} disabled={index === 0} aria-label={tt('Move up', 'تحريك لفوق')}><ArrowUp size={14} /></button><button type="button" onClick={() => step(row.id, 1)} disabled={index === visible.length - 1} aria-label={tt('Move down', 'تحريك لتحت')}><ArrowDown size={14} /></button></div>;
  const chips = (row: Row) => <div className="admin-color-chips">{row.colors.map(color => <Link key={color.id} href={`/admin/products/${row.id}?color=${color.id}`} className={`admin-chip ${stockLevel(color.stock, lowStockThreshold) === 'out' ? 'danger' : stockLevel(color.stock, lowStockThreshold) === 'low' ? 'warning' : ''}`} title={`${color.name}: ${color.stock} in stock · ${color.photos} photos`}><i style={{ background: color.hex }} />{color.name}<b>{color.stock}</b></Link>)}</div>;
  const status = (row: Row) => row.published ? <span className="admin-badge success">{tr('Live')}</span> : <span className="admin-badge muted">{tr('Draft')}</span>;

  return <section className="admin-card ap-card">
    <div className="admin-toolbar ap-toolbar">
      {!sorting && <label className="admin-search"><Search size={16} /><input placeholder={tr('Search products or colors…')} value={query} onChange={event => setQuery(event.target.value)} aria-label={tr('Search products')} /></label>}
      <select className="ap-select" value={category} onChange={e => setCategory(e.target.value)} aria-label={tt('Category', 'القسم')}>
        <option value="all">{tt(`All categories (${rows.length})`, `كل الأقسام (${rows.length})`)}</option>
        {usedCategories.map(([id, n]) => <option key={id} value={id}>{catName(id)} ({n})</option>)}
      </select>
      {!sorting && <div className="admin-segmented" role="tablist">{([['all', 'All'], ['low', 'Low stock'], ['soldout', 'Sold out'], ['draft', 'Drafts']] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={filter === key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{tr(label as keyof typeof import('@/lib/i18n').productTranslations)}</button>)}</div>}
      <div className="ap-tools">
        <div className="admin-segmented ap-view" role="group" aria-label={tt('View', 'طريقة العرض')}>
          <button type="button" className={view === 'table' ? 'active' : ''} onClick={() => chooseView('table')} aria-label={tt('Table', 'جدول')} title={tt('Table', 'جدول')}><List size={15} /></button>
          <button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => chooseView('grid')} aria-label={tt('Grid', 'شبكة')} title={tt('Grid', 'شبكة')}><LayoutGrid size={15} /></button>
        </div>
        <button type="button" className={`admin-btn admin-btn-sm ${sorting ? 'admin-btn-primary' : 'admin-btn-ghost'}`} onClick={() => { setSorting(s => !s); setSave('idle'); }}>{sorting ? <><Check size={14} /> {tt('Done', 'تم')}</> : <><ListOrdered size={14} /> {tt('Arrange order', 'ترتيب يدوي')}</>}</button>
        <span className="admin-count">{visible.length} / {rows.length}</span>
      </div>
    </div>
    {sorting && <div className="ap-sort-note"><span>{category === 'all' ? tt('Drag products, or use the arrows, to set the order they appear in the store.', 'اسحب المنتجات أو استخدم الأسهم حتى ترتب ظهورها بالمتجر.') : tt(`Arranging inside “${catName(category)}”. Other products keep their places.`, `ترتيب داخل قسم «${catName(category)}». باقي المنتجات تبقى بمكانها.`)}</span><em className={`ap-save ${save}`}>{save === 'saving' ? <><LoaderCircle size={13} className="spin" /> {tt('Saving…', 'جارٍ الحفظ…')}</> : save === 'saved' ? <><Check size={13} /> {tt('Saved', 'انحفظ')}</> : save === 'error' ? <><X size={13} /> {tt('Not saved, try again', 'ما انحفظ، حاول مرة ثانية')}</> : null}</em></div>}

    {view === 'table' ? <div className="admin-table-wrap"><table className="admin-table admin-products-table"><thead><tr>{sorting && <th>{tt('Order', 'الترتيب')}</th>}<th>{tr('Product')}</th><th>{tr('Category')}</th><th className="num">{tr('Price')}</th><th>{tr('Colors & stock')}</th><th className="num">{tr('Total stock')}</th><th>{tr('Status')}</th><th /></tr></thead><tbody>
      {visible.map((row, index) => <tr key={row.id} className={dragClass(row)} {...dragProps(row)}>
        {sorting && <td>{sortControls(row, index)}</td>}
        <td><Link href={`/admin/products/${row.id}`} className="admin-product-cell" draggable={false}><img src={row.image} alt="" draggable={false} /><div><strong>{row.name}</strong><small>/{row.id}</small></div></Link></td>
        <td>{catName(row.categoryId)}</td><td className="num">{iqd(row.price)}</td><td>{chips(row)}</td><td className="num"><strong>{row.stock}</strong></td><td>{status(row)}</td>
        <td className="num"><Link href={`/admin/products/${row.id}`} className="admin-btn admin-btn-ghost admin-btn-sm"><Pencil size={14} /> {tr('Edit')}</Link></td>
      </tr>)}
      {!visible.length && <tr><td colSpan={sorting ? 8 : 7}><p className="admin-empty">{tr('No products match that filter.')}</p></td></tr>}
    </tbody></table></div>
    : <div className="ap-grid">
      {visible.map((row, index) => <article key={row.id} className={`ap-tile ${dragClass(row)}`} {...dragProps(row)}>
        {sorting && sortControls(row, index)}
        <Link href={`/admin/products/${row.id}`} className="ap-tile-img" draggable={false}><img src={row.image} alt="" draggable={false} />{!row.published && <span className="ap-tile-draft">{tr('Draft')}</span>}</Link>
        <div className="ap-tile-body">
          <Link href={`/admin/products/${row.id}`} className="ap-tile-name" draggable={false}>{row.name}</Link>
          <small>{catName(row.categoryId)}</small>
          <div className="ap-tile-row"><b>{iqd(row.price)}</b><span className={`ap-stock ${row.stock <= 0 ? 'out' : ''}`}>{row.stock} {tt('in stock', 'بالمخزون')}</span></div>
          <div className="ap-dots">{row.colors.map(c => <Link key={c.id} href={`/admin/products/${row.id}?color=${c.id}`} title={`${c.name}: ${c.stock}`} className={stockLevel(c.stock, lowStockThreshold)} style={{ background: c.hex }} draggable={false} />)}</div>
        </div>
      </article>)}
      {!visible.length && <p className="admin-empty">{tr('No products match that filter.')}</p>}
    </div>}
  </section>;
}
