'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import type { AppliedPromotion } from '@/lib/types';

/** True while the promotion is running; flips to false the moment it ends (no reload needed). */
export function usePromoLive(promotion?: AppliedPromotion | null) {
  const [endedFor, setEndedFor] = useState<string | null>(null);
  const endsAt = promotion?.endsAt ?? null;
  useEffect(() => {
    if (!endsAt) return;
    const left = new Date(endsAt).getTime() - Date.now();
    // setTimeout can't wait longer than ~24.8 days; long sales simply stay live until a later visit.
    if (left > 2_000_000_000) return;
    const timer = window.setTimeout(() => setEndedFor(endsAt), Math.max(0, left));
    return () => window.clearTimeout(timer);
  }, [endsAt]);
  return !!endsAt && endedFor !== endsAt;
}

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const two = (n: number) => String(n).padStart(2, '0');

/** Live countdown to the end of a promotion. `compact` shows days/hours only (for product cards). */
export function PromoCountdown({ endsAt, language, compact = false, refreshOnEnd = false }: { endsAt: string; language: string; compact?: boolean; refreshOnEnd?: boolean }) {
  const router = useRouter();
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), compact ? 30_000 : 1000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [compact]);
  const refreshed = useRef(false);
  useEffect(() => { if (refreshOnEnd && !refreshed.current && now != null && now >= end) { refreshed.current = true; router.refresh(); } }, [now, end, refreshOnEnd, router]);
  if (now == null) return null; // rendered on the client only, so server and browser clocks never disagree
  const ar = language === 'ar';
  if (now >= end) return <span className="promo-countdown ended">{ar ? 'انتهى العرض' : 'Offer ended'}</span>;
  const t = parts(end - now);
  if (compact) {
    const text = t.d > 0 ? (ar ? `ينتهي خلال ${t.d} يوم${t.h ? ` و${t.h} س` : ''}` : `Ends in ${t.d}d ${t.h}h`) : t.h > 0 ? (ar ? `ينتهي خلال ${t.h} س ${t.m} د` : `Ends in ${t.h}h ${t.m}m`) : (ar ? `ينتهي خلال ${t.m} دقيقة` : `Ends in ${t.m} min`);
    return <span className="promo-countdown compact"><Clock size={12} aria-hidden="true" />{text}</span>;
  }
  const units: [number, string, string][] = [[t.d, 'يوم', 'days'], [t.h, 'ساعة', 'hrs'], [t.m, 'دقيقة', 'min'], [t.s, 'ثانية', 'sec']];
  return <div className="promo-countdown full" role="timer" aria-live="off" aria-label={ar ? 'الوقت المتبقي على العرض' : 'Time left on this offer'}>
    <span className="promo-countdown-label"><Clock size={14} aria-hidden="true" />{ar ? 'ينتهي العرض خلال' : 'Offer ends in'}</span>
    <span className="promo-countdown-units">{units.filter((u, i) => i > 0 || u[0] > 0).map(([value, arLabel, enLabel]) => <span key={enLabel} className="promo-unit"><b>{two(value)}</b><small>{ar ? arLabel : enLabel}</small></span>)}</span>
  </div>;
}
