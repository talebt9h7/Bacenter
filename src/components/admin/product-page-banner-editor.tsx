'use client';
import { useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, Save, Trash2 } from 'lucide-react';
import type { ProductPageBanner } from '@/lib/product-page-banner';

async function uploadImage(file: File) {
  const form = new FormData();
  form.append('files', file);
  const response = await fetch('/api/admin/media', { method: 'POST', body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Upload failed.');
  return data.urls[0] as string;
}
const preview = (url: string) => url.startsWith('/api/media/') ? `${url}?w=640` : url;

/** Admin → Content: the closing image shown at the end of every product page. */
export function ProductPageBannerEditor({ initial, language }: { initial: ProductPageBanner; language: 'ar' | 'en' }) {
  const ar = language === 'ar';
  const L = (en: string, arText: string) => (ar ? arText : en);
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState<'image' | 'mobileImage' | 'save' | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const desktopInput = useRef<HTMLInputElement>(null);
  const mobileInput = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<ProductPageBanner>) => { setValue(v => ({ ...v, ...patch })); setMessage(null); };

  async function upload(field: 'image' | 'mobileImage', files: FileList | null) {
    const file = files?.[0]; if (!file) return;
    setBusy(field);
    try { const url = await uploadImage(file); set({ [field]: url, ...(field === 'image' && !value.image ? { enabled: true } : {}) }); }
    catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Upload failed.' }); }
    finally { setBusy(null); if (desktopInput.current) desktopInput.current.value = ''; if (mobileInput.current) mobileInput.current.value = ''; }
  }
  async function save() {
    setBusy('save');
    try {
      const response = await fetch('/api/admin/product-page-banner', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Save failed.');
      setValue(data.banner);
      setMessage({ ok: true, text: L('Saved. It shows at the end of every product page.', 'انحفظت. تظهر بنهاية كل صفحة منتج.') });
    } catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Save failed.' }); }
    finally { setBusy(null); }
  }

  const slot = (field: 'image' | 'mobileImage', label: string, hint: string, input: React.RefObject<HTMLInputElement | null>) => <div className="ppb-slot">
    <span className="ppb-label">{label}</span>
    {value[field] ? <img src={preview(value[field])} alt="" /> : <div className="ppb-empty">{hint}</div>}
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => void upload(field, e.target.files)} />
    <div className="ppb-actions">
      <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" disabled={busy !== null} onClick={() => input.current?.click()}>{busy === field ? <LoaderCircle size={14} className="spin" /> : <ImagePlus size={14} />} {value[field] ? L('Replace', 'تبديل') : L('Upload', 'رفع')}</button>
      {value[field] && <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" disabled={busy !== null} onClick={() => set({ [field]: '', ...(field === 'image' ? { enabled: false } : {}) })}><Trash2 size={14} /> {L('Remove', 'حذف')}</button>}
    </div>
  </div>;

  return <section className="admin-card" id="product-page-image">
    <div className="admin-card-heading"><h2>{L('Product page image', 'صورة نهاية صفحة المنتج')}</h2><p>{L('One wide image shown at the end of every product page, under the product video (for example "Day 1 / Day 1000"). Best size: 2400 × 1000 px. An optional mobile version can be taller.', 'صورة عريضة وحدة تظهر بنهاية كل صفحة منتج، تحت فيديو المنتج (مثل "اليوم الأول / بعد 1000 يوم"). أفضل قياس: 2400 × 1000 بكسل. تكدر تحط نسخة للموبايل بطول أكبر (اختياري).')}</p></div>
    <label className="admin-check" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}><input type="checkbox" checked={value.enabled} disabled={!value.image} onChange={e => set({ enabled: e.target.checked })} /> <span>{L('Show on product pages', 'إظهارها بصفحات المنتجات')}</span></label>
    <div className="ppb-slots">
      {slot('image', L('Image (desktop)', 'الصورة (كمبيوتر)'), L('No image yet', 'ماكو صورة بعد'), desktopInput)}
      {slot('mobileImage', L('Mobile image (optional)', 'صورة الموبايل (اختياري)'), L('Uses the desktop image', 'تستخدم صورة الكمبيوتر'), mobileInput)}
    </div>
    <div className="admin-form-grid ppb-fields">
      <label className="admin-field"><span>{L('Description (Arabic)', 'وصف الصورة (عربي)')}</span><input dir="rtl" maxLength={160} value={value.altAr} onChange={e => set({ altAr: e.target.value })} placeholder="الجلد باليوم الأول وبعد 1000 يوم" /></label>
      <label className="admin-field"><span>{L('Description (English)', 'وصف الصورة (إنكليزي)')}</span><input dir="ltr" maxLength={160} value={value.alt} onChange={e => set({ alt: e.target.value })} placeholder="Leather on day 1 and day 1000" /></label>
      <label className="admin-field"><span>{L('Link (optional)', 'رابط عند الضغط (اختياري)')}</span><input dir="ltr" maxLength={300} value={value.href} onChange={e => set({ href: e.target.value })} placeholder="/pages/leather-care" /></label>
    </div>
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
      <button type="button" className="admin-btn admin-btn-primary" disabled={busy !== null} onClick={() => void save()}>{busy === 'save' ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />} {L('Save', 'حفظ')}</button>
      {message && <span role="status" style={{ fontSize: 13, color: message.ok ? 'var(--a-success)' : 'var(--a-danger)' }}>{message.text}</span>}
    </div>
  </section>;
}
