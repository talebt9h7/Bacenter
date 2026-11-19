'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useLanguage } from './language-provider';
import type { PromotionRecord } from '@/lib/promotions';

const pad = (n: number) => String(n).padStart(2, '0');

/** Black strip above the header while an offer is live: its name, what it gives, a live countdown, and a link to the discounted products. */
export function PromoBar({ promos, renderedAt }: { promos: PromotionRecord[]; renderedAt: number }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [now, setNow] = useState<number | null>(null);
  const [hidden, setHidden] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(() => {
      tick();
      try { const v = sessionStorage.getItem('ur-promo-bar-hidden'); if (v) setHidden(Number(v)); } catch { /* storage blocked */ }
    }, 0);
    const t = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);
  // Until the clock runs in the browser, show the offer that is live on the server (no flash, no mismatch).
  const at = now ?? renderedAt;
  const live = promos.filter(p => p.active && Date.parse(p.startsAt) <= at && Date.parse(p.endsAt) > at).sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))[0];
  if (!live || hidden === live.id) return null;
  const title = ar ? (live.badgeAr || live.nameAr || live.name) : (live.badge || live.name);
  const what = live.type === 'percent'
    ? (ar ? `خصم ${live.value}% ${live.scope === 'all' ? 'على كل المنتجات' : 'على منتجات مختارة'}` : `${live.value}% off ${live.scope === 'all' ? 'everything' : 'selected pieces'}`)
    : live.type === 'amount'
      ? (ar ? `خصم ${live.value.toLocaleString('en-US')} د.ع على كل قطعة` : `${live.value.toLocaleString('en-US')} IQD off every piece`)
      : (ar ? 'أسعار خاصة لفترة محدودة' : 'Special prices for a limited time');
  const left = Math.max(0, Date.parse(live.endsAt) - at);
  const d = Math.floor(left / 86_400_000), h = Math.floor(left / 3_600_000) % 24, m = Math.floor(left / 60_000) % 60, s = Math.floor(left / 1000) % 60;
  const Arrow = ar ? ArrowLeft : ArrowRight;
  return <div className="promo-bar" role="region" aria-label={ar ? 'عرض حالي' : 'Current offer'}>
    <Link href="/collection/offers" className="promo-bar-link">
      <b className="promo-bar-title">{title}</b>
      <span className="promo-bar-what">{what}</span>
      {live.showCountdown && now != null && <span className="promo-bar-clock" role="timer" aria-label={ar ? 'الوقت المتبقي' : 'Time left'}>
        <span className="promo-bar-ends">{ar ? 'ينتهي خلال' : 'Ends in'}</span>
        <bdi dir="ltr">{d > 0 && <><i>{d}</i><small>{ar ? 'ي' : 'd'}</small></>}<i>{pad(h)}</i>:<i>{pad(m)}</i>:<i>{pad(s)}</i></bdi>
      </span>}
      <span className="promo-bar-cta">{ar ? 'تسوق العرض' : 'Shop the offer'}<Arrow size={14} /></span>
    </Link>
    <button type="button" className="promo-bar-close" aria-label={ar ? 'إخفاء' : 'Hide'} onClick={() => { setHidden(live.id); try { sessionStorage.setItem('ur-promo-bar-hidden', String(live.id)); } catch { /* storage blocked */ } }}><X size={15} /></button>
  </div>;
}
