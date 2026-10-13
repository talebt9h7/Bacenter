'use client';
import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { HIGHLIGHT_ICONS, LIMITS, formatDimensions, formatWarranty, formatWeight, youtubeId, type HighlightIcon, type ProductDetails } from '@/lib/product-details';

type Props = { value: ProductDetails; onChange: (next: ProductDetails) => void; language: 'ar' | 'en' };

const move = <T,>(items: T[], index: number, by: number) => {
  const target = index + by;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};
const numberOrNull = (text: string) => text.trim() === '' ? null : Number(text);

async function uploadImage(file: File) {
  const form = new FormData();
  form.append('files', file);
  const response = await fetch('/api/admin/media', { method: 'POST', body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Upload failed.');
  return data.urls[0] as string;
}

/**
 * Everything shown under "Add to cart" on the product page, in Arabic and English:
 * headline, highlights with icons, features, specifications (with measured dimensions),
 * warranty, materials and lifestyle photos. Each block is hidden on the storefront when empty.
 */
export function ProductContentEditor({ value, onChange, language }: Props) {
  const ar = language === 'ar';
  const L = (en: string, arText: string) => (ar ? arText : en);
  const set = (patch: Partial<ProductDetails>) => onChange({ ...value, ...patch });
  const [busy, setBusy] = useState<'dimensions' | 'story' | null>(null);
  const [error, setError] = useState('');
  const dimensionsInput = useRef<HTMLInputElement>(null);
  const storyInput = useRef<HTMLInputElement>(null);

  async function upload(kind: 'dimensions' | 'story', files: FileList | null) {
    if (!files?.length) return;
    setBusy(kind); setError('');
    try {
      if (kind === 'dimensions') set({ dimensionsImage: await uploadImage(files[0]) });
      else {
        const urls: string[] = [];
        for (const file of Array.from(files).slice(0, LIMITS.story - value.story.length)) urls.push(await uploadImage(file));
        set({ story: [...value.story, ...urls.map(image => ({ image, caption: '', captionAr: '' }))] });
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.'); }
    finally { setBusy(null); if (dimensionsInput.current) dimensionsInput.current.value = ''; if (storyInput.current) storyInput.current.value = ''; }
  }

  const dimensionsPreview = formatDimensions(value, language);
  const weightPreview = formatWeight(value, language);
  const warrantyPreview = formatWarranty(value.warrantyMonths, language);

  return <section className="admin-card product-content-editor">
    <div className="admin-card-heading"><h2>{L('Product page content', 'محتوى صفحة المنتج')}</h2></div>
    <p className="admin-hint">{L('Shown under Add to cart, in this order. Leave a block empty to hide it. Fill both languages; if one is empty the other is shown.', 'يظهر تحت زر الإضافة للسلة بنفس هذا الترتيب. اترك أي قسم فارغاً حتى يختفي. املأ اللغتين، وإذا وحدة فارغة تظهر الثانية.')}</p>
    {error && <p className="admin-error" role="alert">{error}</p>}

    <h3 className="pce-title">{L('1. Headline', '1. العنوان التعريفي')}</h3>
    <div className="pce-pair">
      <label className="admin-field"><span>العربية</span><input id="pce-headline-ar" dir="rtl" maxLength={LIMITS.headline} value={value.headlineAr} onChange={e => set({ headlineAr: e.target.value })} placeholder="محفظة نحيفة بجيب مخفي للنقود" /></label>
      <label className="admin-field"><span>English</span><input id="pce-headline-en" dir="ltr" maxLength={LIMITS.headline} value={value.headline} onChange={e => set({ headline: e.target.value })} placeholder="A slim wallet with hidden cash storage" /></label>
    </div>

    <h3 className="pce-title">{L('2. Highlights (icon + short line)', '2. المميزات السريعة (أيقونة + سطر قصير)')}</h3>
    <div className="pce-rows">
      {value.highlights.map((item, index) => <div className="pce-row" key={index}>
        <select id={`pce-hl-icon-${index}`} aria-label={L('Icon', 'الأيقونة')} value={item.icon} onChange={e => set({ highlights: value.highlights.map((h, i) => i === index ? { ...h, icon: e.target.value as HighlightIcon } : h) })}>
          {(Object.keys(HIGHLIGHT_ICONS) as HighlightIcon[]).map(key => <option key={key} value={key}>{ar ? HIGHLIGHT_ICONS[key].ar : HIGHLIGHT_ICONS[key].en}</option>)}
        </select>
        <input id={`pce-hl-ar-${index}`} dir="rtl" aria-label="العربية" maxLength={120} value={item.textAr} onChange={e => set({ highlights: value.highlights.map((h, i) => i === index ? { ...h, textAr: e.target.value } : h) })} placeholder="يتسع لـ 9 بطاقات" />
        <input id={`pce-hl-en-${index}`} dir="ltr" aria-label="English" maxLength={120} value={item.text} onChange={e => set({ highlights: value.highlights.map((h, i) => i === index ? { ...h, text: e.target.value } : h) })} placeholder="Holds 9 cards" />
        <RowTools onUp={() => set({ highlights: move(value.highlights, index, -1) })} onDown={() => set({ highlights: move(value.highlights, index, 1) })} onRemove={() => set({ highlights: value.highlights.filter((_, i) => i !== index) })} ar={ar} />
      </div>)}
      {value.highlights.length < LIMITS.highlights && <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => set({ highlights: [...value.highlights, { icon: 'cards', text: '', textAr: '' }] })}><Plus size={14} /> {L('Add highlight', 'إضافة ميزة')}</button>}
    </div>

    <h3 className="pce-title">{L('3. Features (one short point per line)', '3. التفاصيل (نقطة قصيرة بكل سطر)')}</h3>
    <div className="pce-pair">
      <label className="admin-field"><span>العربية</span><textarea id="pce-features-ar" dir="rtl" rows={6} value={value.featuresAr.join('\n')} onChange={e => set({ featuresAr: e.target.value.split('\n') })} placeholder={'جلد طبيعي Full Grain\nمشبك معدني للنقود\nإغلاق مغناطيسي'} /></label>
      <label className="admin-field"><span>English</span><textarea id="pce-features-en" dir="ltr" rows={6} value={value.features.join('\n')} onChange={e => set({ features: e.target.value.split('\n') })} placeholder={'Full grain leather\nMetal money clip\nMagnetic closure'} /></label>
    </div>
    <p className="admin-hint">{L(`Up to ${LIMITS.features} points, ${LIMITS.featureLength} characters each. Put long paragraphs in the description instead.`, `حتى ${LIMITS.features} نقطة، كل نقطة لحد ${LIMITS.featureLength} حرف. الفقرات الطويلة مكانها الوصف.`)}</p>

    <h3 className="pce-title">{L('4. Specifications', '4. المواصفات')}</h3>
    <div className="pce-measures">
      <label className="admin-field"><span>{L('Length (cm)', 'الطول (سم)')}</span><input id="pce-length" type="number" min="0" step="0.1" value={value.lengthCm ?? ''} onChange={e => set({ lengthCm: numberOrNull(e.target.value) })} placeholder="11.5" /></label>
      <label className="admin-field"><span>{L('Width (cm)', 'العرض (سم)')}</span><input id="pce-width" type="number" min="0" step="0.1" value={value.widthCm ?? ''} onChange={e => set({ widthCm: numberOrNull(e.target.value) })} placeholder="8" /></label>
      <label className="admin-field"><span>{L('Depth (cm)', 'السمك (سم)')}</span><input id="pce-depth" type="number" min="0" step="0.1" value={value.depthCm ?? ''} onChange={e => set({ depthCm: numberOrNull(e.target.value) })} placeholder="1.5" /></label>
      <label className="admin-field"><span>{L('Weight (g)', 'الوزن (غم)')}</span><input id="pce-weight" type="number" min="0" step="1" value={value.weightG ?? ''} onChange={e => set({ weightG: numberOrNull(e.target.value) })} placeholder="60" /></label>
    </div>
    {(dimensionsPreview || weightPreview) && <p className="admin-hint">{L('Shown as', 'تظهر هكذا')}: {[dimensionsPreview, weightPreview].filter(Boolean).join(' · ')}</p>}
    <div className="pce-rows">
      {value.specs.map((row, index) => <div className="pce-row pce-row-spec" key={index}>
        <input id={`pce-spec-label-ar-${index}`} dir="rtl" aria-label={L('Label (Arabic)', 'العنوان (عربي)')} maxLength={80} value={row.labelAr} onChange={e => set({ specs: value.specs.map((s, i) => i === index ? { ...s, labelAr: e.target.value } : s) })} placeholder="عدد البطاقات" />
        <input id={`pce-spec-value-ar-${index}`} dir="rtl" aria-label={L('Value (Arabic)', 'القيمة (عربي)')} maxLength={300} value={row.valueAr} onChange={e => set({ specs: value.specs.map((s, i) => i === index ? { ...s, valueAr: e.target.value } : s) })} placeholder="9 بطاقات" />
        <input id={`pce-spec-label-en-${index}`} dir="ltr" aria-label="Label (English)" maxLength={80} value={row.label} onChange={e => set({ specs: value.specs.map((s, i) => i === index ? { ...s, label: e.target.value } : s) })} placeholder="Cards" />
        <input id={`pce-spec-value-en-${index}`} dir="ltr" aria-label="Value (English)" maxLength={300} value={row.value} onChange={e => set({ specs: value.specs.map((s, i) => i === index ? { ...s, value: e.target.value } : s) })} placeholder="9 cards" />
        <RowTools onUp={() => set({ specs: move(value.specs, index, -1) })} onDown={() => set({ specs: move(value.specs, index, 1) })} onRemove={() => set({ specs: value.specs.filter((_, i) => i !== index) })} ar={ar} />
      </div>)}
      {value.specs.length < LIMITS.specs && <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => set({ specs: [...value.specs, { label: '', labelAr: '', value: '', valueAr: '' }] })}><Plus size={14} /> {L('Add specification', 'إضافة مواصفة')}</button>}
    </div>
    <div className="admin-field">
      <span>{L('Dimensions diagram (optional)', 'رسم الأبعاد (اختياري)')}</span>
      <input ref={dimensionsInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => void upload('dimensions', e.target.files)} />
      <div className="pce-image-tools">
        {value.dimensionsImage && <img src={value.dimensionsImage.startsWith('/api/media/') ? `${value.dimensionsImage}?w=320` : value.dimensionsImage} alt="" />}
        <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" disabled={busy !== null} onClick={() => dimensionsInput.current?.click()}>{busy === 'dimensions' ? <LoaderCircle size={14} className="spin" /> : <ImagePlus size={14} />} {value.dimensionsImage ? L('Replace', 'تغيير') : L('Upload', 'رفع')}</button>
        {value.dimensionsImage && <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => set({ dimensionsImage: '' })}>{L('Remove', 'إزالة')}</button>}
      </div>
    </div>

    <h3 className="pce-title">{L('5. Warranty', '5. الضمان')}</h3>
    <label className="admin-field pce-narrow"><span>{L('Warranty period (months)', 'مدة الضمان (بالأشهر)')}</span><input id="pce-warranty-months" type="number" min="0" step="1" value={value.warrantyMonths ?? ''} onChange={e => set({ warrantyMonths: numberOrNull(e.target.value) })} placeholder="12" />{warrantyPreview && <small>{L('Shown as', 'تظهر')}: {ar ? `ضمان ${warrantyPreview}` : `${warrantyPreview} warranty`}</small>}</label>
    <div className="pce-pair">
      <label className="admin-field"><span>العربية</span><textarea id="pce-warranty-ar" dir="rtl" rows={3} value={value.warrantyAr} onChange={e => set({ warrantyAr: e.target.value })} placeholder="يشمل الضمان عيوب الخياطة والمواد…" /></label>
      <label className="admin-field"><span>English</span><textarea id="pce-warranty-en" dir="ltr" rows={3} value={value.warranty} onChange={e => set({ warranty: e.target.value })} placeholder="Covers stitching and material defects…" /></label>
    </div>

    <h3 className="pce-title">{L('6. Materials & care', '6. المواد والعناية')}</h3>
    <div className="pce-pair">
      <label className="admin-field"><span>العربية</span><textarea id="pce-materials-ar" dir="rtl" rows={3} value={value.materialsAr} onChange={e => set({ materialsAr: e.target.value })} placeholder="جلد بقري طبيعي، بطانة قماشية…" /></label>
      <label className="admin-field"><span>English</span><textarea id="pce-materials-en" dir="ltr" rows={3} value={value.materials} onChange={e => set({ materials: e.target.value })} placeholder="Natural cowhide leather, fabric lining…" /></label>
    </div>

    <h3 className="pce-title">{L('7. Lifestyle photos', '7. صور الاستخدام')}</h3>
    <p className="admin-hint">{L('Exactly two photos are shown side by side (for example "Day 1" and "Day 1000"); more are shown as a row you can swipe.', 'إذا حطيت صورتين بالضبط تظهر جنب بعض، مثلاً "اليوم الأول" و"بعد 1000 يوم". أكثر من صورتين تظهر كشريط يتسحب.')}</p>
    <div className="pce-rows">
      {value.story.map((item, index) => <div className="pce-row pce-row-story" key={item.image + index}>
        <img src={item.image.startsWith('/api/media/') ? `${item.image}?w=160` : item.image} alt="" />
        <input id={`pce-story-ar-${index}`} dir="rtl" aria-label={L('Caption (Arabic)', 'التعليق (عربي)')} maxLength={60} value={item.captionAr} onChange={e => set({ story: value.story.map((s, i) => i === index ? { ...s, captionAr: e.target.value } : s) })} placeholder="اليوم الأول" />
        <input id={`pce-story-en-${index}`} dir="ltr" aria-label="Caption (English)" maxLength={60} value={item.caption} onChange={e => set({ story: value.story.map((s, i) => i === index ? { ...s, caption: e.target.value } : s) })} placeholder="Day 1" />
        <RowTools onUp={() => set({ story: move(value.story, index, -1) })} onDown={() => set({ story: move(value.story, index, 1) })} onRemove={() => set({ story: value.story.filter((_, i) => i !== index) })} ar={ar} />
      </div>)}
      <input ref={storyInput} type="file" multiple accept="image/jpeg,image/png,image/webp" hidden onChange={e => void upload('story', e.target.files)} />
      {value.story.length < LIMITS.story && <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" disabled={busy !== null} onClick={() => storyInput.current?.click()}>{busy === 'story' ? <LoaderCircle size={14} className="spin" /> : <ImagePlus size={14} />} {L('Upload photos', 'رفع صور')}</button>}
    </div>

    <h3 className="pce-title">{L('8. Product video (YouTube)', '8. فيديو المنتج (يوتيوب)')}</h3>
    <p className="admin-hint">{L('Paste a YouTube link. It appears near the end of the product page, above the closing image.', 'الصق رابط فيديو من يوتيوب. يظهر قرب نهاية صفحة المنتج، فوق الصورة الأخيرة.')}</p>
    <label className="admin-field"><span>{L('YouTube link', 'رابط يوتيوب')}</span><input id="pce-video-url" dir="ltr" value={value.videoId} onChange={e => set({ videoId: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" />{value.videoId.trim() !== '' && !youtubeId(value.videoId) && <small style={{ color: 'var(--a-danger)' }}>{L('Not a valid YouTube link', 'الرابط مو رابط يوتيوب صحيح')}</small>}</label>
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0 10px', fontSize: 13 }}><input id="pce-video-wide" type="checkbox" checked={value.videoWide} onChange={e => set({ videoWide: e.target.checked })} /> {L('Wide video (16:9). Leave off for Shorts / reels (vertical).', 'فيديو عريض (16:9). خليه مطفي للشورت والريلز (عمودي).')}</label>
    {youtubeId(value.videoId) && <img className="pce-video-thumb" src={`https://i.ytimg.com/vi/${youtubeId(value.videoId)}/hqdefault.jpg`} alt="" style={value.videoWide ? { width: 240, borderRadius: 10, aspectRatio: '16/9', objectFit: 'cover' } : { width: 140, borderRadius: 12, aspectRatio: '9/16', objectFit: 'cover' }} />}
    <div className="pce-pair">
      <label className="admin-field"><span>{L('Title (Arabic)', 'العنوان (عربي)')}</span><input id="pce-video-title-ar" dir="rtl" maxLength={120} value={value.videoTitleAr} onChange={e => set({ videoTitleAr: e.target.value })} placeholder="شاهد المنتج" /></label>
      <label className="admin-field"><span>{L('Title (English)', 'العنوان (إنكليزي)')}</span><input id="pce-video-title-en" dir="ltr" maxLength={120} value={value.videoTitle} onChange={e => set({ videoTitle: e.target.value })} placeholder="See it in action" /></label>
    </div>
  </section>;
}

function RowTools({ onUp, onDown, onRemove, ar }: { onUp: () => void; onDown: () => void; onRemove: () => void; ar: boolean }) {
  return <div className="pce-row-tools">
    <button type="button" className="admin-icon-btn" onClick={onUp} aria-label={ar ? 'تحريك للأعلى' : 'Move up'}><ArrowUp size={14} /></button>
    <button type="button" className="admin-icon-btn" onClick={onDown} aria-label={ar ? 'تحريك للأسفل' : 'Move down'}><ArrowDown size={14} /></button>
    <button type="button" className="admin-icon-btn" onClick={onRemove} aria-label={ar ? 'حذف' : 'Remove'}><Trash2 size={14} /></button>
  </div>;
}
