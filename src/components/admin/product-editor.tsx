'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, ImagePlus, Link2, LoaderCircle, Minus, Plus, Save, Star, Trash2, X } from 'lucide-react';
import { PLACEHOLDER_IMAGE, type Product } from '@/lib/types';
import { cleanDetails, type ProductDetails } from '@/lib/product-details';
import { ProductContentEditor } from './product-content-editor';
import { useLanguage } from '@/components/language-provider';
import { productT } from '@/lib/i18n';
import { publishChecklist } from '@/lib/publish-checklist';
import { availableUnits, stockLevel } from '@/lib/stock-level';

type SizeStock = { id?: number; stock: number; baseStock?: number; reserved?: number };
/** Without sizes a colour has one stock; with sizes, one stock per size (keyed by EditorSize.key). */
type EditorColor = { key: string; id?: number; name: string; nameAr: string; hex: string; stock: number; baseStock?: number; reserved?: number; images: string[]; primaryIndex: number; stocks?: Record<string, SizeStock> };
type EditorSize = { key: string; name: string; nameAr: string; price: string };
type EditorState = { id: string; name: string; nameAr: string; subtitle: string; subtitleAr: string; description: string; descriptionAr: string; price: string; priceIqd: string; purchasePriceUsd: string; category: string; capacity: string; badge: string; features: string; specifications: string; warranty: string; materials: string; storyImages: string; dimensions: string; dimensionsImage: string; tags: string; published: boolean; colors: EditorColor[]; sizes: EditorSize[]; details: ProductDetails };

let keyCounter = 0;
const nextKey = () => `c${Date.now()}-${keyCounter++}`;
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
function toState(product: Product | null, exchangeRate: number): EditorState {
  if (!product) return { id: '', name: '', nameAr: '', subtitle: '', subtitleAr: '', description: '', descriptionAr: '', price: '', priceIqd: '', purchasePriceUsd: '', category: 'backpacks', capacity: '', badge: '', features: '', specifications: '', warranty: '', materials: '', storyImages: '', dimensions: '', dimensionsImage: '', tags: '', published: false, colors: [{ key: nextKey(), name: 'Black', nameAr: 'أسود', hex: '#333333', stock: 0, images: [], primaryIndex: 0 }], sizes: [], details: cleanDetails({}) };
  return { id: product.id, name: product.name, nameAr: product.nameAr, subtitle: product.subtitle, subtitleAr: product.subtitleAr, description: product.description, descriptionAr: product.descriptionAr, price: String(product.price), priceIqd: String(product.salePriceIqd || Math.round(product.price * exchangeRate)), purchasePriceUsd: '', category: product.category, capacity: product.capacity ?? '', badge: product.badge ?? '', features: product.features.join('\n'), specifications: (product.specifications ?? []).join('\n'), warranty: product.warranty ?? '', materials: product.materials ?? '', storyImages: (product.storyImages ?? []).join('\n'), dimensions: product.dimensions, dimensionsImage: product.dimensionsImage ?? '', tags: product.tags.join(', '), published: product.published, details: product.details, ...variantsToEditor(product) };
}
/** Groups the product's variants back into colours (and sizes, when the product has them). */
function variantsToEditor(product: Product): { colors: EditorColor[]; sizes: EditorSize[] } {
  const sized = product.colors.some(c => c.size);
  if (!sized) return { sizes: [], colors: product.colors.map(color => ({ key: nextKey(), id: color.id, name: color.name, nameAr: color.nameAr, hex: color.hex, stock: color.onHand ?? color.stock, baseStock: color.onHand ?? color.stock, reserved: color.reserved ?? 0, images: [...color.images], primaryIndex: color.primaryIndex })) };
  const sizes: EditorSize[] = [];
  for (const c of product.colors) if (c.size && !sizes.some(x => x.name === c.size)) sizes.push({ key: nextKey(), name: c.size, nameAr: c.sizeAr || c.size, price: c.priceIqd ? String(c.priceIqd) : '' });
  const colors: EditorColor[] = [];
  for (const c of product.colors) {
    let group = colors.find(x => x.name === c.name);
    if (!group) { group = { key: nextKey(), id: c.id, name: c.name, nameAr: c.nameAr, hex: c.hex, stock: 0, images: [...c.images], primaryIndex: c.primaryIndex, stocks: {} }; colors.push(group); }
    const size = sizes.find(x => x.name === c.size);
    if (size) group.stocks![size.key] = { id: c.id, stock: c.onHand ?? c.stock, baseStock: c.onHand ?? c.stock, reserved: c.reserved ?? 0 };
  }
  return { colors, sizes };
}
const colorTotal = (c: EditorColor, sized: boolean) => sized ? Object.values(c.stocks ?? {}).reduce((sum, x) => sum + (Number(x.stock) || 0), 0) : Number(c.stock) || 0;

export function ProductEditor({ initial, initialColorId, exchangeRate, categories, wholesalePriceIqd = 0, lowStockThreshold = 5 }: { initial: Product | null; initialColorId?: number; exchangeRate: number; categories: { id: string; name: string }[]; wholesalePriceIqd?: number; lowStockThreshold?: number }) {
  const [wholesale, setWholesale] = useState(wholesalePriceIqd ? String(wholesalePriceIqd) : '');
  const { language } = useLanguage();
  const tr = (label: keyof typeof import('@/lib/i18n').productTranslations) => productT(label, language);
  const router = useRouter();
  // Build the editor state once, and pick the colour from the same object, so the colour in the
  // URL (?color=<id>) always matches a key that exists in state.
  const [boot] = useState(() => { const s = toState(initial, exchangeRate); return { state: s, key: (initialColorId && s.colors.find(c => c.id === initialColorId || Object.values(c.stocks ?? {}).some(x => x.id === initialColorId))?.key) || s.colors[0]?.key || '' }; });
  const [state, setState] = useState<EditorState>(boot.state);
  const [activeKey, setActiveKey] = useState<string>(boot.key);
  const [wasPublished] = useState(!!initial?.published);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [previewIndex, setPreviewIndex] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const isNew = !initial;
  const active = state.colors.find(color => color.key === activeKey) ?? state.colors[0];
  const checklist = useMemo(() => publishChecklist({ name: state.name, nameAr: state.nameAr, salePriceIqd: Number(state.priceIqd) || 0, description: state.description, descriptionAr: state.descriptionAr, features: state.details?.features, featuresAr: state.details?.featuresAr, colors: state.colors.map(c => ({ name: c.name, images: c.images, stock: colorTotal(c, state.sizes.length > 0) })) }), [state]);
  const sized = state.sizes.length > 0;
  const totalStock = useMemo(() => state.colors.reduce((sum, color) => sum + colorTotal(color, state.sizes.length > 0), 0), [state.colors, state.sizes.length]);
  useEffect(() => { if (!dirty) return; const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty]);
  useEffect(() => { if (!message || message.error) return; const timer = setTimeout(() => setMessage(null), 4000); return () => clearTimeout(timer); }, [message]);
  function update(patch: Partial<EditorState>) { setState(current => ({ ...current, ...patch })); setDirty(true); }
  function updateColor(key: string, patch: Partial<EditorColor> | ((color: EditorColor) => Partial<EditorColor>)) { setState(current => ({ ...current, colors: current.colors.map(color => color.key === key ? { ...color, ...(typeof patch === 'function' ? patch(color) : patch) } : color) })); setDirty(true); }
  function addColor(duplicateFrom?: EditorColor) { const color: EditorColor = { key: nextKey(), name: duplicateFrom ? `${duplicateFrom.name} copy` : 'New color', nameAr: duplicateFrom ? `${duplicateFrom.nameAr} نسخة` : 'لون جديد', hex: duplicateFrom?.hex ?? '#8a8a8a', stock: 0, images: duplicateFrom ? [...duplicateFrom.images] : [], primaryIndex: duplicateFrom?.primaryIndex ?? 0, ...(state.sizes.length ? { stocks: Object.fromEntries(state.sizes.map(z => [z.key, { stock: 0 }])) } : {}) }; update({ colors: [...state.colors, color] }); setActiveKey(color.key); }
  function removeColor(key: string) { if (state.colors.length === 1) { setMessage({ text: tr('A product needs at least one color.'), error: true }); return; } const remaining = state.colors.filter(color => color.key !== key); update({ colors: remaining }); if (activeKey === key) setActiveKey(remaining[0].key); }
  // Sizes are optional. Turning them on moves each colour's current stock to the first size.
  function addSize() {
    const size: EditorSize = { key: nextKey(), name: '', nameAr: '', price: '' };
    setState(current => {
      const first = current.sizes.length === 0;
      return { ...current, sizes: [...current.sizes, size], colors: current.colors.map(c => first
        ? { ...c, stocks: { [size.key]: { id: c.id, stock: Number(c.stock) || 0, baseStock: c.baseStock, reserved: c.reserved } }, id: undefined, stock: 0, baseStock: undefined, reserved: 0 }
        : { ...c, stocks: { ...(c.stocks ?? {}), [size.key]: { stock: 0 } } }) };
    });
    setDirty(true);
  }
  function updateSize(key: string, patch: Partial<EditorSize>) { setState(current => ({ ...current, sizes: current.sizes.map(z => z.key === key ? { ...z, ...patch } : z) })); setDirty(true); }
  function removeSize(key: string) {
    setState(current => {
      const sizes = current.sizes.filter(z => z.key !== key);
      // Removing the last size turns sizes off again: its stock becomes the colour's stock.
      if (!sizes.length) return { ...current, sizes, colors: current.colors.map(c => { const s0 = c.stocks?.[key]; return { ...c, id: s0?.id, stock: s0?.stock ?? 0, baseStock: s0?.baseStock, reserved: s0?.reserved ?? 0, stocks: undefined }; }) };
      return { ...current, sizes, colors: current.colors.map(c => { const next = { ...(c.stocks ?? {}) }; delete next[key]; return { ...c, stocks: next }; }) };
    });
    setDirty(true);
  }
  function moveSize(key: string, direction: -1 | 1) { setState(current => { const i = current.sizes.findIndex(z => z.key === key); const j = i + direction; if (i < 0 || j < 0 || j >= current.sizes.length) return current; const sizes = [...current.sizes]; [sizes[i], sizes[j]] = [sizes[j], sizes[i]]; return { ...current, sizes }; }); setDirty(true); }
  function setSizeStock(colorKey: string, sizeKey: string, value: number) { updateColor(colorKey, c => ({ stocks: { ...(c.stocks ?? {}), [sizeKey]: { ...(c.stocks?.[sizeKey] ?? { stock: 0 }), stock: Math.max(0, Math.floor(value) || 0) } } })); }
  function moveColor(key: string, direction: -1 | 1) { const index = state.colors.findIndex(color => color.key === key); const target = index + direction; if (target < 0 || target >= state.colors.length) return; const colors = [...state.colors]; [colors[index], colors[target]] = [colors[target], colors[index]]; update({ colors }); }
  function moveImage(index: number, direction: -1 | 1) { if (!active) return; const target = index + direction; if (target < 0 || target >= active.images.length) return; updateColor(active.key, color => { const images = [...color.images]; [images[index], images[target]] = [images[target], images[index]]; let primaryIndex = color.primaryIndex; if (primaryIndex === index) primaryIndex = target; else if (primaryIndex === target) primaryIndex = index; return { images, primaryIndex }; }); }
  function removeImage(index: number) { if (!active) return; updateColor(active.key, color => { const images = color.images.filter((_, i) => i !== index); const primaryIndex = color.primaryIndex > index ? color.primaryIndex - 1 : Math.min(color.primaryIndex, Math.max(images.length - 1, 0)); return { images, primaryIndex }; }); }
  function addImages(urls: string[]) { if (!active || !urls.length) return; updateColor(active.key, color => ({ images: [...color.images, ...urls].slice(0, 12) })); }
  async function upload(files: FileList | null) {
    if (!files?.length || !active) return; setUploading(true); setMessage(null);
    try { const form = new FormData(); Array.from(files).forEach(file => form.append('files', file)); const response = await fetch('/api/admin/media', { method: 'POST', body: form }); const data = await response.json(); if (!response.ok) throw new Error(data.error); addImages(data.urls); setMessage({ text: language === 'ar' ? `تمت إضافة ${data.urls.length} صورة إلى ${active.name}. احفظ لنشر التغييرات.` : `${data.urls.length} photo${data.urls.length === 1 ? '' : 's'} added to ${active.name}. Save to publish.`, error: false }); }
    catch (error) { setMessage({ text: error instanceof Error ? error.message : tr('Upload failed.'), error: true }); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  function addUrl() { const value = urlDraft.trim(); if (!value) return; if (!/^\/(images|api\/media)\//.test(value) && !/^https?:\/\//.test(value)) { setMessage({ text: language === 'ar' ? 'استخدم رابط https:// كامل أو مساراً مثل /images/photo.jpg.' : 'Use a full https:// URL or a path such as /images/photo.jpg.', error: true }); return; } addImages([value]); setUrlDraft(''); }
  async function save() {
    setSaving(true); setMessage(null);
    if (isNew) { const initialStock = state.colors.reduce((sum, color) => sum + colorTotal(color, state.sizes.length > 0), 0); const purchasePrice = Number(state.purchasePriceUsd); if (initialStock > 0 && (!Number.isFinite(purchasePrice) || purchasePrice < 0)) { setMessage({ text: language === 'ar' ? 'أدخل تكلفة الشراء للوحدة بالدولار لأن المخزون الأولي أكبر من صفر.' : 'Enter the purchase cost per unit in USD because the initial stock is greater than zero.', error: true }); setSaving(false); return; } }
    if (state.published && !wasPublished && checklist.some(item => !item.ok)) { setMessage({ text: (language === 'ar' ? 'المنتج غير جاهز للنشر. ناقص: ' : 'Not ready to publish. Missing: ') + checklist.filter(item => !item.ok).map(item => language === 'ar' ? item.ar : item.en).join(language === 'ar' ? '، ' : ', ') + (language === 'ar' ? '. احفظه كمسودة أو كمّل الناقص.' : '. Save it as a draft or complete the missing items.'), error: true }); setSaving(false); return; }
    const priceIqd = Number(state.priceIqd);
    if (!Number.isFinite(priceIqd) || priceIqd < 0) { setMessage({ text: language === 'ar' ? 'أدخل سعر البيع بالدينار العراقي.' : 'Enter the sale price in IQD.', error: true }); setSaving(false); return; }
    if (sized) {
      const names = state.sizes.map(z => z.name.trim().toLowerCase());
      if (names.some(n => !n) || state.sizes.some(z => !z.nameAr.trim())) { setMessage({ text: language === 'ar' ? 'اكتب اسم كل قياس بالعربي والإنكليزي.' : 'Give every size an English and an Arabic name.', error: true }); setSaving(false); return; }
      if (new Set(names).size !== names.length) { setMessage({ text: language === 'ar' ? 'أكو قياس مكرر.' : 'A size is listed twice.', error: true }); setSaving(false); return; }
      if (state.sizes.some(z => z.price.trim() && !(Number(z.price) > 0))) { setMessage({ text: language === 'ar' ? 'سعر القياس لازم يكون رقم أكبر من صفر، أو اتركه فارغ حتى ياخذ سعر المنتج.' : 'A size price must be above zero, or leave it empty to use the product price.', error: true }); setSaving(false); return; }
    }
    const priceUsd = priceIqd / exchangeRate;
    const payload = { id: isNew ? slugify(state.id || state.name) : state.id, name: state.name, nameAr: state.nameAr || state.name, subtitle: state.subtitle, subtitleAr: state.subtitleAr || state.subtitle, description: state.description, descriptionAr: state.descriptionAr || state.description, price: priceUsd, wholesalePriceIqd: Math.max(0, Math.round(Number(wholesale) || 0)), salePriceIqd: Math.round(priceIqd), purchasePriceUsd: isNew && state.purchasePriceUsd.trim() ? Number(state.purchasePriceUsd) : null, exchangeRate, category: state.category, capacity: state.capacity || null, badge: state.badge || null, details: state.details, tags: state.tags.split(',').map(tag => tag.trim()).filter(Boolean), published: state.published, colors: sized
      // One variant per colour × size; photos and swatch are shared by the colour's sizes.
      ? state.colors.flatMap(color => state.sizes.map(z => { const st = color.stocks?.[z.key] ?? { stock: 0 }; return { id: st.id, name: color.name, nameAr: color.nameAr, hex: color.hex, stock: Number(st.stock) || 0, baseStock: st.id ? st.baseStock : undefined, images: color.images, primaryIndex: color.primaryIndex, size: z.name.trim(), sizeAr: z.nameAr.trim() || z.name.trim(), priceIqd: z.price.trim() ? Math.round(Number(z.price)) : null }; }))
      : state.colors.map(color => ({ id: color.id, name: color.name, nameAr: color.nameAr, hex: color.hex, stock: Number(color.stock) || 0, baseStock: color.id ? color.baseStock : undefined, images: color.images, primaryIndex: color.primaryIndex })) };
    try {
      const response = await fetch(isNew ? '/api/admin/products' : `/api/admin/products/${state.id}`, { method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setDirty(false); setMessage({ text: isNew ? 'Product created. You can keep editing it here.' : 'Saved. The storefront is up to date.', error: false });
      if (isNew) router.replace(`/admin/products/${data.product.id}`); else { const fresh = toState(data.product, exchangeRate); const was = state.colors.find(color => color.key === activeKey); setState(fresh); setActiveKey((was?.id && fresh.colors.find(color => color.id === was.id)?.key) || fresh.colors.find(color => color.name === was?.name)?.key || fresh.colors[0].key); router.refresh(); }
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : tr('Saving failed.'), error: true }); }
    finally { setSaving(false); }
  }
  async function destroy() {
    if (!confirm(language === 'ar' ? `حذف «${state.name}» وجميع ألوانه ومخزونه وصوره؟ لا يمكن التراجع عن هذا الإجراء.` : `Delete “${state.name}” and all of its colors, stock and photos? This cannot be undone.`)) return;
    const response = await fetch(`/api/admin/products/${state.id}`, { method: 'DELETE' });
    if (response.ok) { setDirty(false); router.replace('/admin/products'); router.refresh(); } else setMessage({ text: tr('The product could not be deleted.'), error: true });
  }
  const previewImages = active?.images.length ? active.images : [PLACEHOLDER_IMAGE];
  const safePreview = Math.min(previewIndex, previewImages.length - 1);
  return <main className="admin-page admin-editor">
    <div className="admin-page-heading"><div><Link href="/admin/products" className="admin-link"><ArrowLeft size={14} /> {tr('All products')}</Link><h1>{isNew ? tr('New product') : state.name || 'Untitled product'}</h1><p>{isNew ? 'Set up the basics, then add each color with its own stock and photos.' : <>{state.colors.length} color{state.colors.length === 1 ? '' : 's'} · {totalStock} units in stock · <a href={`/products/${state.id}`} target="_blank" rel="noreferrer" className="admin-link">{tr('View on storefront')} <ExternalLink size={12} /></a></>}</p></div><div className="admin-heading-actions"><label className="admin-switch" title={language === 'ar' ? 'يظهر بقسم الأكثر مبيعاً بالرئيسية وصفحة الأكثر مبيعاً' : 'Shown in Bestsellers on the home page and the bestsellers page'}><input type="checkbox" checked={state.tags.split(',').map(t => t.trim()).includes('bestsellers')} onChange={event => { const tags = state.tags.split(',').map(t => t.trim()).filter(t => t && t !== 'bestsellers'); update({ tags: (event.target.checked ? [...tags, 'bestsellers'] : tags).join(', ') }); }} /><span /> {language === 'ar' ? 'الأكثر مبيعاً' : 'Bestseller'}</label><label className="admin-switch"><input type="checkbox" checked={state.published} onChange={event => update({ published: event.target.checked })} /><span /> {state.published ? tr('Published') : tr('Draft')}</label><button className="admin-btn admin-btn-primary" onClick={save} disabled={saving}>{saving ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />} {isNew ? tr('Create product') : tr('Save changes')}</button></div></div>
    {message && <div className={`admin-alert ${message.error ? 'error' : 'success'}`} role="status">{message.error ? <X size={16} /> : <Check size={16} />}{message.text}<button onClick={() => setMessage(null)} aria-label="Dismiss"><X size={14} /></button></div>}
    <div className="admin-editor-grid">
      <section className="admin-card admin-product-details-card">
        <div className="admin-card-heading">
          <div>
            <h2>{tr('Product details')}</h2>
            <p className="admin-card-subtitle">{language === 'ar' ? 'أدخل المحتوى العربي والإنجليزي بشكل مستقل حتى يظهر المتجر حسب لغة الزائر.' : 'Maintain Arabic and English content independently so the storefront follows the visitor language.'}</p>
          </div>
        </div>
        <div className="admin-bilingual-panel">
          <div className="admin-bilingual-title">
            <div><span className="admin-language-dot ar">ع</span><strong>العربية</strong><small>محتوى المتجر بالعربية</small></div>
            <div><span className="admin-language-dot en">EN</span><strong>English</strong><small>English storefront content</small></div>
          </div>
          <div className="admin-bilingual-grid" dir="ltr">
            <div className="admin-language-column" dir="rtl">
              <div className="admin-language-column-heading"><strong>المحتوى العربي</strong><span>العربية</span></div>
              <label className="admin-field"><span>اسم المنتج</span><input value={state.nameAr} onChange={e => update({ nameAr: e.target.value })} dir="rtl" placeholder="مثال: محفظة جلدية كلاسيكية" /></label>
              <label className="admin-field"><span>العنوان الفرعي</span><input value={state.subtitleAr} onChange={e => update({ subtitleAr: e.target.value })} dir="rtl" placeholder="مثال: جلد طبيعي بتصميم أنيق" /></label>
              <label className="admin-field"><span>الوصف</span><textarea value={state.descriptionAr} onChange={e => update({ descriptionAr: e.target.value })} dir="rtl" rows={7} placeholder="اكتب وصف المنتج بالعربية..." /></label>
            </div>
            <div className="admin-language-column" dir="ltr">
              <div className="admin-language-column-heading"><strong>English content</strong><span>English</span></div>
              <label className="admin-field"><span>Product name</span><input value={state.name} onChange={e => update({ name: e.target.value })} dir="ltr" placeholder="Example: Classic Leather Wallet" /></label>
              <label className="admin-field"><span>Subtitle</span><input value={state.subtitle} onChange={e => update({ subtitle: e.target.value })} dir="ltr" placeholder="Example: Crafted from genuine leather" /></label>
              <label className="admin-field"><span>Description</span><textarea value={state.description} onChange={e => update({ description: e.target.value })} dir="ltr" rows={7} placeholder="Write the product description in English..." /></label>
            </div>
          </div>
        </div>
        <div className="admin-form-grid">
        
        <label className="admin-field span-2"><span>{tr('URL handle')}</span><div className="admin-prefixed"><em>/products/</em><input value={isNew ? state.id : state.id} disabled={!isNew} onChange={event => update({ id: slugify(event.target.value) })} placeholder={slugify(state.name) || 'my-product'} /></div>{isNew && <small>Leave blank to generate from the name.</small>}</label>
        <label className="admin-field"><span>{tr('Price (IQD)')}</span><input type="number" min="0" step="250" value={state.priceIqd} onChange={event => update({ priceIqd: event.target.value, price: String(Number(event.target.value || 0) / exchangeRate) })} placeholder="150000" />{Number(state.priceIqd) > 0 && <small>{tr('USD equivalent')}: ${Math.round((Number(state.priceIqd) / exchangeRate) * 100) / 100} · {tr('Current exchange rate')}: 1 USD = {exchangeRate.toLocaleString('en-US')} IQD. {tr('Changing the rate does not change this IQD sale price.')}</small>}</label>
        <label className="admin-field"><span>{language === 'ar' ? 'سعر الجملة (د.ع)' : 'Wholesale price (IQD)'}</span><input type="number" min="0" step="250" value={wholesale} onChange={event => setWholesale(event.target.value)} placeholder={language === 'ar' ? 'اختياري' : 'Optional'} />{Number(wholesale) > 0 && Number(state.priceIqd) > 0 && <small>{language === 'ar' ? `ربح التاجر بالقطعة: ${(Number(state.priceIqd) - Number(wholesale)).toLocaleString('en-US')} د.ع (${Math.round((1 - Number(wholesale) / Number(state.priceIqd)) * 100)}%)` : `Trader margin per piece: ${(Number(state.priceIqd) - Number(wholesale)).toLocaleString('en-US')} IQD (${Math.round((1 - Number(wholesale) / Number(state.priceIqd)) * 100)}%)`}</small>}</label>
        {isNew && <label className="admin-field"><span>{tr('Purchase cost / unit (USD)')}</span><input type="number" min="0" step="0.01" value={state.purchasePriceUsd} onChange={event => update({ purchasePriceUsd: event.target.value })} placeholder="11.00" /><small>Used for the initial stock batch. The exchange rate at purchase is saved with the batch.</small></label>}
        <label className="admin-field"><span>{tr('Category')}</span><select value={state.category} onChange={event => update({ category: event.target.value })}>{categories.filter(item => item.id !== 'all').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="admin-field"><span>{tr('Capacity / size')}</span><input value={state.capacity} onChange={event => update({ capacity: event.target.value })} placeholder="20L" /></label>
        <label className="admin-field"><span>{tr('Badge')}</span><input value={state.badge} onChange={event => update({ badge: event.target.value })} placeholder="NEW, BESTSELLER…" /></label>
        
        
        <label className="admin-field"><span>{tr('Collections / tags')} <small>(comma separated)</small></span><input value={state.tags} onChange={event => update({ tags: event.target.value })} placeholder="bestsellers, travel, work" /></label>
      </div></section>

      <section className="admin-card admin-sizes-card"><div className="admin-card-heading"><div><h2>{language === 'ar' ? 'القياسات (اختياري)' : 'Sizes (optional)'}</h2><p className="admin-card-subtitle">{language === 'ar' ? 'إذا المنتج يجي بأكثر من قياس، ضيف القياسات هنا. كل قياس إله سعر ومخزون لكل لون. اترك السعر فارغ حتى ياخذ سعر المنتج.' : 'If the product comes in more than one size, add the sizes here. Each size has its own price and stock per color. Leave the price empty to use the product price.'}</p></div><button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={addSize}><Plus size={14} /> {language === 'ar' ? 'إضافة قياس' : 'Add size'}</button></div>
        {sized ? <div className="admin-size-rows">{state.sizes.map((z, index) => <div className="admin-size-row" key={z.key}>
          <label className="admin-field"><span>{language === 'ar' ? 'القياس — العربية' : 'Size — Arabic'}</span><input value={z.nameAr} dir="rtl" placeholder="كبير / 40×30 سم" onChange={e => updateSize(z.key, { nameAr: e.target.value })} /></label>
          <label className="admin-field"><span>{language === 'ar' ? 'القياس — English' : 'Size — English'}</span><input value={z.name} dir="ltr" placeholder="Large / 40×30 cm" onChange={e => updateSize(z.key, { name: e.target.value })} /></label>
          <label className="admin-field"><span>{language === 'ar' ? 'السعر (د.ع)' : 'Price (IQD)'}</span><input type="number" min="0" step="250" value={z.price} placeholder={state.priceIqd || (language === 'ar' ? 'سعر المنتج' : 'Product price')} onChange={e => updateSize(z.key, { price: e.target.value })} /></label>
          <div className="admin-size-row-actions"><button className="admin-btn admin-btn-ghost admin-btn-sm" aria-label="Move size earlier" disabled={index === 0} onClick={() => moveSize(z.key, -1)}><ChevronRight size={14} /></button><button className="admin-btn admin-btn-ghost admin-btn-sm" aria-label="Move size later" disabled={index === state.sizes.length - 1} onClick={() => moveSize(z.key, 1)}><ChevronLeft size={14} /></button><button className="admin-btn admin-btn-danger-ghost admin-btn-sm" onClick={() => removeSize(z.key)}><Trash2 size={14} /> {language === 'ar' ? 'حذف' : 'Remove'}</button></div>
        </div>)}</div> : <p className="admin-hint">{language === 'ar' ? 'هذا المنتج بقياس واحد. اضغط "إضافة قياس" إذا عنده قياسات.' : 'This product has a single size. Click “Add size” if it comes in several.'}</p>}
      </section>

      <section className="admin-card admin-colors-card"><div className="admin-card-heading"><h2>{tr('Colors, stock & photos')}</h2><button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => addColor()}><Plus size={14} /> {tr('Add color')}</button></div>
        <div className="admin-color-tabs" role="tablist" aria-label={tr('Colors')}>{state.colors.map(color => <button key={color.key} role="tab" aria-selected={active?.key === color.key} className={`admin-color-tab ${active?.key === color.key ? 'active' : ''}`} onClick={() => { setActiveKey(color.key); setPreviewIndex(color.primaryIndex); }}><i style={{ background: color.hex }} /><span>{color.name || 'Untitled'}</span><b className={{ out: 'danger', low: 'warning', ok: '' }[stockLevel(sized ? colorTotal(color, true) : availableUnits(Number(color.stock) || 0, color.reserved), lowStockThreshold)]}>{colorTotal(color, sized)}</b><small>{color.images.length} photo{color.images.length === 1 ? '' : 's'}</small></button>)}</div>
        {active && <div className="admin-variant">
          <div className="admin-variant-fields">
            <label className="admin-field"><span>{language === 'ar' ? 'اسم اللون — English' : 'Color name — English'}</span><input value={active.name} onChange={event => updateColor(active.key, { name: event.target.value })} dir="ltr" /></label><label className="admin-field"><span>{language === 'ar' ? 'اسم اللون — العربية' : 'Color name — Arabic'}</span><input value={active.nameAr} onChange={event => updateColor(active.key, { nameAr: event.target.value })} dir="rtl" /></label>
            <label className="admin-field"><span>{tr('Swatch')}</span><div className="admin-hex"><input type="color" value={/^#[0-9a-f]{6}$/i.test(active.hex) ? active.hex : '#333333'} onChange={event => updateColor(active.key, { hex: event.target.value })} aria-label={tr('Swatch')} /><input value={active.hex} onChange={event => updateColor(active.key, { hex: event.target.value })} maxLength={7} /></div></label>
            {sized ? <div className="admin-field admin-size-stock"><span>{language === 'ar' ? 'المخزون لكل قياس بهذا اللون' : 'Stock per size in this color'}</span><div className="admin-size-stock-grid">{state.sizes.map(z => { const st = active.stocks?.[z.key] ?? { stock: 0 }; return <label key={z.key}><b>{(language === 'ar' ? z.nameAr : z.name) || (language === 'ar' ? 'قياس' : 'Size')}</b><div className="admin-stepper"><button type="button" aria-label="Decrease stock" onClick={() => setSizeStock(active.key, z.key, (Number(st.stock) || 0) - 1)}><Minus size={14} /></button><input type="number" min="0" value={st.stock} onChange={event => setSizeStock(active.key, z.key, Number(event.target.value))} aria-label={`Stock ${z.name}`} /><button type="button" aria-label="Increase stock" onClick={() => setSizeStock(active.key, z.key, (Number(st.stock) || 0) + 1)}><Plus size={14} /></button></div>{st.reserved ? <small className="admin-stock-reserved">{language === 'ar' ? `محجوز: ${st.reserved}` : `Reserved: ${st.reserved}`}</small> : null}</label>; })}</div></div> : <div className="admin-field"><span>{language === 'ar' ? 'المخزون الفعلي لهذا اللون' : 'Stock on hand for this color'}{active.reserved ? <small className="admin-stock-reserved">{language === 'ar' ? ` · محجوز لطلبات قيد الانتظار: ${active.reserved} · المتاح للبيع: ${Math.max(0, active.stock - active.reserved)}` : ` · Reserved by pending orders: ${active.reserved} · Available to sell: ${Math.max(0, active.stock - active.reserved)}`}</small> : null}</span><div className="admin-stepper"><button type="button" aria-label="Decrease stock" onClick={() => updateColor(active.key, color => ({ stock: Math.max(0, (Number(color.stock) || 0) - 1) }))}><Minus size={14} /></button><input type="number" min="0" value={active.stock} onChange={event => updateColor(active.key, { stock: Math.max(0, Math.floor(Number(event.target.value) || 0)) })} aria-label="Stock quantity" /><button type="button" aria-label="Increase stock" onClick={() => updateColor(active.key, color => ({ stock: (Number(color.stock) || 0) + 1 }))}><Plus size={14} /></button></div><small>{stockLevel(availableUnits(Number(active.stock) || 0, active.reserved), lowStockThreshold) === 'out' ? tr('Shown as sold out on the storefront.') : stockLevel(availableUnits(Number(active.stock) || 0, active.reserved), lowStockThreshold) === 'low' ? tr('Customers will see “Only a few left”.') : tr('In stock.')}</small></div>}
            <div className="admin-variant-actions"><button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => moveColor(active.key, -1)} aria-label="Move color earlier"><ChevronLeft size={14} /></button><button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => moveColor(active.key, 1)} aria-label="Move color later"><ChevronRight size={14} /></button><button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => addColor(active)}><Copy size={14} /> {tr('Duplicate')}</button><button className="admin-btn admin-btn-danger-ghost admin-btn-sm" onClick={() => removeColor(active.key)}><Trash2 size={14} /> {tr('Remove color')}</button></div>
          </div>
          <div className="admin-photos"><div className="admin-photos-heading"><h3>{tr('Photos for')} {active.name || (language === 'ar' ? 'هذا اللون' : 'this color')} <small>{active.images.length}/12</small></h3><div className="admin-photo-actions"><input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={event => void upload(event.target.files)} /><button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => fileInput.current?.click()} disabled={uploading || active.images.length >= 12}>{uploading ? <LoaderCircle size={14} className="spin" /> : <ImagePlus size={14} />} {tr('Upload photos')}</button></div></div>
            <p className="admin-hint">{tr('Keep every color’s photos in the same order (for example: front, detail, side). When a shopper switches color, the storefront shows the photo in the same position. Click ★ to set the main photo for this color.')}</p>
            {active.images.length ? <ol className="admin-photo-grid">{active.images.map((image, index) => <li key={`${image}-${index}`} className={index === active.primaryIndex ? 'primary' : ''}><img src={image} alt={`${active.name} photo ${index + 1}`} loading="lazy" /><span className="admin-photo-index">#{index + 1}</span>{index === active.primaryIndex && <span className="admin-photo-main"><Star size={11} fill="currentColor" /> {tr('Main')}</span>}<div className="admin-photo-tools"><button aria-label={tr('Set as main photo')} title={tr('Set as main photo')} onClick={() => updateColor(active.key, { primaryIndex: index })} disabled={index === active.primaryIndex}><Star size={14} /></button><button aria-label={tr('Move earlier')} title={tr('Move earlier')} onClick={() => moveImage(index, -1)} disabled={index === 0}><ChevronLeft size={14} /></button><button aria-label={tr('Move later')} title={tr('Move later')} onClick={() => moveImage(index, 1)} disabled={index === active.images.length - 1}><ChevronRight size={14} /></button><button aria-label={tr('Remove')} title={tr('Remove')} className="danger" onClick={() => removeImage(index)}><Trash2 size={14} /></button></div></li>)}</ol> : <div className="admin-dropzone" onClick={() => fileInput.current?.click()}><ImagePlus size={28} strokeWidth={1.3} /><strong>No photos yet for {active.name || 'this color'}</strong><span>{tr('Upload JPG, PNG or WebP. Images are optimised automatically.')}</span></div>}
            <div className="admin-url-add"><Link2 size={15} /><input value={urlDraft} onChange={event => setUrlDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addUrl(); } }} placeholder={tr('Or paste an image URL / path, e.g. /images/transit-workpack-black.jpg')} aria-label="Image URL" /><button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={addUrl} disabled={!urlDraft.trim()}>{tr('Add')}</button></div>
          </div>
        </div>}
      </section>

      <aside className="admin-card admin-preview"><div className="admin-card-heading"><h2>{tr('Storefront preview')}</h2></div><div className="admin-preview-image"><img src={previewImages[safePreview]} alt="" />{previewImages.length > 1 && <><button aria-label="Previous preview photo" onClick={() => setPreviewIndex((safePreview - 1 + previewImages.length) % previewImages.length)}><ChevronLeft size={18} /></button><button className="right" aria-label="Next preview photo" onClick={() => setPreviewIndex((safePreview + 1) % previewImages.length)}><ChevronRight size={18} /></button></>}<span>{safePreview + 1} / {previewImages.length}</span></div><div className="admin-preview-swatches">{state.colors.map(color => <button key={color.key} title={color.name} aria-label={`Preview ${color.name}`} className={active?.key === color.key ? 'active' : ''} style={{ background: color.hex }} onClick={() => setActiveKey(color.key)} />)}</div><strong>{state.name || 'Product name'}</strong><span>{active?.name} · {state.priceIqd ? `${Number(state.priceIqd).toLocaleString('en-US')} IQD` : '—'}</span><small>Photo position stays the same when switching colors, exactly like the storefront.</small>{!isNew && <button className="admin-btn admin-btn-danger-ghost admin-btn-sm admin-delete" onClick={destroy}><Trash2 size={14} /> {tr('Delete product')}</button>}</aside>
    </div>
    <ProductContentEditor value={state.details} onChange={details => update({ details })} language={language === 'ar' ? 'ar' : 'en'} />
    <div className="admin-savebar"><span>{dirty ? tr('You have unsaved changes.') : tr('All changes saved.')}</span><button className="admin-btn admin-btn-primary" onClick={save} disabled={saving}>{saving ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />} {isNew ? tr('Create product') : tr('Save changes')}</button></div>
  </main>;
}
