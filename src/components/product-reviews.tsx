'use client';
import { useState } from 'react';
import { BadgeCheck, LoaderCircle, MessageSquareQuote, Star } from 'lucide-react';
import type { ReviewSummary } from '@/lib/reviews';
import { useLanguage } from './language-provider';

export function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return <span className="ur-stars" role="img" aria-label={`${value} / 5`}>{[1, 2, 3, 4, 5].map(i => <span key={i} className="ur-star" style={{ width: size, height: size }}><Star size={size} strokeWidth={1.5} /><span style={{ width: `${Math.max(0, Math.min(1, value - i + 1)) * 100}%` }}><Star size={size} strokeWidth={1.5} fill="currentColor" /></span></span>)}</span>;
}

/** Small "★★★★★ 4.8 (12)" under the product title; links to the reviews at the end of the page. */
export function RatingLink({ summary }: { summary: ReviewSummary }) {
  const { language } = useLanguage();
  if (!summary.count) return null;
  return <a href="#reviews" className="rating-link"><Stars value={summary.average} size={14} /><b>{summary.average.toFixed(1)}</b><span>({summary.count} {language === 'ar' ? 'تقييم' : summary.count === 1 ? 'review' : 'reviews'})</span></a>;
}

const date = (iso: string, ar: boolean) => new Date(iso).toLocaleDateString(ar ? 'ar-IQ' : 'en-GB', { year: 'numeric', month: 'long' });

/** Reviews block at the end of the product page: summary, approved reviews, and a short form. */
export function ProductReviews({ productId, summary }: { productId: string; summary: ReviewSummary }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const tt = (en: string, a: string) => ar ? a : en;
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [form, setForm] = useState({ name: '', city: '', phone: '', body: '', website: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');
  const list = all ? summary.reviews : summary.reviews.slice(0, 3);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (!rating) { setError(tt('Choose a star rating.', 'اختار عدد النجوم.')); return; }
    setState('sending');
    try {
      const r = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, rating, ...form }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || tt('Could not send your review.', 'ما گدرنا نرسل تقييمك.'));
      setState('done');
    } catch (err) { setError(err instanceof Error ? err.message : ''); setState('idle'); }
  }
  return <section className="product-reviews" id="reviews" aria-labelledby="reviews-title">
    <div className="reviews-head">
      <div className="reviews-score">
        <h2 id="reviews-title">{tt('Customer reviews', 'تقييمات الزبائن')}</h2>
        {summary.count > 0 ? <><div className="reviews-average"><strong>{summary.average.toFixed(1)}</strong><div><Stars value={summary.average} size={18} /><span>{tt(`Based on ${summary.count} review${summary.count === 1 ? '' : 's'}`, `من ${summary.count} تقييم`)}</span></div></div>
          <ul className="reviews-bars">{[5, 4, 3, 2, 1].map(n => <li key={n}><span>{n} <Star size={11} fill="currentColor" /></span><i><b style={{ width: `${summary.count ? summary.distribution[n - 1] / summary.count * 100 : 0}%` }} /></i><em>{summary.distribution[n - 1]}</em></li>)}</ul></>
          : <p className="reviews-empty">{tt('No reviews yet. Bought this piece? Tell others how it feels.', 'ماكو تقييمات بعد. اشتريت هالقطعة؟ گول للناس شلون لگيتها.')}</p>}
      </div>
      {state !== 'done' && <button type="button" className="button button-outline reviews-write" onClick={() => setOpen(o => !o)}><MessageSquareQuote size={16} /> {tt('Write a review', 'اكتب تقييمك')}</button>}
    </div>

    {state === 'done' ? <p className="reviews-thanks"><BadgeCheck size={18} /> {tt('Thank you! Your review will appear after a quick check.', 'شكراً إلك! تقييمك راح يظهر بعد المراجعة.')}</p>
      : open && <form className="reviews-form" onSubmit={e => void submit(e)}>
        <div className="reviews-pick" onMouseLeave={() => setHover(0)}>{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} aria-label={`${n}`} className={(hover || rating) >= n ? 'on' : ''} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)}><Star size={26} strokeWidth={1.4} fill={(hover || rating) >= n ? 'currentColor' : 'none'} /></button>)}</div>
        <div className="reviews-fields">
          <label><span>{tt('Name', 'الاسم')}</span><input required minLength={2} maxLength={60} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label><span>{tt('City (optional)', 'المدينة (اختياري)')}</span><input maxLength={60} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></label>
          <label className="full"><span>{tt('Order phone number (optional — marks your review as a verified purchase)', 'رقم الموبايل اللي طلبت بيه (اختياري — حتى يظهر تقييمك كـ"مشتري موثّق")')}</span><input dir="ltr" inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="07XXXXXXXXX" /></label>
          <label className="full"><span>{tt('Your review', 'تقييمك')}</span><textarea required minLength={5} maxLength={1500} rows={4} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder={tt('Leather quality, stitching, size, delivery…', 'جودة الجلد، الخياطة، الحجم، التوصيل…')} /></label>
          <input className="reviews-hp" tabIndex={-1} autoComplete="off" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} aria-hidden="true" />
        </div>
        {error && <p className="reviews-error">{error}</p>}
        <button type="submit" className="button button-orange" disabled={state === 'sending'}>{state === 'sending' && <LoaderCircle size={16} className="spin" />} {tt('Send review', 'إرسال التقييم')}</button>
        <p className="reviews-note">{tt('Your phone number is never shown.', 'رقم موبايلك ما يظهر لأي أحد.')}</p>
      </form>}

    {list.length > 0 && <ul className="reviews-list">{list.map(r => <li key={r.id}>
      <div className="review-top"><Stars value={r.rating} size={14} />{r.verified && <span className="review-verified"><BadgeCheck size={14} /> {tt('Verified purchase', 'مشتري موثّق')}</span>}</div>
      {r.title && <h3>{r.title}</h3>}
      <p>{r.body}</p>
      <footer><b>{r.name}</b>{r.city && <> · {r.city}</>} · <time dateTime={r.createdAt}>{date(r.createdAt, ar)}</time></footer>
      {r.reply && <blockquote className="review-reply"><b>{tt('Reply from UR', 'رد أور')}</b><p>{r.reply}</p></blockquote>}
    </li>)}</ul>}
    {summary.reviews.length > 3 && !all && <button type="button" className="text-link reviews-more" onClick={() => setAll(true)}>{tt(`Show all ${summary.count} reviews`, `عرض كل التقييمات (${summary.count})`)}</button>}
  </section>;
}
