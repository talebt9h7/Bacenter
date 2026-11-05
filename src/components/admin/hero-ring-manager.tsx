'use client';
import { useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Plus, RotateCw, Trash2 } from 'lucide-react';
import { api, ImageField, useFlash } from '@/components/admin/ui';
import { useLanguage } from '@/components/language-provider';
import type { HeroRing } from '@/lib/hero-ring';

type ProductOption = { id: string; name: string; image: string };

/** Admin → Homepage: the turning product ring at the top of the homepage. */
export function HeroRingManager({ initial, products, limits }: { initial: HeroRing; products: ProductOption[]; limits: { minSeconds: number; maxSeconds: number; maxItems: number } }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const L = (a: string, e: string) => (ar ? a : e);
  const { flash, success, fail } = useFlash();
  const [ring, setRing] = useState<HeroRing>(initial);
  const [busy, setBusy] = useState(false);
  const byId = new Map(products.map(p => [p.id, p]));
  const set = (patch: Partial<HeroRing>) => setRing(r => ({ ...r, ...patch }));
  const setItem = (i: number, patch: Partial<HeroRing['items'][number]>) => set({ items: ring.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= ring.items.length) return; const items = [...ring.items]; [items[i], items[j]] = [items[j], items[i]]; set({ items }); };
  const unused = products.filter(p => !ring.items.some(it => it.productId === p.id));

  async function save() {
    setBusy(true);
    try { const data = await api<{ ring: HeroRing }>('/api/admin/hero-ring', { method: 'PUT', json: ring }); setRing(data.ring); success(L('انحفظت الحلقة', 'Ring saved')); }
    catch (e) { fail(e); }
    finally { setBusy(false); }
  }

  const tooFew = ring.enabled && ring.items.length < 3;
  return <section className="admin-card hring-admin">
    {flash}
    <div className="admin-card-heading">
      <div>
        <h2><RotateCw size={17} /> {L('حلقة المنتجات (أعلى الرئيسية)', 'Product ring (top of homepage)')}</h2>
        <p className="admin-hint">{L('منتجات تدور ببطء بشكل حلقة. المنتج اللي يجي بالنص يكبر، الزبون يوقفها باللمس ويدوّرها بإصبعه، ومن يضغط على منتج تنفتح صفحته. من تشتغل تاخذ مكان بنر الأكثر مبيعاً.', 'Products turning slowly on a ring. The one at the front grows; touch stops it, a drag spins it, a tap opens the product. When on, it replaces the bestseller hero.')}</p>
      </div>
      <a className="admin-btn admin-btn-ghost" href="/" target="_blank" rel="noreferrer"><ExternalLink size={15} />{L('شوف الرئيسية', 'View homepage')}</a>
    </div>

    <div className="hring-admin-row">
      <label className="cat-switch"><input type="checkbox" checked={ring.enabled} onChange={e => set({ enabled: e.target.checked })} aria-label={L('تشغيل الحلقة', 'Turn the ring on')} /><span /></label>
      <strong>{ring.enabled ? L('الحلقة شغالة', 'Ring on') : L('الحلقة مطفية', 'Ring off')}</strong>
    </div>
    {tooFew && <p className="admin-warning-text">{L('تحتاج 3 منتجات على الأقل حتى تظهر الحلقة.', 'Add at least 3 products for the ring to show.')}</p>}

    <label className="hring-admin-speed">
      <span>{L('السرعة', 'Speed')}: <b>{L(`دورة كاملة كل ${ring.secondsPerTurn} ثانية`, `one full turn every ${ring.secondsPerTurn}s`)}</b></span>
      <input type="range" min={limits.minSeconds} max={limits.maxSeconds} step={1} value={limits.maxSeconds + limits.minSeconds - ring.secondsPerTurn} onChange={e => set({ secondsPerTurn: limits.maxSeconds + limits.minSeconds - Number(e.target.value) })} aria-label={L('السرعة', 'Speed')} />
      <span className="hring-admin-scale"><small>{L('أبطأ', 'Slower')}</small><small>{L('أسرع', 'Faster')}</small></span>
    </label>

    <ol className="hring-admin-list">
      {ring.items.map((item, i) => {
        const product = byId.get(item.productId);
        const thumb = item.image || product?.image;
        return <li key={`${item.productId}-${i}`}>
          <span className="hring-admin-thumb">{thumb ? <img src={thumb} alt="" /> : null}</span>
          <div className="hring-admin-fields">
            <select value={item.productId} onChange={e => setItem(i, { productId: e.target.value })} aria-label={L('المنتج', 'Product')}>
              {product ? null : <option value={item.productId}>{L('منتج محذوف', 'Missing product')}</option>}
              {products.filter(p => p.id === item.productId || !ring.items.some(it => it.productId === p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ImageField value={item.image} onChange={url => setItem(i, { image: url })} label={L('صورة مقصوصة (PNG بخلفية شفافة)', 'Cut-out picture (transparent PNG)')} hint={L('اختياري. بدونها تنعرض أول صورة للمنتج.', 'Optional. Without it the product’s first photo is used.')} />
          </div>
          <div className="hring-admin-actions">
            <button type="button" className="admin-btn admin-btn-ghost admin-icon-only" aria-label={L('تقديم', 'Move up')} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
            <button type="button" className="admin-btn admin-btn-ghost admin-icon-only" aria-label={L('تأخير', 'Move down')} disabled={i === ring.items.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
            <button type="button" className="admin-btn admin-btn-ghost admin-icon-only" aria-label={L('حذف', 'Remove')} onClick={() => set({ items: ring.items.filter((_, k) => k !== i) })}><Trash2 size={15} /></button>
          </div>
        </li>;
      })}
    </ol>

    <div className="hring-admin-footer">
      <button type="button" className="admin-btn admin-btn-ghost" disabled={ring.items.length >= limits.maxItems || !unused.length} onClick={() => set({ items: [...ring.items, { productId: unused[0].id, image: '' }] })}><Plus size={15} />{L(`إضافة منتج (${ring.items.length}/${limits.maxItems})`, `Add product (${ring.items.length}/${limits.maxItems})`)}</button>
      <button type="button" className="admin-btn admin-btn-primary" disabled={busy} onClick={() => void save()}>{busy ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ الحلقة', 'Save ring')}</button>
    </div>
    <p className="admin-hint">{L('للحصول على أجمل شكل: صوّر المنتج وشيل خلفيته (بالآيفون: اضغط مطولاً على المنتج بالصورة ← نسخ، أو موقع remove.bg)، وارفعه هنا PNG. الحلقة تبين 5 إلى 8 منتجات بأحلى شكل.', 'Best look: remove each photo’s background (iPhone: long-press the subject → Copy, or remove.bg) and upload the PNG here. 5–8 products look best.')}</p>
  </section>;
}
