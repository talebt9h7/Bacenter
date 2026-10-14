'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Check, Clock, EyeOff, LoaderCircle, MessageSquareReply, Plus, Star, Trash2, X } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { api, Modal, useFlash } from './ui';
import { Card, Kpi, PageHero } from './dash-ui';

export type AdminReview = { id: number; productId: string; productName: string; productNameAr: string; name: string; city: string; phone: string; rating: number; title: string; body: string; verified: boolean; status: 'pending' | 'approved' | 'hidden'; reply: string; orderId: number | null; createdAt: string };
const stars = (n: number) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);

/** Admin → Reviews: approve what customers wrote, reply publicly, and add reviews received on WhatsApp. */
export function ReviewsManager({ initial, products }: { initial: AdminReview[]; products: { id: string; name: string; nameAr: string }[] }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, a: string) => ar ? a : en;
  const lang = ar ? 'ar' : 'en';
  const [rows, setRows] = useState(initial);
  const [tab, setTab] = useState<'pending' | 'approved' | 'hidden' | 'all'>(initial.some(r => r.status === 'pending') ? 'pending' : 'all');
  const [busy, setBusy] = useState<number | null>(null);
  const [replying, setReplying] = useState<AdminReview | null>(null);
  const [adding, setAdding] = useState(false);
  const { flash, success, fail } = useFlash();
  const approved = rows.filter(r => r.status === 'approved');
  const avg = approved.length ? Math.round(approved.reduce((s, r) => s + r.rating, 0) / approved.length * 10) / 10 : 0;
  const visible = rows.filter(r => tab === 'all' || r.status === tab);

  async function setStatus(r: AdminReview, status: AdminReview['status']) {
    setBusy(r.id);
    try { await api(`/api/admin/reviews/${r.id}`, { method: 'PATCH', json: { status } }); setRows(rs => rs.map(x => x.id === r.id ? { ...x, status } : x)); success(status === 'approved' ? tt('Published on the product page.', 'انعرض بصفحة المنتج.') : tt('Hidden.', 'انخفى.')); }
    catch (e) { fail(e); } finally { setBusy(null); }
  }
  async function remove(r: AdminReview) {
    if (!confirm(tt('Delete this review?', 'تمسح هذا التقييم؟'))) return;
    setBusy(r.id);
    try { await api(`/api/admin/reviews/${r.id}`, { method: 'DELETE' }); setRows(rs => rs.filter(x => x.id !== r.id)); }
    catch (e) { fail(e); } finally { setBusy(null); }
  }

  return <main className="admin-page dash">
    {flash}
    <PageHero eyebrow={tt('Sales', 'المبيعات')} title={tt('Customer reviews', 'تقييمات الزبائن')} description={tt('Reviews appear on the product page only after you approve them. “Verified” means the phone number bought that product.', 'التقييم ما يظهر بصفحة المنتج إلا بعد ما توافق عليه. "موثّق" يعني الرقم اشترى هذا المنتج فعلاً.')} actions={<button type="button" className="admin-btn admin-btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> {tt('Add a review', 'إضافة تقييم')}</button>} />
    <section className="dash-kpis" data-cols="4">
      <Kpi lang={lang} icon={<Clock size={17} />} tone={rows.some(r => r.status === 'pending') ? 'danger' : 'success'} label={tt('Waiting for approval', 'بانتظار الموافقة')} value={rows.filter(r => r.status === 'pending').length} />
      <Kpi lang={lang} delay={50} icon={<Star size={17} />} tone="gold" label={tt('Average rating', 'متوسط التقييم')} value={avg} format={v => v.toFixed(1)} note={tt('approved reviews', 'التقييمات المعروضة')} />
      <Kpi lang={lang} delay={100} icon={<Check size={17} />} tone="success" label={tt('Published', 'معروضة')} value={approved.length} />
      <Kpi lang={lang} delay={150} icon={<BadgeCheck size={17} />} tone="blue" label={tt('Verified purchases', 'مشترين موثّقين')} value={rows.filter(r => r.verified).length} />
    </section>
    <Card title={tt('Reviews', 'التقييمات')} icon={<Star size={16} />} action={<div className="admin-segmented">{(['pending', 'approved', 'hidden', 'all'] as const).map(k => <button key={k} type="button" className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{k === 'pending' ? tt('Waiting', 'بالانتظار') : k === 'approved' ? tt('Published', 'معروضة') : k === 'hidden' ? tt('Hidden', 'مخفية') : tt('All', 'الكل')} ({k === 'all' ? rows.length : rows.filter(r => r.status === k).length})</button>)}</div>}>
      {!visible.length ? <p className="admin-empty">{tt('Nothing here.', 'ماكو شي هنا.')}</p> : <ul className="rv-list">{visible.map(r => <li key={r.id} className={`rv-item is-${r.status}`}>
        <div className="rv-head"><span className="rv-stars">{stars(r.rating)}</span><b>{r.name}</b>{r.city && <small>{r.city}</small>}{r.verified && <span className="admin-badge success"><BadgeCheck size={12} /> {tt('Verified', 'موثّق')}</span>}<span className={`admin-badge ${r.status === 'approved' ? 'success' : r.status === 'pending' ? 'warning' : 'muted'}`}>{r.status === 'approved' ? tt('Published', 'معروض') : r.status === 'pending' ? tt('Waiting', 'بالانتظار') : tt('Hidden', 'مخفي')}</span><small className="rv-date">{new Date(r.createdAt).toLocaleDateString('en-GB')}</small></div>
        <Link className="rv-product" href={`/products/${r.productId}#reviews`} target="_blank">{ar ? r.productNameAr || r.productName : r.productName}</Link>
        {r.title && <h4>{r.title}</h4>}
        <p>{r.body}</p>
        {r.phone && <small className="rv-phone" dir="ltr">{r.phone}{r.orderId ? ` · #${r.orderId}` : ''}</small>}
        {r.reply && <blockquote className="rv-reply"><b>{tt('Your reply', 'ردّك')}</b> {r.reply}</blockquote>}
        <div className="rv-actions">
          {r.status !== 'approved' && <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" disabled={busy === r.id} onClick={() => void setStatus(r, 'approved')}>{busy === r.id ? <LoaderCircle size={13} className="spin" /> : <Check size={13} />} {tt('Approve', 'موافقة ونشر')}</button>}
          {r.status !== 'hidden' && <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" disabled={busy === r.id} onClick={() => void setStatus(r, 'hidden')}><EyeOff size={13} /> {tt('Hide', 'إخفاء')}</button>}
          <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setReplying(r)}><MessageSquareReply size={13} /> {r.reply ? tt('Edit reply', 'تعديل الرد') : tt('Reply', 'رد')}</button>
          <button type="button" className="admin-btn admin-btn-danger-ghost admin-btn-sm" disabled={busy === r.id} onClick={() => void remove(r)}><Trash2 size={13} /></button>
        </div>
      </li>)}</ul>}
    </Card>
    {replying && <ReplyModal review={replying} onClose={() => setReplying(null)} onSaved={reply => { setRows(rs => rs.map(x => x.id === replying.id ? { ...x, reply } : x)); setReplying(null); success(tt('Reply saved.', 'انحفظ الرد.')); }} onError={fail} />}
    {adding && <AddModal products={products} onClose={() => setAdding(false)} onSaved={() => location.reload()} onError={fail} />}
  </main>;
}

function ReplyModal({ review, onClose, onSaved, onError }: { review: AdminReview; onClose: () => void; onSaved: (reply: string) => void; onError: (e: unknown) => void }) {
  const { language } = useLanguage();
  const tt = (en: string, a: string) => language === 'ar' ? a : en;
  const [reply, setReply] = useState(review.reply);
  const [busy, setBusy] = useState(false);
  async function save() { setBusy(true); try { await api(`/api/admin/reviews/${review.id}`, { method: 'PATCH', json: { reply } }); onSaved(reply.trim()); } catch (e) { onError(e); } finally { setBusy(false); } }
  return <Modal title={tt('Public reply', 'رد علني')} onClose={onClose}>
    <p className="admin-hint">“{review.body.slice(0, 160)}” — {review.name}</p>
    <label className="admin-field"><span>{tt('Shown under the review on the product page', 'يظهر تحت التقييم بصفحة المنتج')}</span><textarea rows={4} value={reply} onChange={e => setReply(e.target.value)} placeholder={tt('Thank you for your trust…', 'شكراً لثقتك بأور…')} /></label>
    <div className="admin-modal-actions"><button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}><X size={14} /> {tt('Cancel', 'إلغاء')}</button><button type="button" className="admin-btn admin-btn-primary" disabled={busy} onClick={() => void save()}>{busy && <LoaderCircle size={14} className="spin" />} {tt('Save reply', 'حفظ الرد')}</button></div>
  </Modal>;
}

function AddModal({ products, onClose, onSaved, onError }: { products: { id: string; name: string; nameAr: string }[]; onClose: () => void; onSaved: () => void; onError: (e: unknown) => void }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, a: string) => ar ? a : en;
  const [f, setF] = useState({ productId: products[0]?.id ?? '', rating: 5, name: '', city: '', phone: '', body: '' });
  const [busy, setBusy] = useState(false);
  async function save() { setBusy(true); try { await api('/api/admin/reviews', { method: 'POST', json: f }); onSaved(); } catch (e) { onError(e); } finally { setBusy(false); } }
  return <Modal title={tt('Add a customer review', 'إضافة تقييم زبون')} onClose={onClose}>
    <p className="admin-hint">{tt('For real feedback a customer sent you (WhatsApp, Instagram). Add their phone to mark it verified if they bought the product.', 'للتقييمات الحقيقية اللي وصلتك من الزبون (واتساب، إنستغرام). حط رقمه حتى يظهر "موثّق" إذا اشترى المنتج.')}</p>
    <label className="admin-field"><span>{tt('Product', 'المنتج')}</span><select value={f.productId} onChange={e => setF({ ...f, productId: e.target.value })}>{products.map(p => <option key={p.id} value={p.id}>{ar ? p.nameAr || p.name : p.name}</option>)}</select></label>
    <label className="admin-field"><span>{tt('Rating', 'التقييم')}</span><select value={f.rating} onChange={e => setF({ ...f, rating: Number(e.target.value) })}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{stars(n)}</option>)}</select></label>
    <div className="pce-pair"><label className="admin-field"><span>{tt('Customer name', 'اسم الزبون')}</span><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label><label className="admin-field"><span>{tt('City', 'المدينة')}</span><input value={f.city} onChange={e => setF({ ...f, city: e.target.value })} /></label></div>
    <label className="admin-field"><span>{tt('Phone (optional)', 'الرقم (اختياري)')}</span><input dir="ltr" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="07XXXXXXXXX" /></label>
    <label className="admin-field"><span>{tt('Review', 'التقييم')}</span><textarea rows={4} value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /></label>
    <div className="admin-modal-actions"><button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>{tt('Cancel', 'إلغاء')}</button><button type="button" className="admin-btn admin-btn-primary" disabled={busy || f.name.trim().length < 2 || f.body.trim().length < 3} onClick={() => void save()}>{busy && <LoaderCircle size={14} className="spin" />} {tt('Add & publish', 'إضافة ونشر')}</button></div>
  </Modal>;
}
