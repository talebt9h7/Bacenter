'use client';

/**
 * Chart kit for Admin → Reports (Nasaq style, UR brown).
 * Built to the data-viz method: the form follows the data's job, thin marks, hairline solid grid,
 * one hue per single series, the previous period as a grey context line, values lead in tooltips,
 * selective direct labels, keyboard focus shows what hover shows. Colours were run through the
 * palette validator against white: brown #9c5a1f + green #0f9f6e pass every check.
 */
import Link from 'next/link';
import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { CountUp, change, compact, fmt, type Lang } from './dash-ui';

export const RC = {
  brown: '#9c5a1f', brownSoft: '#f3e7da', green: '#0f9f6e', prev: '#cbd5e1', blue: '#3b82f6',
  good: '#16a34a', warning: '#f59e0b', serious: '#ec835a', critical: '#d03b3b', info: '#3b82f6', violet: '#8b5cf6', other: '#cbd5e1',
};
/** Sequential brown ramp (light → dark) for magnitude grids. */
const RAMP = ['#f6ede3', '#e9d2b9', '#d4ab80', '#b9814a', '#9c5a1f', '#6f3d10'];

/** Long daily series read better by week: sums each run of `size` points (labels keep the first day). */
export function bucket(labels: string[], series: number[][], size = 7) {
  if (labels.length <= 45) return { labels, series };
  const out: number[][] = series.map(() => []), outLabels: string[] = [];
  for (let i = 0; i < labels.length; i += size) {
    outLabels.push(labels[i]);
    series.forEach((vals, k) => out[k].push(vals.slice(i, i + size).reduce((s, v) => s + v, 0)));
  }
  return { labels: outLabels, series: out };
}

/** Clean axis ticks: 0 and three or four round steps up to just above the max. */
function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count, mag = 10 ** Math.floor(Math.log10(raw)), n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v));
  if (ticks[ticks.length - 1] < max) ticks.push(Math.round(ticks[ticks.length - 1] + step));
  return ticks;
}
const axisLabel = (v: number) => (Math.abs(v) >= 10_000 ? compact(v) : fmt(v));
const shortDay = (key: string) => (key.length > 7 ? key.slice(5).replace('-', '/') : key);

/** Signed change vs the previous period; colour = direction × whether up is good. */
export function DeltaPill({ current, previous, inverse = false, lang }: { current: number; previous: number; inverse?: boolean; lang: Lang }) {
  if (!current && !previous) return null;
  const c = change(current, previous);
  const good = inverse ? c.value < 0 : c.value > 0;
  const tone = c.value === 0 || !Number.isFinite(c.value) ? 'flat' : good ? 'up' : 'down';
  const label = c.label === 'new' ? (lang === 'ar' ? 'جديد' : 'New') : c.label;
  return <span className={`rc-delta ${tone}`} title={lang === 'ar' ? `الفترة السابقة: ${fmt(previous)}` : `Previous period: ${fmt(previous)}`}>
    {c.value > 0 ? <ArrowUpRight size={12} /> : c.value < 0 ? <ArrowDownRight size={12} /> : <Minus size={12} />}{label}
  </span>;
}

/** Twelve-ish point trend in the de-emphasis grey, the latest point in the accent. */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2 || !values.some(Boolean)) return null;
  const pts = values.slice(-14), max = Math.max(...pts, 1), min = Math.min(...pts, 0);
  const x = (i: number) => (i / (pts.length - 1)) * 100, y = (v: number) => 26 - ((v - min) / (max - min || 1)) * 22;
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return <svg className="rc-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
    <path d={d} fill="none" stroke="#cbd5e1" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="2.6" fill={RC.brown} stroke="#fff" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
  </svg>;
}

export type Tone = 'brown' | 'green' | 'blue' | 'amber' | 'violet' | 'red' | 'slate';

/** Stat tile: label · value · change vs previous period · one line of context · optional trend. */
export function StatTile({ icon, tone = 'brown', label, value, format, current, previous, inverse, hint, spark, href, lang, delay = 0 }: {
  icon: ReactNode; tone?: Tone; label: string; value: number; format?: (n: number) => string; current?: number; previous?: number; inverse?: boolean;
  hint?: ReactNode; spark?: number[]; href?: string; lang: Lang; delay?: number;
}) {
  const body = <>
    <div className="rc-tile-top"><span className="rc-tile-label">{label}</span><span className={`rc-icon ${tone}`}>{icon}</span></div>
    <div className="rc-tile-value"><strong><CountUp value={value} format={format} /></strong>{previous !== undefined && <DeltaPill current={current ?? value} previous={previous} inverse={inverse} lang={lang} />}</div>
    <div className="rc-tile-foot">{hint && <small>{hint}</small>}{spark && <Spark values={spark} />}</div>
  </>;
  const style = { animationDelay: `${delay}ms` };
  return href ? <Link href={href} className="rc-tile rc-rise" style={style}>{body}</Link> : <div className="rc-tile rc-rise" style={style}>{body}</div>;
}

export function Panel({ title, sub, icon, action, children, className = '', delay = 0 }: { title: ReactNode; sub?: ReactNode; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; delay?: number }) {
  return <section className={`rc-panel rc-rise ${className}`} style={{ animationDelay: `${delay}ms` }}>
    <header className="rc-panel-head"><div>{icon && <span className="rc-panel-icon">{icon}</span>}<div><h2>{title}</h2>{sub && <p>{sub}</p>}</div></div>{action}</header>
    {children}
  </section>;
}

export function LegendKeys({ items }: { items: { label: string; color: string; kind?: 'line' | 'box' }[] }) {
  return <ul className="rc-legend">{items.map(i => <li key={i.label}><i className={i.kind === 'box' ? 'box' : 'line'} style={{ background: i.color }} />{i.label}</li>)}</ul>;
}

export type TrendLine = { key: string; label: string; values: number[]; color: string; area?: boolean; context?: boolean };

/**
 * Time-series line chart with a crosshair readout. The main series carries a 10% wash; a context
 * series (the previous period) is a thin grey line. The last value of the main series is labelled.
 */
export function TrendChart({ labels, lines, format = fmt, height = 240, emptyText, lang }: { labels: string[]; lines: TrendLine[]; format?: (n: number) => string; height?: number; emptyText: string; lang: Lang }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const all = lines.flatMap(l => l.values);
  if (!n || !all.some(v => v)) return <div className="rc-empty">{emptyText}</div>;
  const ticks = niceTicks(Math.max(...all, 1));
  const top = ticks[ticks.length - 1];
  const W = 1000, H = 1000;
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - (Math.max(0, v) / top) * H;
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const main = lines.find(l => !l.context) ?? lines[0];
  const every = Math.max(1, Math.ceil(n / 7));
  const at = hover ?? null;
  function move(e: PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (n - 1)));
  }
  function key(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowRight') { e.preventDefault(); setHover(h => Math.min(n - 1, (h ?? -1) + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setHover(h => Math.max(0, (h ?? n) - 1)); }
    if (e.key === 'Escape') setHover(null);
  }
  const last = main.values[n - 1] ?? 0;
  return <div className="rc-trend" dir="ltr" style={{ ['--h' as string]: `${height}px` }}>
    <div className="rc-trend-y">{ticks.slice().reverse().map(t => <span key={t}>{axisLabel(t)}</span>)}</div>
    <div className="rc-trend-plot" tabIndex={0} role="img" aria-label={lines.map(l => l.label).join(' · ')} onPointerMove={move} onPointerLeave={() => setHover(null)} onFocus={() => setHover(h => h ?? n - 1)} onBlur={() => setHover(null)} onKeyDown={key}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>{lines.filter(l => l.area).map(l => <linearGradient key={l.key} id={`rc-g-${l.key}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={l.color} stopOpacity=".16" /><stop offset="100%" stopColor={l.color} stopOpacity=".02" /></linearGradient>)}</defs>
        {ticks.map(t => <line key={t} x1="0" x2={W} y1={y(t)} y2={y(t)} className="rc-gridline" vectorEffect="non-scaling-stroke" />)}
        {lines.map(l => <g key={l.key}>
          {l.area && <path d={`${path(l.values)} L${x(n - 1)},${H} L${x(0)},${H} Z`} fill={`url(#rc-g-${l.key})`} className="rc-area" />}
          <path d={path(l.values)} fill="none" stroke={l.color} strokeWidth={l.context ? 1.5 : 2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className={l.context ? 'rc-line ctx' : 'rc-line'} />
        </g>)}
        {at != null && <line x1={x(at)} x2={x(at)} y1="0" y2={H} className="rc-cross" vectorEffect="non-scaling-stroke" />}
      </svg>
      {/* End marker + label on the main series (HTML so the text never stretches). */}
      {at == null && <><i className="rc-dot" style={{ left: `${(x(n - 1) / W) * 100}%`, top: `${(y(last) / H) * 100}%`, background: main.color }} />
        <span className="rc-endlabel" style={{ top: `${(y(last) / H) * 100}%` }}>{format(last)}</span></>}
      {at != null && <>
        {lines.map(l => <i key={l.key} className={`rc-dot ${l.context ? 'ctx' : ''}`} style={{ left: `${(x(at) / W) * 100}%`, top: `${(y(l.values[at] ?? 0) / H) * 100}%`, background: l.color }} />)}
        <div className={`rc-tip ${at > n / 2 ? 'flip' : ''}`} style={{ left: `${(x(at) / W) * 100}%` }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <b className="rc-tip-head">{labels[at]}</b>
          {lines.map(l => <span key={l.key}><i style={{ background: l.color }} /><strong>{format(l.values[at] ?? 0)}</strong><em>{l.label}</em></span>)}
        </div>
      </>}
    </div>
    <div className="rc-trend-x">{labels.map((l, i) => (i % every === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= every * 0.6) ? <span key={i} className={(i / every) % 2 === 1 && i !== n - 1 ? 'alt' : ''} style={{ left: `${(x(i) / W) * 100}%` }}>{shortDay(l)}</span> : null)}</div>
  </div>;
}

/** Vertical columns per day, one hue, value on the tallest cap, per-column tooltip. */
export function ColumnChart({ labels, values, format = fmt, height = 180, emptyText, unit = '' }: { labels: string[]; values: number[]; format?: (n: number) => string; height?: number; emptyText: string; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!values.some(v => v)) return <div className="rc-empty">{emptyText}</div>;
  const ticks = niceTicks(Math.max(...values, 1), 3), top = ticks[ticks.length - 1];
  const peak = values.indexOf(Math.max(...values));
  const every = Math.max(1, Math.ceil(labels.length / 7));
  return <div className="rc-cols" dir="ltr" style={{ ['--h' as string]: `${height}px` }}>
    <div className="rc-cols-y">{ticks.slice().reverse().map(t => <span key={t}>{axisLabel(t)}</span>)}</div>
    <div className="rc-cols-plot">
      {ticks.map(t => <i key={t} className="rc-cols-grid" style={{ bottom: `${(t / top) * 100}%` }} />)}
      <div className="rc-cols-bars">{values.map((v, i) => <button type="button" key={i} className={`rc-col ${hover === i ? 'on' : ''}`} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} aria-label={`${labels[i]}: ${format(v)}${unit}`}>
        <span className="rc-col-bar" style={{ height: `${(v / top) * 100}%`, animationDelay: `${i * 14}ms` }}>{i === peak && hover == null && v > 0 && <em>{format(v)}</em>}</span>
        {hover === i && <span className="rc-col-tip"><strong>{format(v)}{unit}</strong><small>{labels[i]}</small></span>}
      </button>)}</div>
    </div>
    <div className="rc-cols-x">{labels.map((l, i) => <span key={i}>{i % every === 0 ? shortDay(l) : ''}</span>)}</div>
  </div>;
}

export type RankRow = { key: string; label: ReactNode; value: number; sub?: ReactNode; href?: string; swatch?: string };

/** Ranked horizontal bars: one hue, largest first, value at the tip, optional share of the total. */
export function RankedBars({ rows, format = compact, color = RC.brown, share = false, emptyText, limit }: { rows: RankRow[]; format?: (n: number) => string; color?: string; share?: boolean; emptyText: string; limit?: number }) {
  const list = limit ? rows.slice(0, limit) : rows;
  if (!list.length || !list.some(r => r.value)) return <div className="rc-empty">{emptyText}</div>;
  const max = Math.max(...list.map(r => Math.abs(r.value)), 1), total = rows.reduce((s, r) => s + Math.max(0, r.value), 0) || 1;
  return <ul className="rc-rank">{list.map((r, i) => {
    const inner = <>
      <span className="rc-rank-name">{r.swatch && <i style={{ background: r.swatch }} />}<span>{r.label}</span>{r.sub && <small>{r.sub}</small>}</span>
      <span className="rc-rank-track"><b style={{ width: `${Math.max(r.value ? 1.5 : 0, (Math.abs(r.value) / max) * 100)}%`, background: r.value < 0 ? RC.critical : color, animationDelay: `${i * 60}ms` }} /></span>
      <span className="rc-rank-val"><strong>{format(r.value)}</strong>{share && <small>{Math.round((Math.max(0, r.value) / total) * 100)}%</small>}</span>
    </>;
    return <li key={r.key}>{r.href ? <Link href={r.href}>{inner}</Link> : <div>{inner}</div>}</li>;
  })}</ul>;
}

export type Part = { key: string; label: string; value: number; color: string };

/** One whole split into ≤ 6 parts: a tall segmented bar with shares printed where they fit, legend below. */
export function SegmentedBar({ parts, format = fmt, emptyText }: { parts: Part[]; format?: (n: number) => string; emptyText: string }) {
  const shown = parts.filter(p => p.value > 0);
  const total = shown.reduce((s, p) => s + p.value, 0);
  if (!total) return <div className="rc-empty">{emptyText}</div>;
  const darkText = (hex: string) => ['#f59e0b', '#cbd5e1', '#ec835a'].includes(hex);
  return <div className="rc-seg">
    <div className="rc-seg-bar" role="img" aria-label={shown.map(p => `${p.label} ${format(p.value)} (${Math.round((p.value / total) * 100)}%)`).join('، ')}>
      {shown.map((p, i) => { const s = p.value / total; return <span key={p.key} title={`${p.label}: ${format(p.value)} · ${Math.round(s * 100)}%`} style={{ flexGrow: p.value, background: p.color, color: darkText(p.color) ? '#0b0b0b' : '#fff', animationDelay: `${i * 70}ms` }}>{s >= 0.1 ? `${Math.round(s * 100)}%` : ''}</span>; })}
    </div>
    <ul className="rc-seg-legend">{shown.map(p => { const s = p.value / total; return <li key={p.key}><i style={{ background: p.color }} /><span>{p.label}</span><b>{format(p.value)}</b>{s < 0.1 && <small>{Math.round(s * 100)}%</small>}</li>; })}</ul>
  </div>;
}

export type Step = { label: ReactNode; value: number; kind: 'start' | 'minus' | 'subtotal' | 'total' };

/** Revenue → costs → profit as a horizontal waterfall: totals in brown, costs as grey drops, net green (red if a loss). */
export function Waterfall({ steps, format = fmt }: { steps: Step[]; format?: (n: number) => string }) {
  const start = Math.max(1, ...steps.map(s => Math.abs(s.value)));
  // Each step's span on the axis, worked out before rendering (costs hang down from the running total).
  const spans = steps.reduce<{ running: number; out: [number, number][] }>((acc, s) => {
    if (s.kind === 'start') { acc.out.push([0, s.value]); acc.running = s.value; }
    else if (s.kind === 'minus') { acc.out.push([acc.running - s.value, acc.running]); acc.running -= s.value; }
    else { acc.out.push([Math.min(0, s.value), Math.max(0, s.value)]); acc.running = s.value; }
    return acc;
  }, { running: 0, out: [] }).out;
  return <ul className="rc-fall">{steps.map((s, i) => {
    const [from, to] = spans[i];
    const left = (Math.max(0, Math.min(from, to)) / start) * 100, width = (Math.abs(to - from) / start) * 100;
    const cls = s.kind === 'minus' ? 'minus' : s.kind === 'total' ? (s.value < 0 ? 'loss' : 'net') : 'total';
    return <li key={i} className={cls}>
      <span className="rc-fall-label">{s.label}</span>
      <span className="rc-fall-track"><b style={{ insetInlineStart: `${left}%`, width: `${Math.max(s.value ? 1 : 0, width)}%`, animationDelay: `${i * 80}ms` }} /></span>
      <span className="rc-fall-val">{(s.kind === 'minus' && s.value) || (s.kind === 'total' && s.value < 0) ? '−' : ''}{format(Math.abs(s.value))}</span>
    </li>;
  })}</ul>;
}

/** Day × hour grid on the sequential brown ramp, with a scale legend and the busiest slot named. */
export function HeatGrid({ grid, lang }: { grid: number[][]; lang: Lang }) {
  const days = lang === 'ar' ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const max = Math.max(1, ...grid.flat()), total = grid.flat().reduce((s, v) => s + v, 0);
  let best = { d: 0, h: 0, v: -1 };
  grid.forEach((row, d) => row.forEach((v, h) => { if (v > best.v) best = { d, h, v }; }));
  const step = (v: number) => (v ? RAMP[Math.min(RAMP.length - 1, Math.ceil((v / max) * (RAMP.length - 1)))] : '#f1f5f9');
  return <div className="rc-heat">
    <div className="rc-heat-grid" dir="ltr">
      {grid.map((row, d) => <div key={d} className="rc-heat-row"><span>{days[d]}</span>{row.map((v, h) => <i key={h} title={`${days[d]} ${String(h).padStart(2, '0')}:00 — ${v}`} style={{ background: step(v) }} />)}</div>)}
      <div className="rc-heat-hours"><span />{Array.from({ length: 24 }, (_, h) => <b key={h}>{h % 3 === 0 ? String(h).padStart(2, '0') : ''}</b>)}</div>
    </div>
    <div className="rc-heat-foot">
      <p>{total ? (lang === 'ar' ? <>أكثر وقت تجي بيه الطلبات: <b>{days[best.d]} الساعة {String(best.h).padStart(2, '0')}:00</b></> : <>Busiest: <b>{days[best.d]} at {String(best.h).padStart(2, '0')}:00</b></>) : (lang === 'ar' ? 'لا توجد طلبات بالفترة.' : 'No orders in this period.')}</p>
      <span className="rc-scale">{lang === 'ar' ? 'أقل' : 'Less'}{RAMP.map(c => <i key={c} style={{ background: c }} />)}{lang === 'ar' ? 'أكثر' : 'More'}</span>
    </div>
  </div>;
}

/** A single ratio against its whole. */
export function Meter({ value, label, sub, tone = 'brown' }: { value: number; label: ReactNode; sub?: ReactNode; tone?: 'brown' | 'green' | 'red' | 'amber' }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return <div className={`rc-meter ${tone}`}>
    <div className="rc-meter-top"><span>{label}</span><strong>{Math.round(v * 1000) / 10}%</strong></div>
    <span className="rc-meter-track"><b style={{ width: `${v * 100}%` }} /></span>
    {sub && <small>{sub}</small>}
  </div>;
}

/** Small figure cells in a grey box (secondary numbers under a chart). */
export function Figures({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return <dl className="rc-figs" style={{ ['--n' as string]: items.length === 4 ? 2 : Math.min(items.length, 3) }}>{items.map((it, i) => <div key={i}><dt>{it.label}</dt><dd>{it.value}</dd></div>)}</dl>;
}
