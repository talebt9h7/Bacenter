'use client';

/**
 * Dashboard pieces in the soft-glass look: frosted light cards, UR orange as the only colour,
 * hatched orange bars, smooth lines with a glow at the point in focus. Motion comes from GSAP
 * (entrances, line drawing, counters, the sliding period pill) and is skipped for reduced motion.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState, useTransition, type ReactNode, type RefObject } from 'react';
import gsap from 'gsap';
import { CalendarDays } from 'lucide-react';
import { compact, fmt, smoothPath, type Lang } from './dash-ui';

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export type NumFormat = 'int' | 'iqd' | 'compact' | 'pct1';
const formatters: Record<NumFormat, (n: number) => string> = {
  int: n => fmt(n), iqd: n => fmt(n), compact: n => compact(n), pct1: n => `${n.toFixed(1)}%`,
};
/** A figure that GSAP counts up to on entry; the final text is rendered on the server too. */
export function Num({ value, format = 'int' }: { value: number; format?: NumFormat }) {
  return <span className="gl-num" data-count={value} data-format={format}>{formatters[format](value)}</span>;
}

/** Entrance, drawing and counting for everything inside the dashboard root. Re-runs when `key` changes (new period). */
export function useGlassMotion(root: RefObject<HTMLElement | null>, key: string) {
  useIso(() => {
    if (!root.current || reduced()) return;
    const ctx = gsap.context(() => {
      gsap.from('.gl-card, .dash-card, .nq-card, .dash-kpi, .dash-pnl, .acc-card, .acc-kpi', { y: 22, opacity: 0, scale: 0.985, duration: 0.75, ease: 'power3.out', stagger: 0.045, clearProps: 'transform,opacity' });
      root.current!.querySelectorAll<HTMLElement>('.gl-num[data-count]').forEach(el => {
        const target = Number(el.dataset.count) || 0, f = formatters[(el.dataset.format as NumFormat) || 'int'];
        const o = { v: 0 };
        gsap.to(o, { v: target, duration: 1.15, ease: 'power2.out', delay: 0.15, onUpdate: () => { el.textContent = f(el.dataset.format === 'int' || el.dataset.format === 'iqd' ? Math.round(o.v) : o.v); } });
      });
      drawPaths(root.current!.querySelectorAll<SVGPathElement>('.gl-draw'), 0.25);
      gsap.from('.gl-fade', { opacity: 0, duration: 1, delay: 0.55, ease: 'power1.out' });
      gsap.from('.gl-bar', { scaleY: 0, transformOrigin: '50% 100%', duration: 0.7, ease: 'back.out(1.5)', stagger: 0.012, delay: 0.25 });
      gsap.from('.gl-hbar', { scaleX: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, delay: 0.35 });
      gsap.from('.gl-pop', { scale: 0, opacity: 0, duration: 0.5, ease: 'back.out(2)', delay: 1.1, stagger: 0.05 });
    }, root);
    return () => ctx.revert();
  }, [key]);
}

function drawPaths(paths: Iterable<SVGPathElement>, delay = 0) {
  for (const path of paths) {
    const length = path.getTotalLength?.() ?? 0;
    if (!length) continue;
    gsap.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut', delay, onComplete: () => { path.style.strokeDasharray = ''; path.style.strokeDashoffset = ''; } });
  }
}

export function GlassCard({ children, className = '', title, aside, id }: { children: ReactNode; className?: string; title?: ReactNode; aside?: ReactNode; id?: string }) {
  return <section id={id} className={`gl-card ${className}`}>
    {(title || aside) && <header className="gl-card-head">{title && <h2>{title}</h2>}{aside}</header>}
    {children}
  </section>;
}

/** Period switch: one row of pills with a sliding highlight, plus a small calendar for any day or span. */
export function PeriodSwitch({ items, active, today, fromDay, toDay, custom, lang, onPending, base = '/admin', children }: { items: { key: string; label: string; href: string }[]; active: string; today: string; fromDay: string; toDay: string; custom: boolean; lang: Lang; onPending: (pending: boolean) => void; base?: string; children?: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(fromDay), [to, setTo] = useState(toDay);
  const wrap = useRef<HTMLDivElement>(null), pill = useRef<HTMLSpanElement>(null), first = useRef(true);
  const tt = (en: string, ar: string) => lang === 'ar' ? ar : en;
  useEffect(() => { onPending(pending); }, [pending, onPending]);
  useIso(() => {
    const box = wrap.current, indicator = pill.current;
    const on = box?.querySelector<HTMLElement>(`[data-key="${custom ? '__custom' : active}"]`);
    if (!box || !indicator || !on) return;
    const x = on.offsetLeft, width = on.offsetWidth;
    if (first.current || reduced()) { gsap.set(indicator, { x, width, opacity: 1 }); first.current = false; }
    else gsap.to(indicator, { x, width, duration: 0.45, ease: 'power3.out' });
  }, [active, custom]);
  const go = (href: string) => start(() => router.push(href, { scroll: false }));
  const shortDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === 'ar' ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short' });
  return <div className="gl-period">
    <div className="gl-seg" ref={wrap} role="tablist" aria-label={tt('Period', 'الفترة')}>
      <span className="gl-seg-pill" ref={pill} aria-hidden="true" />
      {items.map(item => <button key={item.key} type="button" role="tab" data-key={item.key} aria-selected={!custom && active === item.key} className={!custom && active === item.key ? 'on' : ''} onClick={() => go(item.href)}>{item.label}</button>)}
      <button type="button" data-key="__custom" className={`gl-seg-cal ${custom ? 'on' : ''}`} aria-expanded={open} aria-label={tt('Pick dates', 'اختيار تاريخ')} onClick={() => setOpen(v => !v)}>
        <CalendarDays size={15} />{custom && <span>{fromDay === toDay ? shortDay(fromDay) : `${shortDay(fromDay)} – ${shortDay(toDay)}`}</span>}
      </button>
    </div>
    {open && <div className="gl-pop-dates" role="dialog" aria-label={tt('Pick dates', 'اختيار تاريخ')}>
      <label><span>{tt('From', 'من')}</span><input type="date" max={today} value={from} onChange={e => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }} /></label>
      <label><span>{tt('To', 'إلى')}</span><input type="date" max={today} min={from} value={to} onChange={e => setTo(e.target.value)} /></label>
      {children}
      <div className="gl-pop-actions">
        <button type="button" className="gl-chip" onClick={() => setTo(from)}>{tt('Single day', 'يوم واحد')}</button>
        <button type="button" className="gl-btn primary" disabled={!from} onClick={() => { setOpen(false); go(`${base}?from=${from}&to=${to || from}`); }}>{tt('Show', 'عرض')}</button>
      </div>
    </div>}
  </div>;
}

export type HeroSeries = { key: string; label: string; values: number[]; format: (n: number) => string; compare?: number[]; compareLabel?: string; second?: { label: string; values: number[] } };

/** The main chart: a smooth orange line with a soft fill, a dashed comparison and a glowing focus point. */
export function HeroChart({ labels, tabs, lang, emptyText }: { labels: string[]; tabs: HeroSeries[]; lang: Lang; emptyText: string }) {
  const [tab, setTab] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null), mounted = useRef(false);
  const s = tabs[tab] ?? tabs[0];
  const n = labels.length, W = 1000, H = 300, top = 26, bottom = 30;
  const all = [...s.values, ...(s.compare ?? []), ...(s.second?.values ?? [])];
  const max = Math.max(1, ...all) * 1.08;
  const x = (i: number) => n <= 1 ? W / 2 : 6 + (i / (n - 1)) * (W - 12);
  const y = (v: number) => H - bottom - (Math.max(0, v) / max) * (H - top - bottom);
  const line = smoothPath(s.values.map((v, i) => [x(i), y(v)]));
  const peak = s.values.reduce((best, v, i) => v > s.values[best] ? i : best, 0);
  const focus = hover ?? peak;
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (!svg.current || reduced()) return;
    drawPaths(svg.current.querySelectorAll<SVGPathElement>('.gl-draw'));
    gsap.fromTo(svg.current.querySelectorAll('.gl-fade'), { opacity: 0 }, { opacity: 1, duration: 0.8, delay: 0.3 });
  }, [tab]);
  const every = Math.max(1, Math.ceil(n / 7));
  const tick = (i: number) => (i % every === 0 && n - 1 - i >= every * 0.6) || i === n - 1;
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHover(Math.round(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * (n - 1)));
  };
  const has = s.values.some(v => v);
  const fx = x(focus), fy = y(s.values[focus] ?? 0);
  const label = (key: string) => key.length > 7 ? new Date(`${key}T12:00:00Z`).toLocaleDateString(lang === 'ar' ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short' }) : new Date(`${key}-15T12:00:00Z`).toLocaleDateString(lang === 'ar' ? 'ar-IQ' : 'en-GB', { month: 'short', year: '2-digit' });
  return <div className="gl-hero-chart">
    {tabs.length > 1 && <div className="gl-tabs" role="tablist">{tabs.map((t, i) => <button key={t.key} type="button" role="tab" aria-selected={i === tab} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>{t.label}</button>)}</div>}
    {!has ? <p className="gl-empty">{emptyText}</p> : <div className="gl-plot" dir="ltr" onPointerMove={move} onPointerLeave={() => setHover(null)}>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={s.label}>
        <defs>
          <linearGradient id="gl-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ef7342" stopOpacity=".28" /><stop offset=".7" stopColor="#ef7342" stopOpacity=".04" /><stop offset="1" stopColor="#ef7342" stopOpacity="0" /></linearGradient>
          <radialGradient id="gl-glow"><stop offset="0" stopColor="#ef7342" stopOpacity=".55" /><stop offset="1" stopColor="#ef7342" stopOpacity="0" /></radialGradient>
        </defs>
        {labels.map((_, i) => tick(i) ? <line key={i} x1={x(i)} x2={x(i)} y1={top} y2={H - bottom} className="gl-vline" vectorEffect="non-scaling-stroke" /> : null)}
        <path className="gl-fade" d={`${line} L${x(n - 1)},${H - bottom} L${x(0)},${H - bottom} Z`} fill="url(#gl-fill)" />
        {s.compare && <path className="gl-compare gl-fade" d={smoothPath(s.compare.map((v, i) => [x(i), y(v)]))} vectorEffect="non-scaling-stroke" />}
        {s.second && <path className="gl-second gl-draw" d={smoothPath(s.second.values.map((v, i) => [x(i), y(v)]))} vectorEffect="non-scaling-stroke" />}
        <path className="gl-line gl-draw" d={line} vectorEffect="non-scaling-stroke" />
        <line x1={fx} x2={fx} y1={top} y2={H - bottom} className="gl-cursor" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="gl-glow" style={{ left: `${(fx / W) * 100}%`, top: `${(fy / H) * 100}%` }} aria-hidden="true" />
      <span className="gl-dot" style={{ left: `${(fx / W) * 100}%`, top: `${(fy / H) * 100}%` }} aria-hidden="true" />
      <div className={`gl-tip ${focus > n * 0.62 ? 'flip' : ''} ${fy / H < 0.4 ? 'below' : ''}`} style={{ left: `${(fx / W) * 100}%`, top: `${(fy / H) * 100}%` }}>
        <strong>{s.format(s.values[focus] ?? 0)}</strong>
        <small>{label(labels[focus])}{s.compare ? ` · ${s.compareLabel} ${s.format(s.compare[focus] ?? 0)}` : ''}{s.second ? ` · ${s.second.label} ${s.format(s.second.values[focus] ?? 0)}` : ''}</small>
      </div>
      <div className="gl-x">{labels.map((key, i) => tick(i) ? <span key={i} style={{ left: `${(x(i) / W) * 100}%` }}>{label(key)}</span> : null)}</div>
    </div>}
  </div>;
}

/** Hatched orange columns; the last `strong` periods solid, the rest light; empty periods as dashed outlines. */
export function GlassBars({ values, strong = 7, labels, format = fmt }: { values: number[]; strong?: number; labels?: string[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...values);
  return <div className="gl-bars" dir="ltr">{values.map((v, i) => <span key={i} className="gl-bar-slot" title={labels ? `${labels[i]}: ${format(v)}` : format(v)}>
    {v > 0 ? <i className={`gl-bar ${i >= values.length - strong ? 'hot' : ''}`} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} /> : <i className="gl-bar-empty" />}
  </span>)}</div>;
}

export function GlassSpark({ values }: { values: number[] }) {
  if (values.length < 2 || !values.some(v => v)) return <div className="gl-spark gl-spark-empty" />;
  const max = Math.max(...values), min = Math.min(...values, 0), W = 200, H = 56;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 6 - ((v - min) / (max - min || 1)) * (H - 14)] as [number, number]);
  const d = smoothPath(pts), last = pts[pts.length - 1];
  return <svg className="gl-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="gl-spark-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ef7342" stopOpacity=".22" /><stop offset="1" stopColor="#ef7342" stopOpacity="0" /></linearGradient></defs>
    <path className="gl-fade" d={`${d} L${W},${H} L0,${H} Z`} fill="url(#gl-spark-fill)" />
    <path className="gl-draw gl-spark-line" d={d} vectorEffect="non-scaling-stroke" />
    <circle className="gl-pop" cx={last[0] - 2} cy={last[1]} r="3.5" fill="#ef7342" />
  </svg>;
}

/** Semicircle gauge for a 0–1 share (profit margin). */
export function Gauge({ value, label, sub }: { value: number; label: string; sub: string }) {
  const v = Math.max(0, Math.min(1, value)), R = 92, cx = 120, cy = 116;
  const arc = (t: number) => { const a = Math.PI * (1 - t); return [cx + R * Math.cos(a), cy - R * Math.sin(a)]; };
  const [x0, y0] = arc(0), [x1, y1] = arc(1), [xv, yv] = arc(v);
  const ticks = Array.from({ length: 31 }, (_, i) => { const t = i / 30, a = Math.PI * (1 - t), r1 = R + 15, r2 = R + (i % 5 ? 19 : 23); return <line key={i} x1={cx + r1 * Math.cos(a)} y1={cy - r1 * Math.sin(a)} x2={cx + r2 * Math.cos(a)} y2={cy - r2 * Math.sin(a)} className={t <= v ? 'on' : ''} />; });
  return <div className="gl-gauge">
    <svg viewBox="0 0 240 130" aria-hidden="true">
      <path d={`M${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1}`} className="gl-gauge-track" />
      {v > 0 && <path d={`M${x0},${y0} A${R},${R} 0 0 1 ${xv},${yv}`} className="gl-gauge-arc gl-draw" />}
      <g className="gl-gauge-ticks">{ticks}</g>
    </svg>
    <div className="gl-gauge-center"><strong>{label}</strong><span>{sub}</span></div>
  </div>;
}

/** Revenue → costs → net, as hatched bars that start where the previous one ended. */
export function Breakdown({ rows, format }: { rows: { label: string; value: number; kind: 'total' | 'minus' | 'result' }[]; format: (n: number) => string }) {
  const base = Math.max(1, ...rows.map(r => Math.abs(r.value)));
  const widths = rows.map(r => (Math.abs(r.value) / base) * 100);
  // Costs are taken off the end of what is left, like a waterfall.
  const starts = rows.reduce<{ list: number[]; cursor: number }>((acc, r, i) => {
    if (r.kind === 'total') return { list: [...acc.list, 0], cursor: widths[i] };
    if (r.kind === 'minus') { const start = Math.max(0, acc.cursor - widths[i]); return { list: [...acc.list, start], cursor: start }; }
    return { list: [...acc.list, 0], cursor: acc.cursor };
  }, { list: [], cursor: 0 }).list;
  return <ul className="gl-breakdown">{rows.map((r, i) => {
    const width = widths[i], start = starts[i];
    return <li key={r.label} className={r.kind}>
      <span className="gl-bd-label">{r.label}</span>
      <span className="gl-bd-track"><i className="gl-hbar" style={{ insetInlineStart: `${start}%`, width: `${Math.max(1.5, width)}%` }} /></span>
      <b className="gl-bd-value">{r.kind === 'minus' && r.value > 0 ? '−' : ''}{format(Math.abs(r.value))}</b>
    </li>;
  })}</ul>;
}

export function GlassLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return <Link href={href} className={`gl-link ${className}`}>{children}</Link>;
}
