'use client';

/**
 * Shared building blocks for every admin page: KPI tiles, cards, counters and lightweight SVG
 * charts. Styles live in admin-dashboard.css (dash-*). Charts read left-to-right (time) in both
 * languages; labels are passed in already translated.
 */
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Sparkles } from 'lucide-react';

export type Lang = 'ar' | 'en';
export const PALETTE = ['#cd4c20', '#2f6b4f', '#3d5a80', '#c08a2b', '#7a5195', '#5f8575', '#a1593f', '#8d99ae'];
export const fmt = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
export const iqd = (n: number) => `${fmt(n)} IQD`;
export const compact = (n: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
export const pct = (n: number, digits = 0) => `${((n || 0) * 100).toFixed(digits)}%`;
export function change(current: number, previous: number) {
  if (!previous) return current ? { label: 'new', value: 1 } : { label: '—', value: 0 };
  const value = (current - previous) / Math.abs(previous);
  return { label: `${value > 0 ? '+' : ''}${(value * 100).toFixed(Math.abs(value) < 0.1 ? 1 : 0)}%`, value };
}
export function ago(iso: string, lang: Lang) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return lang === 'ar' ? `قبل ${minutes} د` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return lang === 'ar' ? `قبل ${hours} س` : `${hours}h ago`;
  return lang === 'ar' ? `قبل ${Math.round(hours / 24)} يوم` : `${Math.round(hours / 24)}d ago`;
}

/** Counts up to the value once it scrolls into view. Static for people who prefer reduced motion. */
export function CountUp({ value, format = fmt }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return; }
    let frame = 0;
    const run = () => {
      const start = performance.now(), duration = 900;
      const tick = (now: number) => { const t = Math.min(1, (now - start) / duration); setShown(value * (1 - Math.pow(1 - t, 3))); if (t < 1) frame = requestAnimationFrame(tick); };
      frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { observer.disconnect(); run(); } });
    observer.observe(node);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [value]);
  return <span ref={ref}>{format(shown)}</span>;
}

export function Delta({ current, previous, inverse = false, lang }: { current: number; previous: number; inverse?: boolean; lang: Lang }) {
  const c = change(current, previous);
  const good = inverse ? c.value < 0 : c.value > 0;
  const tone = c.value === 0 ? 'flat' : good ? 'up' : 'down';
  const label = c.label === 'new' ? (lang === 'ar' ? 'جديد' : 'New') : c.label;
  return <span className={`dash-delta ${tone}`} title={lang === 'ar' ? `الفترة السابقة: ${fmt(previous)}` : `Previous period: ${fmt(previous)}`}>{c.value > 0 ? <ArrowUpRight size={13} /> : c.value < 0 ? <ArrowDownRight size={13} /> : null}{label}</span>;
}

export function Sparkline({ values, tone = 'accent' }: { values: number[]; tone?: string }) {
  if (values.length < 2) return <svg className="dash-spark" viewBox="0 0 100 30" aria-hidden="true" />;
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 26}`).join(' ');
  return <svg className={`dash-spark ${tone}`} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
    <polygon points={`0,30 ${points} 100,30`} className="dash-spark-area" />
    <polyline points={points} pathLength={1} className="dash-spark-line" vectorEffect="non-scaling-stroke" />
  </svg>;
}

export function Kpi({ icon, label, value, format, current, previous, inverse, spark, note, tone, lang, href, delay = 0 }: { icon: ReactNode; label: string; value: number; format?: (n: number) => string; current?: number; previous?: number; inverse?: boolean; spark?: number[]; note?: ReactNode; tone?: string; lang: Lang; href?: string; delay?: number }) {
  const body = <>
    <div className="dash-kpi-top"><span className={`dash-kpi-icon ${tone ?? ''}`}>{icon}</span><span className="dash-kpi-label">{label}</span></div>
    <div className="dash-kpi-row"><strong className="dash-kpi-value"><CountUp value={value} format={format} /></strong>{previous !== undefined && <Delta current={current ?? value} previous={previous} inverse={inverse} lang={lang} />}</div>
    {note && <small className="dash-kpi-note">{note}</small>}
    {spark && <Sparkline values={spark} tone={tone} />}
  </>;
  return href ? <Link href={href} className="dash-kpi dash-rise" style={{ animationDelay: `${delay}ms` }}>{body}</Link> : <div className="dash-kpi dash-rise" style={{ animationDelay: `${delay}ms` }}>{body}</div>;
}

export function KpiGrid({ children, columns }: { children: ReactNode; columns?: number }) {
  return <section className="dash-kpis" style={columns ? { ['--kpi-cols' as string]: columns } : undefined} data-cols={columns}>{children}</section>;
}

export function Card({ title, icon, action, children, className = '', delay = 0, id }: { title: ReactNode; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; delay?: number; id?: string }) {
  return <section id={id} className={`dash-card dash-rise ${className}`} style={{ animationDelay: `${delay}ms` }}>
    <header className="dash-card-head"><h2>{icon}{title}</h2>{action}</header>
    {children}
  </section>;
}

export function Empty({ children, small = false }: { children: ReactNode; small?: boolean }) {
  return <div className={`dash-empty ${small ? 'small' : ''}`}><Sparkles size={20} />{children}</div>;
}

export type TrendSeries = { key: string; label: string; values: number[]; color: string; area?: boolean; dashed?: boolean };

/** Time series chart: lines (optionally filled) with a hover readout. */
export function TrendChart({ labels, series, extra, format = iqd, emptyText, height = 290 }: { labels: string[]; series: TrendSeries[]; extra?: { label: string; values: number[]; format?: (n: number) => string }[]; format?: (n: number) => string; emptyText: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000, H = 260, pad = 8, n = labels.length;
  const all = series.flatMap(s => s.values);
  if (!n || !all.some(v => v)) return <Empty>{emptyText}</Empty>;
  const max = Math.max(1, ...all), min = Math.min(0, ...all);
  const x = (i: number) => n === 1 ? W / 2 : pad + (i / (n - 1)) * (W - pad * 2);
  const y = (v: number) => H - 22 - ((v - min) / (max - min || 1)) * (H - 40);
  const path = (values: number[]) => values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => min + (max - min) * t);
  const every = Math.max(1, Math.ceil(n / 8));
  function move(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setHover(Math.round(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * (n - 1)));
  }
  return <div className="dash-chart" dir="ltr" style={{ height }}>
    <div className="dash-chart-axis">{ticks.slice().reverse().map((t, i) => <span key={i}>{compact(t)}</span>)}</div>
    <div className="dash-chart-plot" onPointerMove={move} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={series.map(s => s.label).join(', ')}>
        <defs>{series.filter(s => s.area).map(s => <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity=".26" /><stop offset="100%" stopColor={s.color} stopOpacity="0" /></linearGradient>)}</defs>
        {ticks.map((t, i) => <line key={i} x1="0" x2={W} y1={y(t)} y2={y(t)} className="dash-gridline" vectorEffect="non-scaling-stroke" />)}
        {series.map((s, index) => <g key={s.key}>
          {s.area && <path d={`${path(s.values)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} className="dash-area" fill={`url(#grad-${s.key})`} />}
          <path d={path(s.values)} className={`dash-line ${s.dashed ? 'previous' : ''}`} style={{ stroke: s.color, animationDelay: `${index * 0.2}s` }} pathLength={1} vectorEffect="non-scaling-stroke" />
        </g>)}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1="0" y2={H - 22} className="dash-cursor" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hover != null && <>
        {series.filter(s => !s.dashed).map(s => <i key={s.key} className="dash-dot" style={{ background: s.color, left: `${(x(hover) / W) * 100}%`, top: `calc((100% - 22px) * ${y(s.values[hover] ?? 0) / H})` }} />)}
        <div className={`dash-tip ${hover > n / 2 ? 'left' : ''}`} style={{ left: `${(x(hover) / W) * 100}%` }}>
          <b>{labels[hover]}</b>
          {series.map(s => <span key={s.key}><i className="sw" style={{ background: s.dashed ? `repeating-linear-gradient(90deg,${s.color} 0 3px,transparent 3px 5px)` : s.color }} />{s.label} <strong>{format(s.values[hover] ?? 0)}</strong></span>)}
          {extra?.map(e => <span key={e.label}><i className="sw orders" />{e.label} <strong>{(e.format ?? fmt)(e.values[hover] ?? 0)}</strong></span>)}
        </div>
      </>}
      <div className="dash-chart-x">{labels.map((label, i) => i % every === 0 || i === n - 1 ? <span key={i} style={{ left: `${(x(i) / W) * 100}%` }}>{label.length > 7 ? label.slice(5) : label}</span> : null)}</div>
    </div>
  </div>;
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return <div className="dash-legend-inline">{items.map(item => <span key={item.label}><i className="sw" style={{ background: item.dashed ? `repeating-linear-gradient(90deg,${item.color} 0 3px,transparent 3px 5px)` : item.color }} />{item.label}</span>)}</div>;
}

export type ShareRow = { key: string; label: string; value: number; sub?: string };

export function Donut({ rows, centerLabel, emptyText, format = pct }: { rows: ShareRow[]; centerLabel: string; emptyText: string; format?: (share: number) => string }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  const R = 52, C = 2 * Math.PI * R;
  const offsets = rows.map((_, i) => rows.slice(0, i).reduce((sum, r) => sum + (r.value / (total || 1)) * C, 0));
  if (!total) return <Empty small>{emptyText}</Empty>;
  return <div className="dash-donut">
    <svg viewBox="0 0 140 140" aria-hidden="true">
      <circle cx="70" cy="70" r={R} className="dash-donut-track" />
      {rows.map((r, i) => { const len = (r.value / total) * C; return <circle key={r.key} cx="70" cy="70" r={R} stroke={PALETTE[i % PALETTE.length]} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offsets[i]} className="dash-donut-seg" style={{ animationDelay: `${i * 90}ms` }} />; })}
    </svg>
    <div className="dash-donut-center"><strong>{rows.length}</strong><span>{centerLabel}</span></div>
    <ul className="dash-legend">{rows.map((r, i) => <li key={r.key}><i style={{ background: PALETTE[i % PALETTE.length] }} /><span>{r.label}</span><b>{format(r.value / total)}</b>{r.sub && <small>{r.sub}</small>}</li>)}</ul>
  </div>;
}

export function Bars({ rows, emptyText, format = compact, color }: { rows: ShareRow[]; emptyText: string; format?: (n: number) => string; color?: string }) {
  const max = Math.max(1, ...rows.map(r => Math.abs(r.value)));
  if (!rows.length) return <Empty small>{emptyText}</Empty>;
  return <ul className="dash-bars">{rows.map((r, i) => <li key={r.key}>
    <span className="dash-bar-label" title={r.label}>{r.label}</span>
    <span className="dash-bar-track"><i style={{ width: `${(Math.abs(r.value) / max) * 100}%`, animationDelay: `${i * 70}ms`, ...(color ? { background: color } : {}), ...(r.value < 0 ? { background: '#b3402a' } : {}) }} /></span>
    <span className="dash-bar-value">{format(r.value)}{r.sub && <small>{r.sub}</small>}</span>
  </li>)}</ul>;
}

/** Vertical bars per period (e.g. orders per day). */
export function Columns({ labels, values, format = fmt, color = '#6d4c9a', emptyText }: { labels: string[]; values: number[]; format?: (n: number) => string; color?: string; emptyText: string }) {
  const max = Math.max(1, ...values);
  if (!values.some(v => v)) return <Empty small>{emptyText}</Empty>;
  const every = Math.max(1, Math.ceil(labels.length / 10));
  return <div className="dash-cols" dir="ltr">{values.map((v, i) => <div key={i} className="dash-col" title={`${labels[i]}: ${format(v)}`}><i style={{ height: `${Math.max(v ? 3 : 0, (v / max) * 100)}%`, background: color, animationDelay: `${i * 12}ms` }} /><span>{i % every === 0 ? (labels[i].length > 7 ? labels[i].slice(5) : labels[i]) : ''}</span></div>)}</div>;
}

export function Heatmap({ grid, lang }: { grid: number[][]; lang: Lang }) {
  const days = lang === 'ar' ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const max = Math.max(1, ...grid.flat());
  const total = grid.flat().reduce((s, v) => s + v, 0);
  let best = { day: 0, hour: 0, value: -1 };
  grid.forEach((row, day) => row.forEach((value, hour) => { if (value > best.value) best = { day, hour, value }; }));
  return <div className="dash-heat" dir="ltr">
    <div className="dash-heat-grid">{grid.map((row, day) => <div className="dash-heat-row" key={day}><span className="dash-heat-day">{days[day]}</span>{row.map((value, hour) => <i key={hour} title={`${days[day]} ${String(hour).padStart(2, '0')}:00 · ${value}`} style={{ opacity: value ? 0.15 + 0.85 * (value / max) : 1, animationDelay: `${(day * 24 + hour) * 4}ms` }} className={value ? 'on' : ''} />)}</div>)}
      <div className="dash-heat-hours">{[0, 6, 12, 18, 23].map(h => <b key={h} style={{ left: `calc(36px + (100% - 36px) * ${h / 24})` }}>{String(h).padStart(2, '0')}</b>)}</div>
    </div>
    <p className="dash-foot">{total ? (lang === 'ar' ? `أكثر وقت للطلبات: ${days[best.day]} الساعة ${String(best.hour).padStart(2, '0')}:00 (بتوقيت بغداد)` : `Busiest: ${days[best.day]} at ${String(best.hour).padStart(2, '0')}:00 (Baghdad time)`) : (lang === 'ar' ? 'لا توجد طلبات في هذه الفترة.' : 'No orders in this period.')}</p>
  </div>;
}

/** Period switch shared by dashboard, reports and finance pages. */
export function PeriodNav({ base, period, lang, extra = '' }: { base: string; period: string; lang: Lang; extra?: string }) {
  const periods: [string, string][] = lang === 'ar' ? [['today', 'اليوم'], ['7d', '7 أيام'], ['30d', '30 يوم'], ['90d', '90 يوم'], ['year', 'هذه السنة']] : [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['year', 'This year']];
  return <nav className="dash-periods" aria-label={lang === 'ar' ? 'الفترة' : 'Period'}>{periods.map(([key, label]) => <Link key={key} href={`${base}?period=${key}${extra}`} className={period === key ? 'active' : ''} scroll={false}>{label}</Link>)}</nav>;
}

export function PageHero({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return <header className="dash-hero dash-rise">
    <div>{eyebrow && <span className="dash-eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="dash-hero-actions">{actions}</div>}
  </header>;
}

/** Revenue → costs → profit bridge (dark strip). */
export function Bridge({ steps }: { steps: { label: ReactNode; value: number; op?: '−' | '=' | '+'; total?: boolean }[] }) {
  return <section className="dash-pnl dash-rise">{steps.map((step, i) => <span key={i} style={{ display: 'contents' }}>
    {step.op && <em>{step.op}</em>}
    <div className={step.total ? `total ${step.value < 0 ? 'negative' : ''}` : ''}><span>{step.label}</span><strong><CountUp value={step.value} format={iqd} /></strong></div>
  </span>)}</section>;
}
