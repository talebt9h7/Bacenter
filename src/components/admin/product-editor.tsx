'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, ImagePlus, Link2, LoaderCircle, Minus, Plus, Save, Star, Trash2, X } from 'lucide-react';
import { PLACEHOLDER_IMAGE, type Product } from '@/lib/types';
import { useLanguage } from '@/components/language-provider';
import { productT } from '@/lib/i18n';

type EditorColor = { key: string; id?: number; name: string; nameAr: string; hex: string; stock: number; images: string[]; primaryIndex: number };
type EditorState = { id: string; name: string; nameAr: string; subtitle: string; subtitleAr: string; description: string; descriptionAr: string; price: string; priceIqd: string; purchasePriceUsd: string; category: string; capacity: string; badge: string; features: string; dimensions: string; tags: string; published: boolean; colors: EditorColor[] };

let keyCounter = 0;
const nextKey = () => `c${Date.now()}-${keyCounter++}`;
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
function toState(product: Product | null, exchangeRate: number): EditorState {
  if (!product) return { id: '', name: '', nameAr: '', subtitle: '', subtitleAr: '', description: '', descriptionAr: '', price: '', priceIqd: '', purchasePriceUsd: '', category: 'backpacks', capacity: '', badge: '', features: '', dimensions: '', tags: '', published: true, colors: [{ key: nextKey(), name: 'Black', nameAr: 'أسود', hex: '#333333', stock: 0, images: [], primaryIndex: 0 }] };
  return { id: product.id, name: product.name, nameAr: product.nameAr, subtitle: product.subtitle, subtitleAr: product.subtitleAr, description: product.description, descriptionAr: product.descriptionAr, price: String(product.price), priceIqd: String(product.salePriceIqd || Math.round(product.price * exchangeRate)), purchasePriceUsd: '', category: product.category, capacity: product.capacity ?? '', badge: product.badge ?? '', features: product.features.join('\n'), dimensions: product.dimensions, tags: product.tags.join(', '), published: product.published, colors: product.colors.map(color => ({ key: nextKey(), id: color.id, name: color.name, nameAr: color.nameAr, hex: color.hex, stock: color.stock, images: [...color.images], primaryIndex: color.primaryIndex })) };
}

export function ProductEditor({ initial, initialColorId, exchangeRate, categories }: { initial: Product | null; initialColorId?: number; exchangeRate: number; categories: { id: string; name: string }[] }) {
  const { language } = useLanguage();
  const tr = (label: keyof typeof import('@/lib/i18n').productTranslations) => productT(label, language);
  const router = useRouter();
  const [state, setState] = useState<EditorState>(() => toState(initial, exchangeRate));
  const [activeKey, setActiveKey] = useState<string>(() => { const s = toState(initial, exchangeRate); return (initialColorId && s.colors.find(c => c.id === initialColorId)?.key) || s.colors[0]?.key || ''; });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [previewIndex, setPreviewIndex] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const isNew = !initial;
  const active = state.colors.find(color => color.key === activeKey) ?? state.colors[0];
  const totalStock = useMemo(() => state.colors.reduce((sum, color) => sum + (Number(color.stock) || 0), 0), [state.colors]);
  useEffect(() => { if (!dirty) return; const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty]);
  useEffect(() => { if (!message || message.error) return; const timer = setTimeout(() => setMessage(null), 4000); return () => clearTimeout(timer); }, [message]);
  function update(patch: Partial<EditorState>) { setState(current => ({ ...current, ...patch })); setDirty(true); }
  function updateColor(key: string, patch: Partial<EditorColor> | ((color: EditorColor) => Partial<EditorColor>)) { setState(current => ({ ...current, colors: current.colors.map(color => color.key === key ? { ...color, ...(typeof patch === 'function' ? patch(color) : patch) } : color) })); setDirty(true); }
  function addColor(duplicateFrom?: EditorColor) { const color: EditorColor = { key: nextKey(), name: duplicateFrom ? `${duplicateFrom.name} copy` : 'New color', nameAr: duplicateFrom ? `${duplicateFrom.nameAr} نسخة` : 'لون جديد', hex: duplicateFrom?.hex ?? '#8a8a8a', stock: 0, images: duplicateFrom ? [...duplicateFrom.images] : [], primaryIndex: duplicateFrom?.primaryIndex ?? 0 }; update({ colors: [...state.colors, color] }); setActiveKey(color.key); }
  function removeColor(key: string) { if (state.colors.length === 1) { setMessage({ text: tr('A product needs at least one color.'), error: true }); return; } const remaining = state.colors.filter(color => color.key !== key); update({ colors: remaining }); if (activeKey === key) setActiveKey(remaining[0].key); }
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
    if (isNew) { const initialStock = state.colors.reduce((sum, color) => sum + (Number(color.stock) || 0), 0); const purchasePrice = Number(state.purchasePriceUsd); if (initialStock > 0 && (!Number.isFinite(purchasePrice) || purchasePrice < 0)) { setMessage({ text: language === 'ar' ? 'أدخل تكلفة الشراء للوحدة بالدولار لأن المخزون الأولي أكبر من صفر.' : 'Enter the purchase cost per unit in USD because the initial stock is greater than zero.', error: true }); setSaving(false); return; } }
    const priceIqd = Number(state.priceIqd);
    if (!Number.isFinite(priceIqd) || priceIqd < 0) { setMessage({ text: language === 'ar' ? 'أدخل سعر البيع بالدينار العراقي.' : 'Enter the sale price in IQD.', error: true }); setSaving(false); return; }
    const priceUsd = priceIqd / exchangeRate;
    const payload = { id: isNew ? slugify(state.id || state.name) : state.id, name: state.name, nameAr: state.nameAr || state.name, subtitle: state.subtitle, subtitleAr: state.subtitleAr || state.subtitle, description: state.description, descriptionAr: state.descriptionAr || state.description, price: priceUsd, salePriceIqd: Math.round(priceIqd), purchasePriceUsd: isNew && state.purchasePriceUsd.trim() ? Number(state.purchasePriceUsd) : null, exchangeRate, category: state.category, capacity: state.capacity || null, badge: state.badge || null, features: state.features.split('\n').map(line => line.trim()).filter(Boolean), dimensions: state.dimensions, tags: state.tags.split(',').map(tag => tag.trim()).filter(Boolean), published: state.published, colors: state.colors.map(color => ({ id: color.id, name: color.name, nameAr: color.nameAr, hex: color.hex, stock: Number(color.stock) || 0, images: color.images, primaryIndex: color.primaryIndex })) };
    try {
      const response = await fetch(isNew ? '/api/admin/products' : `/api/admin/products/${state.id}`, { method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setDirty(false); setMessage({ text: isNew ? 'Product created. You can keep editing it here.' : 'Saved. The storefront is up to date.', error: false });
      if (isNew) router.replace(`/admin/products/${data.product.id}`); else { const fresh = toState(data.product, exchangeRate); setState(fresh); setActiveKey(fresh.colors[Math.max(0, state.colors.findIndex(color => color.key === activeKey))]?.key ?? fresh.colors[0].key); router.refresh(); }
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
    <div className="admin-page-heading"><div><Link href="/admin/products" className="admin-link"><ArrowLeft size={14} /> {tr('All products')}</Link><h1>{isNew ? tr('New product') : state.name || 'Untitled product'}</h1><p>{isNew ? 'Set up the basics, then add each color with its own stock and photos.' : <>{state.colors.length} color{state.colors.length === 1 ? '' : 's'} · {totalStock} units in stock · <a href={`/products/${state.id}`} target="_blank" rel="noreferrer" className="admin-link">{tr('View on storefront')} <ExternalLink size={12} /></a></>}</p></div><div className="admin-heading-actions"><label className="admin-switch"><input type="checkbox" checked={state.published} onChange={event => update({ published: event.target.checked })} /><span /> {state.published ? tr('Published') : tr('Draft')}</label><button className="admin-btn admin-btn-primary" onClick={save} disabled={saving}>{saving ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />} {isNew ? tr('Create product') : tr('Save changes')}</button></div></div>
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
        {isNew && <label className="admin-field"><span>{tr('Purchase cost / unit (USD)')}</span><input type="number" min="0" step="0.01" value={state.purchasePriceUsd} onChange={event => update({ purchasePriceUsd: event.target.value })} placeholder="11.00" /><small>Used for the initial stock batch. The exchange rate at purchase is saved with the batch.</small></label>}
        <label className="admin-field"><span>{tr('Category')}</span><select value={state.category} onChange={event => update({ category: event.target.value })}>{categories.filter(item => item.id !== 'all').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="admin-field"><span>{tr('Capacity / size')}</span><input value={state.capacity} onChange={event => update({ capacity: event.target.value })} placeholder="20L" /></label>
        <label className="admin-field"><span>{tr('Badge')}</span><input value={state.badge} onChange={event => update({ badge: event.target.value })} placeholder="NEW, BESTSELLER…" /></label>
        
        
        <label className="admin-field span-2"><span>{tr('Design insights')} <small>(one per line)</small></span><textarea rows={5} value={state.features} onChange={event => update({ features: event.target.value })} /></label>
        <label className="admin-field"><span>{tr('Dimensions')}</span><input value={state.dimensions} onChange={event => update({ dimensions: event.target.value })} placeholder="500 × 320 × 180 mm" /></label>
        <label className="admin-field"><span>{tr('Collections / tags')} <small>(comma separated)</small></span><input value={state.tags} onChange={event => update({ tags: event.target.value })} placeholder="bestsellers, travel, work" /></label>
      </div></section>

      <section className="admin-card admin-colors-card"><div className="admin-card-heading"><h2>{tr('Colors, stock & photos')}</h2><button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => addColor()}><Plus size={14} /> {tr('Add color')}</button></div>
        <div className="admin-color-tabs" role="tablist" aria-label={tr('Colors')}>{state.colors.map(color => <button key={color.key} role="tab" aria-selected={active?.key === color.key} className={`admin-color-tab ${active?.key === color.key ? 'active' : ''}`} onClick={() => { setActiveKey(color.key); setPreviewIndex(color.primaryIndex); }}><i style={{ background: color.hex }} /><span>{color.name || 'Untitled'}</span><b className={color.stock === 0 ? 'danger' : color.stock <= 5 ? 'warning' : ''}>{color.stock}</b><small>{color.images.length} photo{color.images.length === 1 ? '' : 's'}</small></button>)}</div>
        {active && <div className="admin-variant">
          <div className="admin-variant-fields">
            <label className="admin-field"><span>{language === 'ar' ? 'اسم اللون — English' : 'Color name — English'}</span><input value={active.name} onChange={event => updateColor(active.key, { name: event.target.value })} dir="ltr" /></label><label className="admin-field"><span>{language === 'ar' ? 'اسم اللون — العربية' : 'Color name — Arabic'}</span><input value={active.nameAr} onChange={event => updateColor(active.key, { nameAr: event.target.value })} dir="rtl" /></label>
            <label className="admin-field"><span>{tr('Swatch')}</span><div className="admin-hex"><input type="color" value={/^#[0-9a-f]{6}$/i.test(active.hex) ? active.hex : '#333333'} onChange={event => updateColor(active.key, { hex: event.target.value })} aria-label={tr('Swatch')} /><input value={active.hex} onChange={event => updateColor(active.key, { hex: event.target.value })} maxLength={7} /></div></label>
            <div className="admin-field"><span>{tr('Stock for this color')}</span><div className="admin-stepper"><button type="button" aria-label="Decrease stock" onClick={() => updateColor(active.key, color => ({ stock: Math.max(0, (Number(color.stock) || 0) - 1) }))}><Minus size={14} /></button><input type="number" min="0" value={active.stock} onChange={event => updateColor(active.key, { stock: Math.max(0, Math.floor(Number(event.target.value) || 0)) })} aria-label="Stock quantity" /><button type="button" aria-label="Increase stock" onClick={() => updateColor(active.key, color => ({ stock: (Number(color.stock) || 0) + 1 }))}><Plus size={14} /></button></div><small>{active.stock === 0 ? tr('Shown as sold out on the storefront.') : active.stock <= 5 ? tr('Customers will see “Only a few left”.') : tr('In stock.')}</small></div>
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
    <div className="admin-savebar"><span>{dirty ? tr('You have unsaved changes.') : tr('All changes saved.')}</span><button className="admin-btn admin-btn-primary" onClick={save} disabled={saving}>{saving ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />} {isNew ? tr('Create product') : tr('Save changes')}</button></div>
  </main>;
}
