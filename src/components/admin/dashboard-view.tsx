'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, CalendarDays, CircleDollarSign, Clock, Coins, Flame, Layers, MapPin, MessageSquare, Package, PackageX, Plus, Receipt, RefreshCw, ShoppingBag, ShoppingCart, Sparkles, Truck, Users, Wallet } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { DashboardData } from '@/lib/dashboard-data';

type Lang = 'ar' | 'en';
const STATUS_AR: Record<string, string> = { pending: 'قيد الانتظار', confirmed: 'مؤكد', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي', returned: 'مرتجع' };
const STATUS_EN: Record<string, string> = { pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', returned: 'Returned' };
const SOURCE_AR: Record<string, string> = { website: 'الموقع', instagram: 'إنستغرام', whatsapp: 'واتساب', facebook: 'فيسبوك', phone: 'هاتف', store: 'المتجر', other: 'أخرى', tiktok: 'تيك توك' };
const PALETTE = ['#cd4c20', '#2f6b4f', '#3d5a80', '#c08a2b', '#7a5195', '#5f8575', '#a1593f', '#8d99ae'];
const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const fmt = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const iqd = (n: number) => `${fmt(n)} IQD`;
const compact = (n: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;
function change(current: number, previous: number) {
  if (!previous) return current ? { label: 'new', value: 1 } : { label: '—', value: 0 };
  const value = (current - previous) / Math.abs(previous);
  return { label: `${value > 0 ? '+' : ''}${(value * 100).toFixed(Math.abs(value) < 0.1 ? 1 : 0)}%`, value };
}
function ago(iso: string, lang: Lang) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return lang === 'ar' ? `قبل ${minutes} د` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return lang === 'ar' ? `قبل ${hours} س` : `${hours}h ago`;
  return lang === 'ar' ? `قبل ${Math.round(hours / 24)} يوم` : `${Math.round(hours / 24)}d ago`;
}

/** Counts up to the value once it scrolls into view. Static for people who prefer reduced motion. */
function CountUp({ value, format = fmt }: { value: number; format?: (n: number) => string }) {
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

function Delta({ current, previous, inverse = false, lang }: { current: number; previous: number; inverse?: boolean; lang: Lang }) {
  const c = change(current, previous);
  const good = inverse ? c.value < 0 : c.value > 0;
  const tone = c.value === 0 ? 'flat' : good ? 'up' : 'down';
  const label = c.label === 'new' ? (lang === 'ar' ? 'جديد' : 'New') : c.label;
  return <span className={`dash-delta ${tone}`} title={lang === 'ar' ? `الفترة السابقة: ${fmt(previous)}` : `Previous period: ${fmt(previous)}`}>{c.value > 0 ? <ArrowUpRight size={13} /> : c.value < 0 ? <ArrowDownRight size={13} /> : null}{label}</span>;
}

function Sparkline({ values, tone = 'accent' }: { values: number[]; tone?: string }) {
  if (values.length < 2) return <svg className="dash-spark" viewBox="0 0 100 30" aria-hidden="true" />;
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 26}`).join(' ');
  return <svg className={`dash-spark ${tone}`} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
    <polygon points={`0,30 ${points} 100,30`} className="dash-spark-area" />
    <polyline points={points} pathLength={1} className="dash-spark-line" vectorEffect="non-scaling-stroke" />
  </svg>;
}

function Kpi({ icon, label, value, format, current, previous, inverse, spark, note, tone, lang, href, delay }: { icon: ReactNode; label: string; value: number; format?: (n: number) => string; current: number; previous: number; inverse?: boolean; spark?: number[]; note?: ReactNode; tone?: string; lang: Lang; href?: string; delay: number }) {
  const body = <>
    <div className="dash-kpi-top"><span className={`dash-kpi-icon ${tone ?? ''}`}>{icon}</span><span className="dash-kpi-label">{label}</span></div>
    <div className="dash-kpi-row"><strong className="dash-kpi-value"><CountUp value={value} format={format} /></strong><Delta current={current} previous={previous} inverse={inverse} lang={lang} /></div>
    {note && <small className="dash-kpi-note">{note}</small>}
    {spark && <Sparkline values={spark} tone={tone} />}
  </>;
  return href ? <Link href={href} className="dash-kpi dash-rise" style={{ animationDelay: `${delay}ms` }}>{body}</Link> : <div className="dash-kpi dash-rise" style={{ animationDelay: `${delay}ms` }}>{body}</div>;
}

function Card({ title, icon, action, children, className = '', delay = 0 }: { title: ReactNode; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; delay?: number }) {
  return <section className={`dash-card dash-rise ${className}`} style={{ animationDelay: `${delay}ms` }}>
    <header className="dash-card-head"><h2>{icon}{title}</h2>{action}</header>
    {children}
  </section>;
}

/** Revenue (area), profit (line) and the previous period's revenue (dashed), with a hover readout. */
function RevenueChart({ data, finance, lang }: { data: DashboardData['daily']; finance: boolean; lang: Lang }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000, H = 260, pad = 8;
  const max = Math.max(1, ...data.map(d => Math.max(d.revenue, d.previousRevenue, d.profit)));
  const min = Math.min(0, ...data.map(d => d.profit));
  const x = (i: number) => data.length === 1 ? W / 2 : pad + (i / (data.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - 22 - ((v - min) / (max - min || 1)) * (H - 40);
  const path = (pick: (d: DashboardData['daily'][number]) => number) => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(pick(d)).toFixed(1)}`).join(' ');
  const revenuePath = path(d => d.revenue);
  const area = `${revenuePath} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => min + (max - min) * t);
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  const point = hover != null ? data[hover] : null;
  function move(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (data.length - 1)));
  }
  const total = data.reduce((s, d) => s + d.revenue, 0);
  if (!total && !data.some(d => d.previousRevenue)) return <div className="dash-empty"><Sparkles size={22} />{lang === 'ar' ? 'لا توجد مبيعات مُسلّمة في هذه الفترة بعد.' : 'No delivered sales in this period yet.'}</div>;
  return <div className="dash-chart" dir="ltr">
    <div className="dash-chart-axis">{ticks.slice().reverse().map((t, i) => <span key={i}>{compact(t)}</span>)}</div>
    <div className="dash-chart-plot" onPointerMove={move} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={lang === 'ar' ? 'مخطط الإيرادات والأرباح' : 'Revenue and profit chart'}>
        <defs><linearGradient id="dashRevenue" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#cd4c20" stopOpacity=".28" /><stop offset="100%" stopColor="#cd4c20" stopOpacity="0" /></linearGradient></defs>
        {ticks.map((t, i) => <line key={i} x1="0" x2={W} y1={y(t)} y2={y(t)} className="dash-gridline" vectorEffect="non-scaling-stroke" />)}
        <path d={path(d => d.previousRevenue)} className="dash-line previous" pathLength={1} vectorEffect="non-scaling-stroke" />
        <path d={area} className="dash-area" fill="url(#dashRevenue)" />
        <path d={revenuePath} className="dash-line revenue" pathLength={1} vectorEffect="non-scaling-stroke" />
        {finance && <path d={path(d => d.profit)} className="dash-line profit" pathLength={1} vectorEffect="non-scaling-stroke" />}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1="0" y2={H - 22} className="dash-cursor" vectorEffect="non-scaling-stroke" />}
      </svg>
      {point && <>
        <i className="dash-dot revenue" style={{ left: `${(x(hover!) / W) * 100}%`, top: `calc((100% - 22px) * ${y(point.revenue) / H})` }} />
        {finance && <i className="dash-dot profit" style={{ left: `${(x(hover!) / W) * 100}%`, top: `calc((100% - 22px) * ${y(point.profit) / H})` }} />}
        <div className={`dash-tip ${hover! > data.length / 2 ? 'left' : ''}`} style={{ left: `${(x(hover!) / W) * 100}%` }}>
          <b>{point.key}</b>
          <span><i className="sw revenue" />{lang === 'ar' ? 'الإيراد' : 'Revenue'} <strong>{iqd(point.revenue)}</strong></span>
          {finance && <span><i className="sw profit" />{lang === 'ar' ? 'الربح' : 'Profit'} <strong>{iqd(point.profit)}</strong></span>}
          <span><i className="sw previous" />{lang === 'ar' ? 'الفترة السابقة' : 'Previous'} <strong>{iqd(point.previousRevenue)}</strong></span>
          <span><i className="sw orders" />{lang === 'ar' ? 'طلبات جديدة' : 'New orders'} <strong>{point.orders}</strong></span>
        </div>
      </>}
      <div className="dash-chart-x">{data.map((d, i) => i % labelEvery === 0 || i === data.length - 1 ? <span key={d.key} style={{ left: `${(x(i) / W) * 100}%` }}>{d.key.length > 7 ? d.key.slice(5) : d.key}</span> : null)}</div>
    </div>
  </div>;
}

function Donut({ rows, lang }: { rows: { key: string; revenue: number; orders: number }[]; lang: Lang }) {
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  const R = 52, C = 2 * Math.PI * R;
  const offsets = rows.map((_, i) => rows.slice(0, i).reduce((sum, r) => sum + (r.revenue / (total || 1)) * C, 0));
  if (!total) return <div className="dash-empty small">{lang === 'ar' ? 'لا توجد بيانات بعد.' : 'No data yet.'}</div>;
  return <div className="dash-donut">
    <svg viewBox="0 0 140 140" aria-hidden="true">
      <circle cx="70" cy="70" r={R} className="dash-donut-track" />
      {rows.map((r, i) => { const len = (r.revenue / total) * C; return <circle key={r.key} cx="70" cy="70" r={R} stroke={PALETTE[i % PALETTE.length]} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offsets[i]} className="dash-donut-seg" style={{ animationDelay: `${i * 90}ms` }} />; })}
    </svg>
    <div className="dash-donut-center"><strong>{rows.length}</strong><span>{lang === 'ar' ? 'مصادر' : 'sources'}</span></div>
    <ul className="dash-legend">{rows.map((r, i) => <li key={r.key}><i style={{ background: PALETTE[i % PALETTE.length] }} /><span>{lang === 'ar' ? SOURCE_AR[r.key] ?? r.key : r.key.replace(/^./, c => c.toUpperCase())}</span><b>{pct(r.revenue / total)}</b><small>{r.orders} {lang === 'ar' ? 'طلب' : 'orders'}</small></li>)}</ul>
  </div>;
}

function Bars({ rows, lang }: { rows: DashboardData['byGovernorate']; lang: Lang }) {
  const max = Math.max(1, ...rows.map(r => r.revenue));
  if (!rows.length) return <div className="dash-empty small">{lang === 'ar' ? 'لا توجد بيانات بعد.' : 'No data yet.'}</div>;
  return <ul className="dash-bars">{rows.map((r, i) => <li key={r.key}>
    <span className="dash-bar-label">{lang === 'ar' ? r.nameAr : r.nameEn}</span>
    <span className="dash-bar-track"><i style={{ width: `${(r.revenue / max) * 100}%`, animationDelay: `${i * 70}ms` }} /></span>
    <span className="dash-bar-value">{compact(r.revenue)}<small>{r.orders}</small></span>
  </li>)}</ul>;
}

function Heatmap({ grid, lang }: { grid: number[][]; lang: Lang }) {
  const max = Math.max(1, ...grid.flat());
  const total = grid.flat().reduce((s, v) => s + v, 0);
  let best = { day: 0, hour: 0, value: -1 };
  grid.forEach((row, day) => row.forEach((value, hour) => { if (value > best.value) best = { day, hour, value }; }));
  const days = lang === 'ar' ? WEEKDAYS_AR : WEEKDAYS_EN;
  return <div className="dash-heat" dir="ltr">
    <div className="dash-heat-grid">{grid.map((row, day) => <div className="dash-heat-row" key={day}><span className="dash-heat-day">{days[day]}</span>{row.map((value, hour) => <i key={hour} title={`${days[day]} ${String(hour).padStart(2, '0')}:00 · ${value}`} style={{ opacity: value ? 0.15 + 0.85 * (value / max) : 1, animationDelay: `${(day * 24 + hour) * 4}ms` }} className={value ? 'on' : ''} />)}</div>)}
      <div className="dash-heat-hours"><span />{[0, 6, 12, 18, 23].map(h => <b key={h} style={{ left: `calc(36px + (100% - 36px) * ${h / 24})` }}>{String(h).padStart(2, '0')}</b>)}</div>
    </div>
    <p className="dash-foot">{total ? (lang === 'ar' ? `أكثر وقت للطلبات: ${days[best.day]} الساعة ${String(best.hour).padStart(2, '0')}:00 (بتوقيت بغداد)` : `Busiest: ${days[best.day]} at ${String(best.hour).padStart(2, '0')}:00 (Baghdad time)`) : (lang === 'ar' ? 'لا توجد طلبات في هذه الفترة.' : 'No orders in this period.')}</p>
  </div>;
}

export function DashboardView({ data, adminName }: { data: DashboardData; adminName?: string }) {
  const { language } = useLanguage();
  const lang: Lang = language === 'ar' ? 'ar' : 'en';
  const tt = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const status = (s: string) => (lang === 'ar' ? STATUS_AR : STATUS_EN)[s] ?? s;
  const m = data.money, p = data.moneyPrevious;
  const spark = useMemo(() => ({ revenue: data.daily.map(d => d.revenue), profit: data.daily.map(d => d.profit), orders: data.daily.map(d => d.orders) }), [data.daily]);
  const periods: [string, string][] = [['today', tt('Today', 'اليوم')], ['7d', tt('7 days', '7 أيام')], ['30d', tt('30 days', '30 يوم')], ['90d', tt('90 days', '90 يوم')], ['year', tt('This year', 'هذه السنة')]];
  const range = `${new Date(data.from).toLocaleDateString(lang === 'ar' ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Baghdad' })} – ${new Date(data.to).toLocaleDateString(lang === 'ar' ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Baghdad' })}`;
  const hour = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Baghdad' }));
  const greeting = hour < 12 ? tt('Good morning', 'صباح الخير') : hour < 18 ? tt('Good afternoon', 'مساء الخير') : tt('Good evening', 'مساء الخير');
  const net = data.expenses ? m.profit - data.expenses.current : 0;
  const netPrev = data.expenses ? p.profit - data.expenses.previous : 0;
  const inv = data.inventory;
  const pipelineMax = Math.max(1, ...data.pipeline.map(s => s.orders));
  const att = data.attention;
  const attention = [
    att.stalePending && { tone: 'warning', icon: <Clock size={15} />, text: tt(`${att.stalePending} pending orders older than 24 hours — confirm them by phone`, `${att.stalePending} طلب قيد الانتظار أقدم من 24 ساعة — أكّدها بالاتصال`), href: '/admin/orders' },
    att.lateShipments && { tone: 'danger', icon: <Truck size={15} />, text: tt(`${att.lateShipments} shipments in transit for over 7 days`, `${att.lateShipments} شحنة بالطريق لأكثر من 7 أيام`), href: '/admin/orders' },
    att.reservedButOut && { tone: 'danger', icon: <PackageX size={15} />, text: tt(`${att.reservedButOut} colours have more units reserved than in stock`, `${att.reservedButOut} لون محجوز منه أكثر من الموجود بالمخزون`), href: '/admin/inventory' },
    inv.soldOut && { tone: 'warning', icon: <PackageX size={15} />, text: tt(`${inv.soldOut} published colours are sold out`, `${inv.soldOut} لون منشور نفد من المخزون`), href: '/admin/inventory' },
    att.unknownCostUnits && data.finance && { tone: 'info', icon: <Coins size={15} />, text: tt(`${att.unknownCostUnits} units in stock have no purchase cost — profit on them can’t be measured`, `${att.unknownCostUnits} قطعة بالمخزون بدون تكلفة شراء — ربحها ما ينحسب`), href: '/admin/inventory' },
    att.noPhotos && { tone: 'info', icon: <Package size={15} />, text: tt(`${att.noPhotos} published colours have no photos`, `${att.noPhotos} لون منشور بدون صور`), href: '/admin/products' },
    att.openMessages && { tone: 'info', icon: <MessageSquare size={15} />, text: tt(`${att.openMessages} customer messages waiting`, `${att.openMessages} رسالة زبون بانتظار الرد`), href: '/admin/messages' },
  ].filter(Boolean) as { tone: string; icon: ReactNode; text: string; href: string }[];

  return <main className="admin-page dash" data-period={data.period}>
    <header className="dash-hero dash-rise">
      <div>
        <span className="dash-eyebrow"><CalendarDays size={13} /> {range}</span>
        <h1>{greeting}{adminName ? `${lang === 'ar' ? '، ' : ', '}${adminName}` : ''}</h1>
        <p>{tt('Live overview of sales, orders, stock and customers. Revenue and profit count delivered orders on their delivery date; delivery fees are kept apart.', 'نظرة حية على المبيعات والطلبات والمخزون والزبائن. الإيراد والربح يُحتسبان للطلبات المُسلّمة بتاريخ التسليم، وأجور التوصيل منفصلة.')}</p>
      </div>
      <div className="dash-hero-actions">
        <nav className="dash-periods" aria-label={tt('Period', 'الفترة')}>{periods.map(([key, label]) => <Link key={key} href={`/admin?period=${key}`} className={data.period === key ? 'active' : ''} scroll={false}>{label}</Link>)}</nav>
        <div className="dash-quick"><Link href="/admin/orders" className="dash-btn primary"><Plus size={15} /> {tt('Manual order', 'طلب يدوي')}</Link><Link href="/admin/products/new" className="dash-btn"><Package size={15} /> {tt('New product', 'منتج جديد')}</Link><Link href={`/admin?period=${data.period}`} className="dash-btn icon" title={tt('Refresh', 'تحديث')} aria-label={tt('Refresh', 'تحديث')}><RefreshCw size={15} /></Link></div>
      </div>
    </header>

    <section className="dash-kpis">
      <Kpi lang={lang} delay={0} icon={<CircleDollarSign size={17} />} tone="accent" label={tt('Product revenue', 'إيراد المنتجات')} value={m.revenue} format={iqd} current={m.revenue} previous={p.revenue} spark={spark.revenue} note={tt(`${fmt(m.discounts)} IQD discounts · delivery excluded`, `خصومات ${fmt(m.discounts)} د.ع · بدون التوصيل`)} href="/admin/revenue" />
      {data.finance && <Kpi lang={lang} delay={60} icon={<Wallet size={17} />} tone="success" label={tt('Product profit', 'ربح المنتجات')} value={m.profit} format={iqd} current={m.profit} previous={p.profit} spark={spark.profit} note={<>{tt('Margin', 'الهامش')} <b>{pct(m.margin, 1)}</b>{m.unknownCostUnits ? ` · ${tt(`${m.unknownCostUnits} units unknown cost`, `${m.unknownCostUnits} قطعة بدون تكلفة`)}` : ''}</>} href="/admin/profit" />}
      <Kpi lang={lang} delay={120} icon={<Truck size={17} />} tone="blue" label={tt('Delivered orders', 'طلبات مُسلّمة')} value={m.orders} current={m.orders} previous={p.orders} note={tt(`${fmt(m.units)} units sold`, `${fmt(m.units)} قطعة مباعة`)} href="/admin/orders" />
      <Kpi lang={lang} delay={180} icon={<Receipt size={17} />} tone="gold" label={tt('Average order', 'متوسط الطلب')} value={m.averageOrder} format={iqd} current={m.averageOrder} previous={p.averageOrder} note={tt('Product revenue ÷ delivered orders', 'إيراد المنتجات ÷ الطلبات المُسلّمة')} />
      <Kpi lang={lang} delay={240} icon={<ShoppingCart size={17} />} tone="violet" label={tt('Orders placed', 'طلبات جديدة')} value={data.placed.count} current={data.placed.count} previous={data.placed.previous} spark={spark.orders} note={tt(`Worth ${fmt(data.placed.value)} IQD`, `بقيمة ${fmt(data.placed.value)} د.ع`)} href="/admin/orders" />
      <Kpi lang={lang} delay={300} icon={<PackageX size={17} />} tone="danger" inverse label={tt('Cancellation rate', 'نسبة الإلغاء')} value={data.placed.cancelRate * 100} format={n => `${n.toFixed(1)}%`} current={data.placed.cancelRate} previous={data.placed.previousCancelRate} note={tt(`Returns ${pct(data.placed.returnRate, 1)} of orders placed`, `المرتجع ${pct(data.placed.returnRate, 1)} من الطلبات`)} />
    </section>

    {data.finance && data.expenses && <section className="dash-pnl dash-rise" style={{ animationDelay: '320ms' }}>
      <div><span>{tt('Revenue', 'الإيراد')}</span><strong><CountUp value={m.revenue} format={iqd} /></strong></div>
      <em>−</em>
      <div><span>{tt('Cost of goods sold', 'تكلفة البضاعة المباعة')}</span><strong><CountUp value={m.cogs} format={iqd} /></strong></div>
      {m.unknownCostRevenue > 0 && <><em>−</em><div><span>{tt('Revenue with unknown cost', 'إيراد بدون تكلفة معروفة')}</span><strong><CountUp value={m.unknownCostRevenue} format={iqd} /></strong></div></>}
      <em>=</em>
      <div><span>{tt('Gross profit', 'إجمالي الربح')}</span><strong><CountUp value={m.profit} format={iqd} /></strong></div>
      <em>−</em>
      <div><span>{tt('Operating expenses', 'المصاريف التشغيلية')}</span><strong><CountUp value={data.expenses.current} format={iqd} /></strong></div>
      <em>=</em>
      <div className={`total ${net < 0 ? 'negative' : ''}`}><span>{tt('Net profit', 'صافي الربح')} <Delta current={net} previous={netPrev} lang={lang} /></span><strong><CountUp value={net} format={iqd} /></strong></div>
    </section>}

    <div className="dash-grid main">
      <Card delay={340} className="span-2" icon={<Flame size={17} />} title={tt('Revenue & profit', 'الإيراد والربح')} action={<div className="dash-legend-inline"><span><i className="sw revenue" />{tt('Revenue', 'الإيراد')}</span>{data.finance && <span><i className="sw profit" />{tt('Profit', 'الربح')}</span>}<span><i className="sw previous" />{tt('Previous period', 'الفترة السابقة')}</span></div>}>
        <RevenueChart data={data.daily} finance={data.finance} lang={lang} />
      </Card>
      <Card delay={380} icon={<Layers size={17} />} title={tt('Order pipeline', 'مسار الطلبات')} action={<Link href="/admin/orders" className="dash-link">{tt('Orders', 'الطلبات')} <ArrowRight size={13} /></Link>}>
        <ol className="dash-pipeline">{data.pipeline.map((s, i) => <li key={s.status} className={`st-${s.status}`}>
          <Link href={`/admin/orders?status=${s.status}`}>
            <span className="dash-pipe-name"><i>{i + 1}</i>{status(s.status)}</span>
            <span className="dash-pipe-bar"><b style={{ width: `${(s.orders / pipelineMax) * 100}%`, animationDelay: `${i * 80}ms` }} /></span>
            <span className="dash-pipe-num"><strong>{s.orders}</strong><small>{compact(s.value)} IQD</small></span>
          </Link>
          {s.orders > 0 && s.oldestHours > 24 && <small className="dash-pipe-age"><Clock size={11} /> {tt(`oldest ${Math.round(s.oldestHours / 24)}d`, `الأقدم ${Math.round(s.oldestHours / 24)} يوم`)}</small>}
        </li>)}</ol>
        <div className="dash-pipe-summary">
          <div><span>{tt('Expected revenue (confirmed → shipped)', 'إيراد متوقع (مؤكد ← مشحون)')}</span><strong>{iqd(data.expectedRevenue)}</strong>{data.finance && <small>{tt('expected profit', 'ربح متوقع')} {iqd(data.expectedProfit)}</small>}</div>
          <div><span>{tt('Cash to collect from couriers', 'نقد بانتظار التحصيل من المندوب')}</span><strong>{iqd(data.toCollect)}</strong></div>
        </div>
      </Card>
    </div>

    <div className="dash-grid three">
      <Card delay={420} icon={<ShoppingBag size={17} />} title={tt('Sales by channel', 'المبيعات حسب القناة')}><Donut rows={data.bySource} lang={lang} /></Card>
      <Card delay={460} icon={<MapPin size={17} />} title={tt('Top governorates', 'أعلى المحافظات')} action={<span className="dash-muted">{tt(`${data.governoratesLive}/18 live`, `${data.governoratesLive}/18 مفعّلة`)}</span>}><Bars rows={data.byGovernorate} lang={lang} /></Card>
      <Card delay={500} icon={<Clock size={17} />} title={tt('When orders come in', 'أوقات وصول الطلبات')}><Heatmap grid={data.heatmap} lang={lang} /></Card>
    </div>

    <div className="dash-grid main">
      <Card delay={540} className="span-2" icon={<Sparkles size={17} />} title={tt('Best sellers', 'الأكثر مبيعاً')} action={<Link href="/admin/reports?section=products" className="dash-link">{tt('Full report', 'التقرير الكامل')} <ArrowRight size={13} /></Link>}>
        {data.topProducts.length ? <div className="dash-table-wrap"><table className="dash-table">
          <thead><tr><th>{tt('Product', 'المنتج')}</th><th className="num">{tt('Units', 'القطع')}</th><th className="num">{tt('Orders', 'الطلبات')}</th><th className="num">{tt('Revenue', 'الإيراد')}</th>{data.finance && <><th className="num">{tt('Profit', 'الربح')}</th><th>{tt('Margin', 'الهامش')}</th></>}</tr></thead>
          <tbody>{data.topProducts.map((row, i) => <tr key={row.id} style={{ animationDelay: `${i * 50}ms` }}>
            <td><Link href={`/admin/products/${row.id}`} className="dash-product"><span className="dash-rank">{i + 1}</span>{row.image ? <img src={row.image} alt="" loading="lazy" /> : <span className="dash-thumb" />}<b>{lang === 'ar' ? row.nameAr : row.name}</b></Link></td>
            <td className="num">{fmt(row.units)}</td><td className="num">{row.orders}</td><td className="num"><strong>{iqd(row.revenue)}</strong></td>
            {data.finance && <><td className="num">{iqd(row.profit)}</td><td>{row.margin == null ? <span className="dash-muted">{tt('cost unknown', 'تكلفة غير معروفة')}</span> : <span className="dash-margin"><i style={{ width: `${Math.max(0, Math.min(100, row.margin * 100))}%` }} className={row.margin < 0.2 ? 'low' : ''} />{pct(row.margin)}</span>}</td></>}
          </tr>)}</tbody>
        </table></div> : <div className="dash-empty"><Package size={22} />{tt('No delivered sales in this period yet.', 'لا توجد مبيعات مُسلّمة في هذه الفترة بعد.')}</div>}
      </Card>
      <Card delay={580} icon={<Boxes size={17} />} title={tt('Inventory health', 'صحة المخزون')} action={<Link href="/admin/inventory" className="dash-link">{tt('Inventory', 'المخزون')} <ArrowRight size={13} /></Link>}>
        <div className="dash-inv-top">
          {data.finance && <div><span>{tt('Stock value (cost)', 'قيمة المخزون (تكلفة)')}</span><strong><CountUp value={inv.knownValue} format={iqd} /></strong></div>}
          <div><span>{tt('Retail value', 'القيمة بسعر البيع')}</span><strong><CountUp value={inv.retailValue} format={iqd} /></strong></div>
        </div>
        <div className="dash-stock-bar" aria-hidden="true"><i className="avail" style={{ flexGrow: inv.available || 0.0001 }} /><i className="res" style={{ flexGrow: inv.reserved || 0.0001 }} /></div>
        <ul className="dash-stock-legend"><li><i className="avail" />{tt('Available', 'متاح')} <b>{fmt(inv.available)}</b></li><li><i className="res" />{tt('Reserved by pending orders', 'محجوز لطلبات الانتظار')} <b>{fmt(inv.reserved)}</b></li><li>{tt('On hand', 'الموجود فعلياً')} <b>{fmt(inv.onHand)}</b></li></ul>
        <div className="dash-inv-chips"><span className="danger">{inv.soldOut} {tt('sold out', 'نافد')}</span><span className="warning">{inv.low} {tt(`low (≤${inv.lowThreshold})`, `منخفض (≤${inv.lowThreshold})`)}</span><span>{inv.published}/{inv.products} {tt('products live', 'منتج منشور')}</span></div>
        <h3 className="dash-sub">{tt('Restock soon', 'يحتاج إعادة تخزين')}</h3>
        {data.stockAlerts.length ? <ul className="dash-alerts">{data.stockAlerts.map(v => <li key={v.id}>
          {v.image ? <img src={v.image} alt="" loading="lazy" /> : <span className="dash-thumb" style={{ background: v.hex }} />}
          <div><b>{lang === 'ar' ? v.productAr : v.product}</b><small><i style={{ background: v.hex }} />{lang === 'ar' ? v.colorAr : v.color}{v.reserved ? ` · ${tt(`${v.reserved} reserved`, `${v.reserved} محجوز`)}` : ''}</small></div>
          <span className={`dash-left ${v.available === 0 ? 'out' : ''}`}><strong>{v.available}</strong><small>{v.daysLeft != null ? tt(`~${v.daysLeft}d left`, `~${v.daysLeft} يوم`) : tt('available', 'متاح')}</small></span>
        </li>)}</ul> : <p className="dash-ok">{tt('Every published colour has healthy stock.', 'كل الألوان المنشورة مخزونها جيد.')}</p>}
        {data.deadStock.length > 0 && <><h3 className="dash-sub">{tt('Not selling (60+ days)', 'راكد (أكثر من 60 يوم)')}</h3><ul className="dash-dead">{data.deadStock.map(v => <li key={v.id}><span><i style={{ background: v.hex }} />{lang === 'ar' ? v.productAr : v.product} · {lang === 'ar' ? v.colorAr : v.color}</span><b>{v.onHand}</b></li>)}</ul></>}
      </Card>
    </div>

    <div className="dash-grid three">
      <Card delay={620} icon={<Users size={17} />} title={tt('Customers', 'الزبائن')} action={<Link href="/admin/customers" className="dash-link">CRM <ArrowRight size={13} /></Link>}>
        <div className="dash-cust-stats">
          <div><strong><CountUp value={data.customers.buyers} /></strong><span>{tt('buyers in period', 'مشتري بالفترة')}</span></div>
          <div><strong><CountUp value={data.customers.newInPeriod} /></strong><span>{tt('new customers', 'زبون جديد')}</span></div>
          <div><strong>{data.customers.buyers ? pct(data.customers.returning / data.customers.buyers) : '0%'}</strong><span>{tt('returning', 'زبائن عائدون')}</span></div>
          <div><strong>{fmt(data.customers.total)}</strong><span>{tt('all customers', 'كل الزبائن')}</span></div>
        </div>
        <h3 className="dash-sub">{tt('Top customers', 'أفضل الزبائن')}</h3>
        {data.customers.top.length ? <ul className="dash-people">{data.customers.top.map((c, i) => <li key={c.phone}><span className="dash-avatar" style={{ background: PALETTE[i % PALETTE.length] }}>{c.name.trim().charAt(0) || '?'}</span><div><b>{c.name}</b><small dir="ltr">{c.phone}</small></div><span><strong>{compact(c.revenue)}</strong><small>{c.orders} {tt('orders', 'طلب')}</small></span></li>)}</ul> : <p className="dash-muted">{tt('No orders in this period.', 'لا توجد طلبات بالفترة.')}</p>}
      </Card>
      <Card delay={660} icon={<AlertTriangle size={17} />} title={tt('Needs attention', 'يحتاج انتباهك')} action={<span className={`dash-count ${attention.length ? 'hot' : ''}`}>{attention.length}</span>}>
        {attention.length ? <ul className="dash-attn">{attention.map((a, i) => <li key={i} className={a.tone}><Link href={a.href}>{a.icon}<span>{a.text}</span><ArrowRight size={13} /></Link></li>)}</ul> : <p className="dash-ok">{tt('All clear. Nothing needs your attention right now.', 'كل شي تمام. ماكو شي يحتاج انتباهك هسه.')}</p>}
      </Card>
      <Card delay={700} icon={<ShoppingCart size={17} />} title={tt('Latest orders', 'آخر الطلبات')} action={<Link href="/admin/orders" className="dash-link">{tt('All', 'الكل')} <ArrowRight size={13} /></Link>}>
        <ul className="dash-orders">{data.recentOrders.map(o => <li key={o.id}><Link href={`/admin/orders/${o.id}`}>
          <div><b>{o.reference}</b><small>{o.name} · {o.items} {tt('items', 'قطعة')} · {ago(o.createdAt, lang)}</small></div>
          <span className="dash-order-end"><strong>{compact(o.total)}</strong><em className={`st st-${o.status}`}>{status(o.status)}</em></span>
        </Link></li>)}{!data.recentOrders.length && <li className="dash-muted">{tt('No orders yet.', 'لا توجد طلبات بعد.')}</li>}</ul>
        {data.activity.length > 0 && <><h3 className="dash-sub">{tt('Team activity', 'نشاط الفريق')}</h3><ul className="dash-activity">{data.activity.slice(0, 5).map(a => <li key={a.id}><i /><span>{a.details || `${a.action} · ${a.entity}`}</span><small>{ago(a.createdAt, lang)}</small></li>)}</ul></>}
      </Card>
    </div>
    <p className="dash-generated">{tt('Updated', 'آخر تحديث')} {new Date(data.generatedAt).toLocaleTimeString(lang === 'ar' ? 'ar-IQ' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Baghdad' })} · {tt(`Compared with ${new Date(data.previousFrom).toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' })} – ${new Date(data.previousTo).toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' })}`, `مقارنة مع ${new Date(data.previousFrom).toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' })} – ${new Date(data.previousTo).toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' })}`)}</p>
  </main>;
}
