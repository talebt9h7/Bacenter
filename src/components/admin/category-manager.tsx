'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ExternalLink, GripVertical, ImageIcon, LayoutGrid, Pin, Plus, Search, Trash2, X } from 'lucide-react';
import { api, ImageField, useFlash } from '@/components/admin/ui';
import { useLanguage } from '@/components/language-provider';

type Row = {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  image: string | null;
  active: boolean;
  sortOrder: number;
  productCount?: number;
  liveCount?: number;
  cover?: string;
  // Page heading and banner (Admin → Categories → page)
  eyebrow?: string; eyebrowAr?: string; headline?: string; headlineAr?: string;
  bannerActive?: boolean; bannerImage?: string; bannerMobileImage?: string;
  bannerTitle?: string; bannerTitleAr?: string; bannerSubtitle?: string; bannerSubtitleAr?: string;
  bannerCta?: string; bannerCtaAr?: string; bannerHref?: string;
};
type Filter = 'all' | 'visible' | 'hidden' | 'empty';

const slugify = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Categories, laid out like an iOS / macOS settings list: drag (or use the arrows) to set the
 * storefront order, flip the switch to show or hide, tap a row to edit it in a side sheet.
 */
export function CategoryManager({ initial, shopAll: initialShopAll = null }: { initial: Row[]; shopAll?: Row | null }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const L = (a: string, e: string) => (ar ? a : e);
  const { flash, success, fail } = useFlash();
  const [rows, setRows] = useState(() => [...initial].sort((a, b) => a.sortOrder - b.sortOrder));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<(Row & { isNew?: boolean }) | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [shopAll, setShopAll] = useState<Row | null>(initialShopAll);

  const counts = useMemo(() => ({
    all: rows.length,
    visible: rows.filter(r => r.active).length,
    hidden: rows.filter(r => !r.active).length,
    empty: rows.filter(r => !r.productCount).length,
  }), [rows]);

  const q = query.trim().toLowerCase();
  const shown = rows.filter(r => {
    if (filter === 'visible' && !r.active) return false;
    if (filter === 'hidden' && r.active) return false;
    if (filter === 'empty' && r.productCount) return false;
    return !q || [r.name, r.nameAr, r.id, r.description, r.descriptionAr].some(x => x?.toLowerCase().includes(q));
  });
  // Reordering only makes sense on the full, unfiltered list.
  const canReorder = filter === 'all' && !q;

  async function persistOrder(next: Row[]) {
    const previous = rows;
    setRows(next.map((r, i) => ({ ...r, sortOrder: i * 10 })));
    setSavingOrder(true);
    try { await api('/api/admin/categories', { method: 'PATCH', json: { order: next.map(r => r.id) } }); success(L('انحفظ الترتيب', 'Order saved')); }
    catch (e) { setRows(previous); fail(e); }
    finally { setSavingOrder(false); }
  }
  function move(id: string, delta: number) {
    const i = rows.findIndex(r => r.id === id); const j = i + delta;
    if (i < 0 || j < 0 || j >= rows.length) return;
    const next = [...rows]; [next[i], next[j]] = [next[j], next[i]];
    void persistOrder(next);
  }
  function drop(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const next = rows.filter(r => r.id !== dragId);
    const at = next.findIndex(r => r.id === targetId);
    const from = rows.findIndex(r => r.id === dragId), to = rows.findIndex(r => r.id === targetId);
    next.splice(from < to ? at + 1 : at, 0, rows.find(r => r.id === dragId)!);
    setDragId(null); setOverId(null);
    void persistOrder(next);
  }

  async function toggle(row: Row) {
    if (row.id === 'all') {
      setShopAll(r => (r ? { ...r, active: !r.active } : r));
      try { await api('/api/admin/categories', { method: 'PUT', json: { ...row, active: !row.active } }); }
      catch (e) { setShopAll(r => (r ? { ...r, active: row.active } : r)); fail(e); }
      return;
    }
    setRows(list => list.map(r => (r.id === row.id ? { ...r, active: !r.active } : r)));
    try { await api('/api/admin/categories', { method: 'PUT', json: { ...row, active: !row.active } }); }
    catch (e) { setRows(list => list.map(r => (r.id === row.id ? { ...r, active: row.active } : r))); fail(e); }
  }

  function startNew() {
    setEditing({ id: '', name: '', nameAr: '', description: '', descriptionAr: '', image: '', active: true, sortOrder: rows.length * 10, isNew: true });
  }

  async function save(draft: Row & { isNew?: boolean }) {
    const data = await api<{ category: Row }>('/api/admin/categories', { method: draft.isNew ? 'POST' : 'PUT', json: { ...draft, image: draft.image || '' } });
    const saved = { ...data.category, productCount: draft.productCount ?? 0, liveCount: draft.liveCount ?? 0, cover: draft.cover };
    if (saved.id === 'all') setShopAll(saved);
    else setRows(list => (draft.isNew ? [...list, saved] : list.map(r => (r.id === saved.id ? saved : r))));
    setEditing(null);
    success(draft.isNew ? L('انضاف التصنيف', 'Category added') : L('انحفظت التعديلات', 'Changes saved'));
  }

  async function remove(row: Row) {
    if (!confirm(L(`حذف تصنيف "${row.nameAr || row.name}"؟`, `Delete "${row.name}"?`))) return;
    await api('/api/admin/categories', { method: 'DELETE', json: { id: row.id } });
    setRows(list => list.filter(r => r.id !== row.id));
    setEditing(null);
    success(L('انحذف التصنيف', 'Category deleted'));
  }

  const filters: [Filter, string][] = [['all', L('الكل', 'All')], ['visible', L('ظاهرة', 'Visible')], ['hidden', L('مخفية', 'Hidden')], ['empty', L('بدون منتجات', 'Empty')]];
  const Chevron = ar ? ChevronLeft : ChevronRight;

  return <section className="cat-manager">
    {flash}
    <div className="cat-toolbar">
      <label className="cat-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={L('ابحث بالاسم أو الرابط…', 'Search by name or slug…')} />{query && <button type="button" aria-label={L('مسح', 'Clear')} onClick={() => setQuery('')}><X size={14} /></button>}</label>
      <div className="cat-segmented" role="tablist">{filters.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'on' : ''} onClick={() => setFilter(key)}>{label}<span>{counts[key]}</span></button>)}</div>
      <button type="button" className="admin-btn admin-btn-primary cat-add" onClick={startNew}><Plus size={16} />{L('تصنيف جديد', 'New category')}</button>
    </div>

    {canReorder && rows.length > 1 && <p className="cat-tip">{savingOrder ? L('جارٍ حفظ الترتيب…', 'Saving order…') : L('اسحب من المقبض لتغيير ترتيب الأقسام بالمتجر.', 'Drag a row by its handle to change the storefront order.')}</p>}

    {shopAll && !q && filter === 'all' && <ul className="cat-list cat-list-pinned">
      <li className={`cat-row${shopAll.active ? '' : ' is-hidden'}`}>
        <span className="cat-handle cat-pin" aria-hidden="true"><Pin size={14} /></span>
        <button type="button" className="cat-open" onClick={() => setEditing(shopAll)} aria-label={L('تعديل صفحة الكل', 'Edit the Shop all page')}>
          <span className="cat-thumb cat-thumb-all">{shopAll.bannerActive && shopAll.bannerImage ? <img src={shopAll.bannerImage} alt="" /> : <LayoutGrid size={20} />}</span>
          <span className="cat-text">
            <strong>{ar ? shopAll.nameAr || 'تسوق الكل' : shopAll.name || 'Shop all'}</strong>
            <small data-raw>{L('كل المنتجات بصفحة وحدة · ثابت بأول القائمة', 'Every product on one page · always first')}</small>
          </span>
          {shopAll.bannerActive && shopAll.bannerImage && <span className="cat-tag">{L('بانر', 'Banner')}</span>}
          <span className="cat-count">{L(`${shopAll.productCount ?? 0} منتج`, `${shopAll.productCount ?? 0} products`)}</span>
        </button>
        <label className="cat-switch" title={L('إظهار زر الكل بالمتجر', 'Show the Shop all pill')}>
          <input type="checkbox" checked={shopAll.active} onChange={() => void toggle(shopAll)} aria-label={L('إظهار الكل بالمتجر', 'Show Shop all in store')} /><span />
        </label>
        {(ar ? <ChevronLeft size={16} className="cat-chevron" aria-hidden="true" /> : <ChevronRight size={16} className="cat-chevron" aria-hidden="true" />)}
      </li>
    </ul>}

    {shown.length === 0 ? <div className="cat-empty"><ImageIcon size={28} /><h3>{rows.length ? L('ماكو نتائج', 'No matches') : L('بعد ماكو تصنيفات', 'No categories yet')}</h3><p>{rows.length ? L('جرّب كلمة ثانية أو بدّل الفلتر.', 'Try another word or filter.') : L('أضف أول تصنيف حتى تقدر تربط المنتجات بيه.', 'Add your first category to start grouping products.')}</p>{!rows.length && <button type="button" className="admin-btn admin-btn-primary" onClick={startNew}><Plus size={16} />{L('تصنيف جديد', 'New category')}</button>}</div>
      : <ul className="cat-list">
        {shown.map((row, index) => {
          const thumb = row.image || row.cover;
          const title = ar ? row.nameAr || row.name : row.name;
          const subtitle = ar ? row.name : row.nameAr;
          return <li key={row.id}
            className={`cat-row${row.active ? '' : ' is-hidden'}${dragId === row.id ? ' is-dragging' : ''}${overId === row.id && dragId !== row.id ? ' is-over' : ''}`}
            draggable={canReorder}
            onDragStart={e => { if (!canReorder) return; setDragId(row.id); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={e => { if (!dragId) return; e.preventDefault(); setOverId(row.id); }}
            onDragEnd={() => { setDragId(null); setOverId(null); }}
            onDrop={e => { e.preventDefault(); drop(row.id); }}>
            {canReorder && <span className="cat-handle" aria-hidden="true"><GripVertical size={16} /></span>}
            <button type="button" className="cat-open" onClick={() => setEditing(row)} aria-label={L(`تعديل ${title}`, `Edit ${title}`)}>
              <span className="cat-thumb">{thumb ? <img src={thumb} alt="" loading="lazy" /> : <ImageIcon size={18} />}</span>
              <span className="cat-text">
                <strong>{title}</strong>
                <small data-raw>{subtitle && subtitle !== title ? `${subtitle} · ` : ''}<span dir="ltr">/{row.id}</span></small>
              </span>
              {row.bannerActive && row.bannerImage && <span className="cat-tag">{L('بانر', 'Banner')}</span>}
              <span className={`cat-count${row.productCount ? '' : ' zero'}`}>{row.productCount ? L(`${row.productCount} منتج`, `${row.productCount} product${row.productCount === 1 ? "" : "s"}`) : L('فارغ', 'Empty')}</span>
            </button>
            {canReorder && <span className="cat-move">
              <button type="button" aria-label={L('تقديم', 'Move up')} disabled={index === 0 || savingOrder} onClick={() => move(row.id, -1)}><ChevronUp size={15} /></button>
              <button type="button" aria-label={L('تأخير', 'Move down')} disabled={index === shown.length - 1 || savingOrder} onClick={() => move(row.id, 1)}><ChevronDown size={15} /></button>
            </span>}
            <label className="cat-switch" title={row.active ? L('ظاهر بالمتجر', 'Visible in store') : L('مخفي', 'Hidden')}>
              <input type="checkbox" checked={row.active} onChange={() => void toggle(row)} aria-label={L('ظهور بالمتجر', 'Show in store')} /><span />
            </label>
            <Chevron size={16} className="cat-chevron" aria-hidden="true" />
          </li>;
        })}
      </ul>}

    {editing && <CategorySheet key={editing.id || 'new'} draft={editing} ar={ar} onClose={() => setEditing(null)} onSave={save} onDelete={remove} />}
  </section>;
}

function CategorySheet({ draft, ar, onClose, onSave, onDelete }: { draft: Row & { isNew?: boolean }; ar: boolean; onClose: () => void; onSave: (r: Row & { isNew?: boolean }) => Promise<void>; onDelete: (r: Row) => Promise<void> }) {
  const L = (a: string, e: string) => (ar ? a : e);
  const [form, setForm] = useState(draft);
  const [slugTouched, setSlugTouched] = useState(!draft.isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const first = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Row>) => setForm(f => ({ ...f, ...patch }));

  useEffect(() => {
    const frame = requestAnimationFrame(() => first.current?.focus());
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  const isAll = form.id === 'all';
  const slug = form.isNew ? (slugTouched ? slugify(form.id) : slugify(form.name)) : form.id;
  const thumb = form.image || form.cover;
  const valid = !!form.name.trim() && !!form.nameAr.trim() && (isAll || (!!slug && slug !== 'all'));

  async function submit() {
    if (!valid) { setError(L('اكتب الاسم بالعربي والإنكليزي.', 'Enter both the Arabic and English name.')); return; }
    setBusy(true); setError('');
    try { await onSave({ ...form, id: slug }); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }
  }
  async function del() {
    setBusy(true); setError('');
    try { await onDelete(form); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }
  }

  return <div className="sheet-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <aside className="sheet" role="dialog" aria-modal="true" aria-label={form.isNew ? L('تصنيف جديد', 'New category') : L('تعديل التصنيف', 'Edit category')}>
      <header className="sheet-head">
        <button type="button" className="sheet-text-btn" onClick={onClose}>{L('إلغاء', 'Cancel')}</button>
        <h2>{form.isNew ? L('تصنيف جديد', 'New category') : isAll ? L('صفحة الكل', 'Shop all page') : L('تعديل التصنيف', 'Edit category')}</h2>
        <button type="button" className="sheet-text-btn strong" onClick={() => void submit()} disabled={busy || !valid}>{busy ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ', 'Save')}</button>
      </header>

      <div className="sheet-body">
        <div className="sheet-preview">
          <span className="sheet-preview-img">{thumb ? <img src={thumb} alt="" /> : <ImageIcon size={26} />}</span>
          <div><strong>{(ar ? form.nameAr : form.name) || L('اسم التصنيف', 'Category name')}</strong><small dir="ltr">ur-leather.shop/products/category/{slug || '…'}</small></div>
        </div>

        <div className="sheet-group">
          <h3>{L('الاسم', 'Name')}</h3>
          <div className="sheet-fields">
            <label><span>{L('بالعربي', 'Arabic')}</span><input ref={ar ? first : undefined} dir="rtl" value={form.nameAr} onChange={e => set({ nameAr: e.target.value })} placeholder="مثال: حقائب الظهر" /></label>
            <label><span>{L('بالإنكليزي', 'English')}</span><input ref={ar ? undefined : first} dir="ltr" value={form.name} onChange={e => set({ name: e.target.value })} placeholder="e.g. Backpacks" /></label>
            {!isAll && <label><span>{L('الرابط', 'Slug')}</span><input dir="ltr" value={slug} disabled={!form.isNew} onChange={e => { setSlugTouched(true); set({ id: e.target.value }); }} placeholder="backpacks" /></label>}
          </div>
          <p className="sheet-note">{isAll ? L('هذا اسم زر "الكل" بشريط الأقسام فوق المنتجات.', 'This is the label of the "Shop all" pill above the products.') : !form.isNew ? L('هذا الاسم يظهر بشريط الأقسام. الرابط ما يتغيّر بعد الإنشاء حتى ما تنكسر الروابط القديمة.', 'Shown in the category bar. The slug is fixed after creation so old links keep working.') : L('هذا الاسم يظهر بشريط الأقسام فوق المنتجات.', 'Shown in the category bar above the products.')}</p>
        </div>

        <div className="sheet-group">
          <h3>{L('رأس الصفحة', 'Page heading')}</h3>
          <div className="sheet-fields">
            <label><span>{L('سطر صغير', 'Eyebrow · AR')}</span><input dir="rtl" value={form.eyebrowAr ?? ''} onChange={e => set({ eyebrowAr: e.target.value })} placeholder="تصميم مدروس. صُنع لأجلك." /></label>
            <label><span>{L('بالإنكليزي', 'Eyebrow · EN')}</span><input dir="ltr" value={form.eyebrow ?? ''} onChange={e => set({ eyebrow: e.target.value })} placeholder="Thoughtfully designed. Made for you." /></label>
            <label><span>{L('العنوان', 'Headline · AR')}</span><input dir="rtl" value={form.headlineAr ?? ''} onChange={e => set({ headlineAr: e.target.value })} placeholder={form.nameAr || 'عنوان الصفحة'} /></label>
            <label><span>{L('بالإنكليزي', 'Headline · EN')}</span><input dir="ltr" value={form.headline ?? ''} onChange={e => set({ headline: e.target.value })} placeholder={form.name || 'Page headline'} /></label>
            <label className="tall"><span>{L('الوصف', 'Description · AR')}</span><textarea dir="rtl" rows={3} value={form.descriptionAr} onChange={e => set({ descriptionAr: e.target.value })} placeholder="سطر أو سطرين يوصفون القسم" /></label>
            <label className="tall"><span>{L('بالإنكليزي', 'Description · EN')}</span><textarea dir="ltr" rows={3} value={form.description} onChange={e => set({ description: e.target.value })} placeholder="A line or two about this category" /></label>
          </div>
          <p className="sheet-note">{L('يظهر فوق المنتجات بصفحة القسم. إذا تركت العنوان فارغ ينعرض اسم القسم.', 'Shown above the products. An empty headline uses the category name.')}</p>
        </div>

        <div className="sheet-group">
          <h3>{L('بانر القسم', 'Category banner')}</h3>
          <div className="sheet-fields">
            <label className="row"><span>{L('إظهار البانر', 'Show banner')}</span><span className="cat-switch"><input type="checkbox" checked={!!form.bannerActive} onChange={e => set({ bannerActive: e.target.checked })} /><span /></span></label>
          </div>
          {form.bannerActive && <>
            {form.bannerImage && <div className="sheet-banner-preview">
              <img src={form.bannerImage} alt="" />
              <div>{(ar ? form.bannerTitleAr || form.bannerTitle : form.bannerTitle) && <strong>{ar ? form.bannerTitleAr || form.bannerTitle : form.bannerTitle}</strong>}{(ar ? form.bannerSubtitleAr || form.bannerSubtitle : form.bannerSubtitle) && <span>{ar ? form.bannerSubtitleAr || form.bannerSubtitle : form.bannerSubtitle}</span>}{(ar ? form.bannerCtaAr || form.bannerCta : form.bannerCta) && <em>{ar ? form.bannerCtaAr || form.bannerCta : form.bannerCta}</em>}</div>
            </div>}
            <div className="sheet-image"><ImageField value={form.bannerImage ?? ''} onChange={url => set({ bannerImage: url })} label={L('صورة الكمبيوتر', 'Desktop image')} hint={L('مقاس مقترح 1920×800', 'Suggested 1920×800')} /></div>
            <div className="sheet-image"><ImageField value={form.bannerMobileImage ?? ''} onChange={url => set({ bannerMobileImage: url })} label={L('صورة الموبايل', 'Phone image')} hint={L('اختياري · مقاس مقترح 1080×1350. بدونها تنعرض صورة الكمبيوتر.', 'Optional · suggested 1080×1350. Without it the desktop image is used.')} /></div>
            <div className="sheet-fields">
              <label><span>{L('العنوان', 'Title · AR')}</span><input dir="rtl" value={form.bannerTitleAr ?? ''} onChange={e => set({ bannerTitleAr: e.target.value })} placeholder="مثال: تشكيلة الشتاء" /></label>
              <label><span>{L('بالإنكليزي', 'Title · EN')}</span><input dir="ltr" value={form.bannerTitle ?? ''} onChange={e => set({ bannerTitle: e.target.value })} placeholder="e.g. The winter edit" /></label>
              <label><span>{L('النص', 'Line · AR')}</span><input dir="rtl" value={form.bannerSubtitleAr ?? ''} onChange={e => set({ bannerSubtitleAr: e.target.value })} placeholder="سطر قصير تحت العنوان" /></label>
              <label><span>{L('بالإنكليزي', 'Line · EN')}</span><input dir="ltr" value={form.bannerSubtitle ?? ''} onChange={e => set({ bannerSubtitle: e.target.value })} placeholder="A short line under the title" /></label>
              <label><span>{L('زر', 'Button · AR')}</span><input dir="rtl" value={form.bannerCtaAr ?? ''} onChange={e => set({ bannerCtaAr: e.target.value })} placeholder="تسوق هسه" /></label>
              <label><span>{L('بالإنكليزي', 'Button · EN')}</span><input dir="ltr" value={form.bannerCta ?? ''} onChange={e => set({ bannerCta: e.target.value })} placeholder="Shop now" /></label>
              <label><span>{L('الرابط', 'Link')}</span><input dir="ltr" value={form.bannerHref ?? ''} onChange={e => set({ bannerHref: e.target.value })} placeholder="/products/leather-item-1" /></label>
            </div>
            <p className="sheet-note">{L('الرابط اختياري: صفحة منتج، تشكيلة، أو أي رابط يبدي بـ / أو https. بدونه البانر يكون صورة فقط.', 'Link is optional: a product, a collection, or any link starting with / or https. Without it the banner is just an image.')}</p>
          </>}
        </div>

        {!isAll && <div className="sheet-group">
          <h3>{L('صورة القسم', 'Category image')}</h3>
          <div className="sheet-image"><ImageField value={form.image ?? ''} onChange={url => set({ image: url })} label={L('صورة التصنيف', 'Category image')} hint={!form.image && form.cover ? L('إذا ما حطيت صورة، تنعرض صورة أول منتج بالتصنيف.', 'Without one, the first product photo is used.') : L('صورة صغيرة للقسم تنعرض بالقوائم.', 'Small picture used in lists.')} /></div>
        </div>}


        <div className="sheet-group">
          <div className="sheet-fields">
            <label className="row"><span>{isAll ? L('إظهار زر "الكل" بالمتجر', 'Show the "Shop all" pill') : L('ظاهر بالمتجر', 'Visible in store')}</span><span className="cat-switch"><input type="checkbox" checked={form.active} onChange={e => set({ active: e.target.checked })} /><span /></span></label>
          </div>
          {!form.isNew && <div className="sheet-fields">
            <a className="row link" href={`/products/category/${form.id}`} target="_blank" rel="noreferrer"><span>{L('فتح التصنيف بالمتجر', 'Open in store')}</span><ExternalLink size={15} /></a>
          </div>}
        </div>

        {error && <p className="sheet-error" role="alert">{error}</p>}

        {!form.isNew && !isAll && <div className="sheet-group">
          <div className="sheet-fields">
            <button type="button" className="row danger" disabled={busy || !!form.productCount} onClick={() => void del()}><span><Trash2 size={15} /> {L('حذف التصنيف', 'Delete category')}</span></button>
          </div>
          {!!form.productCount && <p className="sheet-note">{L(`بيه ${form.productCount} منتج. انقلهم لتصنيف ثاني أولاً حتى تكدر تحذفه.`, `It has ${form.productCount} products. Move them to another category first.`)}</p>}
        </div>}
      </div>
    </aside>
  </div>;
}
