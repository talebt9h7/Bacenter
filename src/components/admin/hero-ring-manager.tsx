'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, ImageUp, LoaderCircle, Monitor, Plus, RotateCcw, RotateCw, Smartphone, Trash2, WandSparkles } from 'lucide-react';
import { api, Field, Switch, useFlash } from '@/components/admin/ui';
import { useLanguage } from '@/components/language-provider';
import { HeroRing } from '@/components/hero-ring';
import { groupInt } from '@/lib/number-format';
import { mediaSrc } from '@/lib/types';
import type { HeroRing as Ring, HeroRingHeading, HeroRingItem, RingItem } from '@/lib/hero-ring';

type ProductOption = { id: string; name: string; nameAr: string; image: string; priceIqd: number; priceVaries: boolean };
type Limits = { minSeconds: number; maxSeconds: number; maxItems: number };
type CutResult = { image: string; cut: boolean };

/** Admin → Homepage: the turning product ring at the top of the homepage, with a live preview. */
export function HeroRingManager({ initial, products, limits }: { initial: Ring; products: ProductOption[]; limits: Limits }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const L = (a: string, e: string) => (ar ? a : e);
  const { flash, success, fail } = useFlash();
  const [ring, setRing] = useState<Ring>(initial);
  const [saving, setSaving] = useState(false);
  const [cutting, setCutting] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState(false);
  const [device, setDevice] = useState<'phone' | 'desktop'>('phone');
  const latestRing = useRef(ring);
  useEffect(() => { latestRing.current = ring; }, [ring]);
  const fileFor = useRef<string>('');
  const fileInput = useRef<HTMLInputElement>(null);
  const byId = new Map(products.map(p => [p.id, p]));
  const set = (patch: Partial<Ring>) => setRing(r => ({ ...r, ...patch }));
  const setHeading = (patch: Partial<HeroRingHeading>) => setRing(r => ({ ...r, heading: { ...r.heading, ...patch } }));
  // Items are found by product (a product is in the ring once), so a cut that finishes after a reorder lands on the right row.
  const patchItem = (productId: string, patch: Partial<HeroRingItem>) => setRing(r => ({ ...r, items: r.items.map(it => (it.productId === productId ? { ...it, ...patch } : it)) }));
  const move = (i: number, d: number) => setRing(r => { const j = i + d; if (j < 0 || j >= r.items.length) return r; const items = [...r.items]; [items[i], items[j]] = [items[j], items[i]]; return { ...r, items }; });
  const unused = products.filter(p => !ring.items.some(it => it.productId === p.id));
  const setError = (productId: string, text: string) => setErrors(e => ({ ...e, [productId]: text }));

  async function cut(productId: string, source?: string): Promise<boolean> {
    setCutting(c => ({ ...c, [productId]: true })); setError(productId, '');
    try {
      const data = await api<CutResult>('/api/admin/hero-ring/cutout', { method: 'POST', json: { productId, source } });
      patchItem(productId, { image: data.image, cut: true });
      return true;
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      // An uploaded photo that can't be cut stays in the ring as a card.
      if (source) { patchItem(productId, { image: source, cut: false }); setError(productId, `${text} ${L('انحفظت كصورة عادية.', 'Kept as a regular photo.')}`); }
      else setError(productId, text);
      return false;
    } finally { setCutting(c => ({ ...c, [productId]: false })); }
  }

  async function upload(productId: string, files: FileList | null) {
    if (!files?.length) return;
    setCutting(c => ({ ...c, [productId]: true })); setError(productId, '');
    try {
      const form = new FormData(); form.append('files', files[0]);
      const data = await api<{ urls: string[] }>('/api/admin/media', { method: 'POST', body: form });
      await cut(productId, data.urls[0]);
    } catch (error) { setError(productId, error instanceof Error ? error.message : String(error)); setCutting(c => ({ ...c, [productId]: false })); }
    finally { if (fileInput.current) fileInput.current.value = ''; }
  }

  async function save(next: Ring = ring) {
    setSaving(true);
    try { const data = await api<{ ring: Ring }>('/api/admin/hero-ring', { method: 'PUT', json: next }); setRing(data.ring); success(L('انحفظت الحلقة وطلعت بالموقع', 'Ring saved and live')); }
    catch (e) { fail(e); }
    finally { setSaving(false); }
  }

  /** Cuts every product that has no cut-out yet, one after another, then saves. */
  async function cutAllAndSave() {
    setBulk(true);
    const done: Record<string, string> = {};
    for (const item of ring.items) {
      if (item.image && item.cut !== false) continue;
      setCutting(c => ({ ...c, [item.productId]: true })); setError(item.productId, '');
      try {
        const data = await api<CutResult>('/api/admin/hero-ring/cutout', { method: 'POST', json: { productId: item.productId } });
        done[item.productId] = data.image;
        patchItem(item.productId, { image: data.image, cut: true });
      } catch (error) { setError(item.productId, error instanceof Error ? error.message : String(error)); }
      finally { setCutting(c => ({ ...c, [item.productId]: false })); }
    }
    setBulk(false);
    // Whatever was typed meanwhile, plus every cut that just finished.
    const current = latestRing.current;
    await save({ ...current, items: current.items.map(it => (done[it.productId] ? { ...it, image: done[it.productId], cut: true } : it)) });
  }

  const preview: RingItem[] = ring.items.flatMap(item => {
    const p = byId.get(item.productId);
    if (!p) return [];
    const image = item.image || p.image;
    return image ? [{ id: p.id, name: p.name, nameAr: p.nameAr, priceIqd: p.priceIqd, priceVaries: p.priceVaries, href: `/products/${p.id}`, image, cutout: !!item.image && item.cut !== false }] : [];
  });
  const uncut = ring.items.filter(it => !it.image || it.cut === false).length;
  const tooFew = ring.items.length < 3;
  const formatPrice = (n: number) => (ar ? `${groupInt(Math.round(n))} د.ع` : `IQD ${groupInt(Math.round(n))}`);
  const h = ring.heading;

  return <section className="admin-card hring-admin">
    {flash}
    <div className="admin-card-heading">
      <div>
        <h2><RotateCw size={17} /> {L('حلقة المنتجات (أعلى الرئيسية)', 'Product ring (top of homepage)')}</h2>
        <p className="admin-hint">{L('منتجات واكفة على دائرة تدور ببطء، اللي بالنص أكبر ومنوّر. الزبون يوقفها باللمس ويدوّرها بإصبعه، ومن يضغط على منتج جانبي يجي للنص، ومن يضغط على اللي بالنص تنفتح صفحته.', 'Products standing on a slowly turning circle; the front one is biggest and lit. Touch holds it, a drag spins it, a tap on a side product brings it to the front, a tap on the front one opens it.')}</p>
      </div>
      <a className="admin-btn admin-btn-ghost" href="/" target="_blank" rel="noreferrer"><ExternalLink size={15} />{L('شوف الرئيسية', 'View homepage')}</a>
    </div>

    <div className="hring-admin-row">
      <label className="cat-switch"><input type="checkbox" checked={ring.enabled} onChange={e => set({ enabled: e.target.checked })} aria-label={L('تشغيل الحلقة', 'Turn the ring on')} /><span /></label>
      <strong>{ring.enabled ? L('الحلقة شغالة بالموقع', 'Ring is on') : L('الحلقة مطفية', 'Ring is off')}</strong>
    </div>

    <div className="hring-admin-preview">
      <div className="hring-admin-preview-bar">
        <strong>{L('معاينة مباشرة', 'Live preview')}</strong>
        <div className="hring-admin-seg" role="group" aria-label={L('حجم الشاشة', 'Screen size')}>
          <button type="button" aria-pressed={device === 'phone'} onClick={() => setDevice('phone')}><Smartphone size={15} />{L('موبايل', 'Phone')}</button>
          <button type="button" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor size={15} />{L('كمبيوتر', 'Desktop')}</button>
        </div>
      </div>
      <div className={`hring-admin-frame is-${device}`}>
        {preview.length ? <HeroRing key={device} items={preview} secondsPerTurn={ring.secondsPerTurn} heading={ring.heading} caption={ring.caption} formatPrice={formatPrice} preview /> : <p className="hring-admin-empty">{L('أضف منتجات حتى تشوف المعاينة.', 'Add products to see the preview.')}</p>}
      </div>
      {tooFew && <p className="admin-warning-text">{L('تحتاج 3 منتجات على الأقل حتى تظهر الحلقة بالموقع. أحلى شكل من 5 إلى 8.', 'Add at least 3 products for the ring to show on the site; 5–8 look best.')}</p>}
      {!tooFew && uncut > 0 && <p className="admin-warning-text">{L(`${uncut} من الصور بعدها بخلفيتها، فالحلقة تنعرض كبطاقات. اضغط «قص الكل وحفظ» حتى تطلع المنتجات واكفة بدون خلفية.`, `${uncut} photo(s) still have their background, so the ring shows cards. Press “Cut all and save” for free-standing products.`)}</p>}
    </div>

    <div className="hring-admin-subhead">
      <h3>{L(`المنتجات (${ring.items.length}/${limits.maxItems})`, `Products (${ring.items.length}/${limits.maxItems})`)}</h3>
      <button type="button" className="admin-btn admin-btn-primary" disabled={bulk || saving || !ring.items.length || !uncut} onClick={() => void cutAllAndSave()}>{bulk ? <LoaderCircle size={15} className="spin" /> : <WandSparkles size={15} />}{bulk ? L('جارٍ القص…', 'Cutting…') : L('قص الكل وحفظ', 'Cut all and save')}</button>
    </div>
    <input ref={fileInput} type="file" accept="image/png,image/webp,image/jpeg,image/avif" hidden onChange={e => void upload(fileFor.current, e.target.files)} />
    <ol className="hring-admin-list">
      {ring.items.map((item, i) => {
        const product = byId.get(item.productId);
        const thumb = item.image || product?.image;
        const busy = !!cutting[item.productId];
        const state = busy ? 'busy' : item.image && item.cut !== false ? 'cut' : item.image ? 'photo' : 'none';
        return <li key={item.productId}>
          <span className={`hring-admin-thumb${state === 'cut' ? ' is-cut' : ''}`}>{thumb ? <img src={mediaSrc(thumb, 160)} alt="" /> : null}{busy && <i><LoaderCircle size={20} className="spin" /></i>}</span>
          <div className="hring-admin-fields">
            <select value={item.productId} onChange={e => { const id = e.target.value; setRing(r => ({ ...r, items: r.items.map((it, k) => (k === i ? { productId: id, image: '' } : it)) })); void cut(id); }} aria-label={L('المنتج', 'Product')}>
              {product ? null : <option value={item.productId}>{L('منتج محذوف', 'Missing product')}</option>}
              {products.filter(p => p.id === item.productId || !ring.items.some(it => it.productId === p.id)).map(p => <option key={p.id} value={p.id}>{ar ? p.nameAr : p.name}</option>)}
            </select>
            <div className="hring-admin-tools">
              <span className={`hring-admin-badge is-${state}`}>{state === 'busy' ? L('جارٍ القص…', 'Cutting…') : state === 'cut' ? L('مقصوصة', 'Cut out') : state === 'photo' ? L('صورة عادية', 'Regular photo') : L('بدون قص', 'Not cut')}</span>
              <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" disabled={busy || bulk} onClick={() => void cut(item.productId)}><WandSparkles size={14} />{L('قص تلقائي', 'Auto cut')}</button>
              <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" disabled={busy || bulk} onClick={() => { fileFor.current = item.productId; fileInput.current?.click(); }}><ImageUp size={14} />{L('رفع صورة', 'Upload')}</button>
              {item.image && <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" disabled={busy || bulk} onClick={() => patchItem(item.productId, { image: '', cut: undefined })}><RotateCcw size={14} />{L('الصورة الأصلية', 'Original photo')}</button>}
            </div>
            {errors[item.productId] && <small className="hring-admin-error">{errors[item.productId]}</small>}
          </div>
          <div className="hring-admin-actions">
            <button type="button" className="admin-btn admin-btn-ghost admin-icon-only" aria-label={L('تقديم', 'Move up')} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
            <button type="button" className="admin-btn admin-btn-ghost admin-icon-only" aria-label={L('تأخير', 'Move down')} disabled={i === ring.items.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
            <button type="button" className="admin-btn admin-btn-ghost admin-icon-only" aria-label={L('حذف', 'Remove')} onClick={() => setRing(r => ({ ...r, items: r.items.filter(it => it.productId !== item.productId) }))}><Trash2 size={15} /></button>
          </div>
        </li>;
      })}
    </ol>
    <div>
      <button type="button" className="admin-btn admin-btn-ghost" disabled={ring.items.length >= limits.maxItems || !unused.length} onClick={() => { const id = unused[0].id; setRing(r => ({ ...r, items: [...r.items, { productId: id, image: '' }] })); void cut(id); }}><Plus size={15} />{L('إضافة منتج', 'Add product')}</button>
    </div>

    <div className="hring-admin-subhead"><h3>{L('الكتابة فوق الحلقة', 'Text above the ring')}</h3><Switch checked={h.show} onChange={show => setHeading({ show })} label={h.show ? L('ظاهرة', 'Shown') : L('مخفية', 'Hidden')} /></div>
    {h.show && <div className="hring-admin-copy">
      <Field label={L('سطر صغير فوق العنوان (عربي)', 'Eyebrow (Arabic)')}><input dir="rtl" value={h.eyebrowAr} maxLength={80} onChange={e => setHeading({ eyebrowAr: e.target.value })} /></Field>
      <Field label={L('سطر صغير فوق العنوان (إنكليزي)', 'Eyebrow (English)')}><input dir="ltr" value={h.eyebrow} maxLength={80} onChange={e => setHeading({ eyebrow: e.target.value })} /></Field>
      <Field label={L('العنوان (عربي)', 'Title (Arabic)')}><input dir="rtl" value={h.titleAr} maxLength={80} onChange={e => setHeading({ titleAr: e.target.value })} /></Field>
      <Field label={L('العنوان (إنكليزي)', 'Title (English)')}><input dir="ltr" value={h.title} maxLength={80} onChange={e => setHeading({ title: e.target.value })} /></Field>
      <Field label={L('الوصف (عربي)', 'Subtitle (Arabic)')}><input dir="rtl" value={h.subtitleAr} maxLength={160} onChange={e => setHeading({ subtitleAr: e.target.value })} /></Field>
      <Field label={L('الوصف (إنكليزي)', 'Subtitle (English)')}><input dir="ltr" value={h.subtitle} maxLength={160} onChange={e => setHeading({ subtitle: e.target.value })} /></Field>
      <Field label={L('نص الزر (عربي)', 'Button (Arabic)')} hint={L('فارغ = بدون زر', 'Empty = no button')}><input dir="rtl" value={h.ctaAr} maxLength={40} onChange={e => setHeading({ ctaAr: e.target.value })} /></Field>
      <Field label={L('نص الزر (إنكليزي)', 'Button (English)')}><input dir="ltr" value={h.cta} maxLength={40} onChange={e => setHeading({ cta: e.target.value })} /></Field>
      <Field label={L('الزر يفتح', 'Button opens')} className="hring-admin-wide"><input dir="ltr" value={h.href} maxLength={300} onChange={e => setHeading({ href: e.target.value })} placeholder="/products/category/all" /></Field>
    </div>}

    <div className="hring-admin-subhead"><h3>{L('اسم وسعر المنتج اللي بالنص', 'Name and price of the front product')}</h3><Switch checked={ring.caption} onChange={caption => set({ caption })} label={ring.caption ? L('ظاهر', 'Shown') : L('مخفي', 'Hidden')} /></div>

    <label className="hring-admin-speed">
      <span>{L('السرعة', 'Speed')}: <b>{L(`دورة كاملة كل ${ring.secondsPerTurn} ثانية`, `one full turn every ${ring.secondsPerTurn}s`)}</b></span>
      <input type="range" min={limits.minSeconds} max={limits.maxSeconds} step={1} value={limits.maxSeconds + limits.minSeconds - ring.secondsPerTurn} onChange={e => set({ secondsPerTurn: limits.maxSeconds + limits.minSeconds - Number(e.target.value) })} aria-label={L('السرعة', 'Speed')} />
      <span className="hring-admin-scale"><small>{L('أبطأ', 'Slower')}</small><small>{L('أسرع', 'Faster')}</small></span>
    </label>

    <div className="hring-admin-footer">
      <p className="admin-hint">{L('أحلى نتيجة: صور المنتج وحده على خلفية سادة (بيضاء أو رمادي فاتح)، بنفس الزاوية والإضاءة لكل المنتجات. القص التلقائي يشيل الخلفية ويخلي ظل ناعم.', 'Best result: each product alone on a plain light background, same angle and light for all. Auto cut removes the background and keeps a soft shadow.')}</p>
      <button type="button" className="admin-btn admin-btn-primary" disabled={saving || bulk} onClick={() => void save()}>{saving ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ الحلقة', 'Save ring')}</button>
    </div>
  </section>;
}
