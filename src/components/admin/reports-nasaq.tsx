'use client';

/**
 * Admin → Reports, built the way Nasaq's reports work: one scrolling page, a toolbar with
 * this month / this year / all time, current and previous month, a year picker, Excel and PDF
 * export; a row of six figure cards; then chart cards (area, line, bars, donut), ranked
 * progress cards and short lists. Nasaq's blue is UR brown here.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, BadgeDollarSign, BarChart3, Boxes, Calendar, Clock, MapPin, Package, PieChart as PieIcon, Printer, Receipt, ShoppingBag, ShoppingCart, Target, TrendingUp, Truck, Users, Wallet, Zap } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ReportsData } from '@/lib/reports-data';
import { AccountsTabs } from './accounts-views';
import { useRef, useState } from 'react';
import { Num, PeriodSwitch, useGlassMotion } from './dash-glass';
import './reports-nasaq.css';

// One colour family, as on the dashboard: UR orange in shades, with greys for comparisons and costs.
const BROWN = '#ef7342', BROWN_L = '#f7c9ae', GREEN = '#b9481f', RED = '#8e8e93', AMBER = '#f39a6c', BLUE = '#d65a2a', VIOLET = '#f6b08a', PINK = '#c7c7cc', SLATE = '#d1d1d6';
const PALETTE = ['#ef7342', '#f39a6c', '#f7c9ae', '#b9481f', '#d65a2a', '#fad8c4', '#aeaeb2', '#d1d1d6'];
const GRID = 'rgba(0,0,0,.06)', AXIS = '#8e8e93';
const TIP = { background: 'rgba(255,255,255,.88)', border: '1.5px solid rgba(255,255,255,.95)', borderRadius: 14, boxShadow: '0 10px 24px -10px rgba(0,0,0,.25)', backdropFilter: 'blur(16px)', fontFamily: 'var(--ap-font)', fontSize: 12 };

const SOURCE_AR: Record<string, string> = { website: 'الموقع', instagram: 'إنستغرام', whatsapp: 'واتساب', facebook: 'فيسبوك', phone: 'هاتف', store: 'المتجر', other: 'أخرى', tiktok: 'تيك توك', manual: 'يدوي', wholesale: 'جملة' };
const CATEGORY_AR: Record<string, string> = { handbag: 'حقائب يد', handbags: 'حقائب يد', 'phone-cases': 'كفرات موبايل', 'card-holders': 'حاملات بطاقات', belts: 'أحزمة', wallets: 'محافظ', backpacks: 'حقائب ظهر', bags: 'حقائب', accessories: 'أكسسوار' };
const STATUS_AR: Record<string, string> = { pending: 'قيد الانتظار', confirmed: 'مؤكد', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي', returned: 'مرتجع' };
const STATUS_COLOR: Record<string, string> = { delivered: GREEN, shipped: VIOLET, processing: BLUE, confirmed: BROWN_L, pending: AMBER, returned: PINK, cancelled: RED };
const PAY_AR: Record<string, string> = { cash: 'نقداً', bank_transfer: 'تحويل بنكي', electronic: 'دفع إلكتروني', cod: 'عند الاستلام', credit: 'آجل' };
const PAY_STATUS_AR: Record<string, string> = { paid: 'مدفوع', unpaid: 'غير مدفوع', partial: 'مدفوع جزئياً', refunded: 'مسترجع' };
const EXPENSE_AR: Record<string, string> = { marketing: 'تسويق', advertising: 'إعلانات', packaging: 'تغليف', salary: 'رواتب', rent: 'إيجار', software: 'برامج', delivery: 'توصيل', photography: 'تصوير', operations: 'تشغيل', other: 'أخرى' };
const MONTHS_AR = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];

const num = (n: number) => Math.round(n).toLocaleString('en-US');
const iqd = (n: number) => `${num(n)} د.ع`;
const k = (n: number) => (Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : Math.abs(n) >= 1000 ? `${Math.round(n / 1000)}k` : `${Math.round(n)}`);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

function Card({ children, className, delay = 0, style }: { children: React.ReactNode; className?: string; delay?: number; style?: React.CSSProperties }) {
  return <div className={cx('nq-card', className)} style={{ animationDelay: `${Math.min(delay, 0.2)}s`, ...style }}>{children}</div>;
}
function Badge({ children, variant = 'default', className }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'; className?: string }) {
  return <span className={cx('nq-badge', variant, className)}>{children}</span>;
}
function Head({ icon, tone = 'brown', title, sub, children }: { icon: React.ReactNode; tone?: string; title: string; sub?: string; children?: React.ReactNode }) {
  return <div className="nq-head"><div className="nq-head-title"><div className={cx('nq-tile', tone)}>{icon}</div><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div></div>{children}</div>;
}
/** Change against the same-length period before, as Nasaq's small card notes. */
function vs(current: number, previous: number) {
  if (!previous) return '—';
  const d = (current - previous) / Math.abs(previous);
  return `${d >= 0 ? '+' : ''}${Math.round(d * 100)}% عن الفترة السابقة`;
}

export function ReportsNasaq({ data, finance, today }: { data: ReportsData; finance: boolean; today: string }) {
  const router = useRouter();
  const root = useRef<HTMLElement>(null);
  const [pending, setPending] = useState(false);
  useGlassMotion(root, `${data.fromDay}-${data.toDay}`);
  const m = data.money, p = data.moneyPrevious;
  const net = m.profit - data.expenses.current;
  const year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7));
  const monthStart = `${today.slice(0, 7)}-01`;
  const prevMonthDate = new Date(Date.UTC(year, month - 2, 1));
  const prevMonth = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;
  const prevMonthEnd = new Date(Date.UTC(year, month - 1, 0)).toISOString().slice(0, 10);
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const ranges = {
    today: `from=${today}&to=${today}`,
    yesterday: `from=${yesterday}&to=${yesterday}`,
    month: `from=${monthStart}&to=${today}`,
    prevMonth: `from=${prevMonth}-01&to=${prevMonthEnd}`,
    year: `from=${year}-01-01&to=${today}`,
    all: `from=2023-01-01&to=${today}`,
  };
  const active = data.fromDay === today && data.toDay === today ? 'today'
    : data.fromDay === yesterday && data.toDay === yesterday ? 'yesterday'
    : data.fromDay === monthStart && data.toDay === today ? 'month'
    : data.fromDay === `${prevMonth}-01` && data.toDay === prevMonthEnd ? 'prevMonth'
    : data.fromDay === `${year}-01-01` && data.toDay === today ? 'year'
    : data.fromDay === '2023-01-01' ? 'all' : 'custom';
  const shownYear = Number(data.fromDay.slice(0, 4));
  const go = (q: string) => router.push(`/admin/reports?${q}`, { scroll: false });
  const qs = `from=${data.fromDay}&to=${data.toDay}`;
  const singleDay = data.fromDay === data.toDay;
  const rangeLabel = active === 'today' ? 'اليوم' : active === 'yesterday' ? 'أمس' : singleDay ? `يوم ${data.fromDay}` : active === 'month' ? 'الشهر' : active === 'prevMonth' ? 'الشهر السابق' : active === 'year' ? 'العام' : active === 'all' ? 'كل الأوقات' : 'الفترة';
  const monthly = data.byMonth;
  const label = (key: string) => key.length === 7 ? MONTHS_AR[Number(key.slice(5)) - 1] : `${Number(key.slice(8))}/${Number(key.slice(5, 7))}`;

  // Sales trend (Nasaq: team productivity area chart).
  const trend = data.series.map(s => ({ name: label(s.key), revenue: s.revenue, profit: s.profit, previous: s.previousRevenue }));
  // Money in vs out over the period (Nasaq: collection weekly line chart).
  const flow = data.series.map(s => ({ name: label(s.key), revenue: s.revenue, expenses: s.expenses }));
  // Channels ranked (Nasaq: department efficiency).
  const channelTotal = data.bySource.reduce((s, r) => s + r.revenue, 0) || 1;
  const channels = [...data.bySource].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  // Payment collection (Nasaq: finance & collection performance).
  const totalOrdered = data.paymentTotals.reduce((s, r) => s + r.total, 0);
  const collected = data.paymentTotals.filter(r => r.status === 'paid').reduce((s, r) => s + r.total, 0);
  const collectRatio = totalOrdered ? Math.round((collected / totalOrdered) * 100) : 0;
  // Expenses & net profit donut.
  const profitDonut = [
    { name: 'تكلفة البضاعة', value: m.cogs, color: BROWN_L },
    { name: 'المصاريف', value: data.expenses.current, color: RED },
    { name: 'صافي الربح', value: Math.max(0, net), color: GREEN },
  ].filter(d => d.value > 0);
  // Products: sold vs returned (Nasaq: required vs completed).
  const productBars = data.productTable.filter(r => r.units).slice(0, 8).map(r => ({ name: r.nameAr.length > 14 ? `${r.nameAr.slice(0, 13)}…` : r.nameAr, sold: r.units, returned: r.returnedUnits }));
  const reorder = data.inventory.reorder.slice(0, 4);
  // Status / payment / category donuts.
  const statusPie = Object.entries(data.statusCounts).filter(([, v]) => v > 0).map(([key, v]) => ({ name: STATUS_AR[key] ?? key, value: v as number, color: STATUS_COLOR[key] ?? SLATE }));
  const payPie = [...data.paymentMethods].sort((a, b) => b.total - a.total).map((r, i) => ({ name: PAY_AR[r.method] ?? r.method, value: r.total, color: PALETTE[i % PALETTE.length] }));
  const categoryBars = data.categoryTable.filter(c => c.revenue).map(c => ({ name: CATEGORY_AR[c.key] ?? c.key, revenue: c.revenue, units: c.units }));
  // Open orders waiting more than two days (Nasaq: overdue tasks).
  const now = new Date(`${today}T12:00:00`).getTime();
  const late = data.ordersList.filter(o => ['pending', 'confirmed', 'processing'].includes(o.status)).map(o => ({ ...o, days: Math.floor((now - new Date(o.createdAt).getTime()) / 86_400_000) })).filter(o => o.days >= 2).sort((a, b) => b.days - a.days);
  const govs = [...data.governorates].sort((a, b) => b.orders - a.orders).slice(0, 8).map(g => ({ name: g.nameAr, orders: g.orders, delivered: g.delivered }));

  return <main ref={root} className={`admin-page nq-reports gl-reports ${pending ? 'is-pending' : ''}`} dir="rtl">
    <AccountsTabs />
    {/* Header: title, one compact period switch, export */}
    <div className="nq-top gl-top">
      <div className="gl-hello"><span className="gl-date"><i className="gl-live" /><bdi dir="ltr">{singleDay ? data.fromDay : `${data.fromDay} – ${data.toDay}`}</bdi></span><h1>التقارير</h1></div>
      <div className="gl-top-actions">
        <PeriodSwitch lang="ar" base="/admin/reports" onPending={setPending} today={today} fromDay={data.fromDay} toDay={data.toDay} active={active} custom={active === 'custom'} items={[
          { key: 'today', label: 'اليوم', href: `/admin/reports?${ranges.today}` },
          { key: 'yesterday', label: 'أمس', href: `/admin/reports?${ranges.yesterday}` },
          { key: 'month', label: 'الشهر', href: `/admin/reports?${ranges.month}` },
          { key: 'prevMonth', label: 'الشهر السابق', href: `/admin/reports?${ranges.prevMonth}` },
          { key: 'year', label: 'السنة', href: `/admin/reports?${ranges.year}` },
          { key: 'all', label: 'الكل', href: `/admin/reports?${ranges.all}` },
        ]}>
          <div className="gl-years">{Array.from({ length: 5 }, (_, i) => year - 4 + i).map(y => <button key={y} type="button" className={`gl-chip ${shownYear === y && active === 'custom' ? 'on' : ''}`} onClick={() => go(`from=${y}-01-01&to=${y === year ? today : `${y}-12-31`}`)}>{y}</button>)}</div>
        </PeriodSwitch>
        {finance && <a className="gl-btn" href={`/api/admin/reports/export?${qs}`}><BadgeDollarSign size={16} />Excel</a>}
        <button type="button" className="gl-btn icon" title="تصدير PDF" aria-label="تصدير PDF" onClick={() => window.print()}><Printer size={16} /></button>
      </div>
    </div>

    {/* Top stats */}
    <div className="nq-stats">
      <Card delay={0.05}>
        <div className="nq-stat-label"><BadgeDollarSign size={18} className="c-green" /><span>إيراد المنتجات</span></div>
        <div className="nq-stat-value c-green"><Num value={m.revenue} format="iqd" /> <small>د.ع</small></div>
        <div className="nq-stat-note">{vs(m.revenue, p.revenue)}</div>
      </Card>
      {finance ? <Card delay={0.1} className="tint-brown">
        <div className="nq-stat-label"><Wallet size={18} className="c-brown" /><span>صافي الربح</span></div>
        <div className={cx('nq-stat-value', net >= 0 ? 'c-brown' : 'c-red')}><Num value={net} format="iqd" /> <small>د.ع</small></div>
        <div className="nq-stat-note">بعد تكلفة البضاعة والمصاريف · هامش {pct(m.revenue ? net / m.revenue : 0)}</div>
      </Card> : <Card delay={0.1}>
        <div className="nq-stat-label"><Receipt size={18} className="c-brown" /><span>متوسط الطلب</span></div>
        <div className="nq-stat-value"><Num value={m.averageOrder} format="iqd" /> <small>د.ع</small></div>
        <div className="nq-stat-note">{vs(m.averageOrder, p.averageOrder)}</div>
      </Card>}
      <Card delay={0.12} className="tint-green">
        <div className="nq-stat-label"><BadgeDollarSign size={18} className="c-green" /><span>المبالغ المحصلة</span></div>
        <div className="nq-stat-value c-green"><Num value={collected} format="iqd" /> <small>د.ع</small></div>
        <div className="nq-stat-note">تحصيل {collectRatio}% من قيمة الطلبات</div>
      </Card>
      <Card delay={0.14}>
        <div className="nq-stat-label"><ShoppingBag size={18} className="c-brown" /><span>طلبات مُسلّمة</span></div>
        <div className="nq-stat-value big"><Num value={m.orders} /></div>
        <div className="nq-stat-note">{num(m.units)} قطعة · {vs(m.orders, p.orders)}</div>
      </Card>
      <Card delay={0.15}>
        <div className="nq-stat-label"><Zap size={18} className="c-brown" /><span>نسبة التسليم</span></div>
        <div className="nq-stat-value big">{data.placed.count ? Math.round((data.statusCounts.delivered / data.placed.count) * 100) : 0}%</div>
        <div className="nq-meter"><i style={{ width: `${data.placed.count ? (data.statusCounts.delivered / data.placed.count) * 100 : 0}%` }} /></div>
      </Card>
      <Card delay={0.2}>
        <div className="nq-stat-label"><Clock size={18} className="c-blue" /><span>متوسط وقت التسليم</span></div>
        <div className="nq-stat-value big">{data.avgDeliveryDays ? data.avgDeliveryDays.toFixed(1) : '—'}</div>
        <div className="nq-stat-note">يوم</div>
      </Card>
    </div>

    {/* Charts row */}
    <div className="nq-row cols-3">
      <Card delay={0.25} className="span-2 col">
        <div className="nq-head"><h3 className="nq-h3">تحليل المبيعات ({monthly ? 'شهرياً' : 'يومياً'})</h3>
          <div className="nq-keys"><span><i style={{ background: BROWN }} />الإيراد</span>{finance && <span><i style={{ background: GREEN }} />الربح</span>}<span><i style={{ background: SLATE }} />الفترة السابقة</span></div></div>
        <div className="nq-chart h300 grow"><ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend}><defs>
              <linearGradient id="rpg-rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ef7342" stopOpacity={0.3} /><stop offset="1" stopColor="#ef7342" stopOpacity={0} /></linearGradient>
              <linearGradient id="rpg-pro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b9481f" stopOpacity={0.16} /><stop offset="1" stopColor="#b9481f" stopOpacity={0} /></linearGradient>
              <pattern id="rp-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#ef7342" /><rect width="2" height="6" fill="rgba(255,255,255,.22)" /></pattern>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis reversed dataKey="name" stroke={AXIS} fontSize={10} tickLine={false} axisLine={false} />
            <YAxis orientation="right" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} tickFormatter={k} width={44} />
            <Tooltip contentStyle={TIP} formatter={(v: number) => [iqd(v)]} />
            <Area name="الفترة السابقة" type="monotone" dataKey="previous" stroke="#aeaeb2" strokeDasharray="4 5" fill="none" />
            {finance && <Area name="الربح" type="monotone" dataKey="profit" stroke={GREEN} strokeWidth={2} fill="url(#rpg-pro)" />}
            <Area name="الإيراد" type="monotone" dataKey="revenue" stroke={BROWN} strokeWidth={2.6} fill="url(#rpg-rev)" activeDot={{ r: 6, stroke: "#fff", strokeWidth: 3 }} />
          </AreaChart>
        </ResponsiveContainer></div>
      </Card>

      <Card delay={0.3} className="span-1">
        <Head icon={<Target size={18} />} title="كفاءة القنوات" sub="حصة كل قناة من الإيراد">
          {channels[0] && <span className="nq-best">الأفضل: {SOURCE_AR[channels[0].key] ?? channels[0].key}</span>}
        </Head>
        <div className="nq-stack">
          {channels.length === 0 ? <div className="nq-empty">لا توجد بيانات كافية لعرض القنوات</div> : channels.map((c, i) => {
            const share = Math.round((c.revenue / channelTotal) * 100), best = i === 0;
            return <div key={c.key} className={cx('nq-rank', best && 'best')}>
              <div className="nq-rank-top"><div><span className="nq-rank-no">{i + 1}</span><b>{SOURCE_AR[c.key] ?? c.key}</b></div><strong>{share}%</strong></div>
              <div className="nq-bar"><i style={{ width: `${share}%`, animationDelay: `${i * 0.06}s` }} /></div>
              <div className="nq-rank-foot"><span>{iqd(c.revenue)}</span><span>{c.orders} طلب</span></div>
            </div>;
          })}
        </div>
      </Card>
    </div>

    {/* Collection performance */}
    {totalOrdered > 0 && <Card delay={0.32} className="border-green">
      <Head icon={<BadgeDollarSign size={20} />} tone="green" title="أداء التحصيل والدفع" sub={`تتبع قيمة الطلبات والمبالغ المحصلة خلال ${rangeLabel}`}>
        <Badge variant="success" className="lg">نسبة التحصيل: {collectRatio}%</Badge>
      </Head>
      <div className="nq-row cols-3 inner">
        <div className="nq-boxes">
          <div className="nq-box"><p>إجمالي قيمة الطلبات</p><b>{iqd(totalOrdered)}</b></div>
          <div className="nq-box green"><p>إجمالي المبالغ المحصلة</p><b>{iqd(collected)}</b></div>
          <div className="nq-box brown"><p>المتبقي قيد التحصيل</p><b>{iqd(Math.max(0, totalOrdered - collected))}</b></div>
        </div>
        <div className="span-2 nq-chart h220"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={flow} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis reversed dataKey="name" stroke={AXIS} fontSize={10} />
            <YAxis orientation="right" stroke={AXIS} fontSize={12} tickFormatter={k} width={44} />
            <Tooltip contentStyle={TIP} formatter={(v: number) => [iqd(v)]} />
            <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
            <Line type="monotone" dataKey="revenue" name="الإيراد المُسلّم" stroke={GREEN} strokeWidth={2} dot={false} activeDot={{ r: 6, stroke: "#fff", strokeWidth: 3 }} />
            <Line type="monotone" dataKey="expenses" name="المصاريف" stroke={RED} strokeWidth={2} dot={false} activeDot={{ r: 6, stroke: "#fff", strokeWidth: 3 }} />
          </LineChart>
        </ResponsiveContainer></div>
      </div>
    </Card>}

    {/* Expenses & net profit */}
    {finance && <div className="nq-row cols-3">
      <Card delay={0.34} className="span-2 border-brown tint-soft">
        <Head icon={<Wallet size={20} />} title="تحليل المصاريف وصافي الربح" sub={`الإيراد مقابل تكلفة البضاعة والمصاريف خلال ${rangeLabel}`} />
        <div className="nq-row cols-2 inner center">
          <div className="nq-grid2">
            <div className="nq-box"><p>الإيراد</p><b>{iqd(m.revenue)}</b></div>
            <div className="nq-box"><p>تكلفة البضاعة</p><b>{iqd(m.cogs)}</b></div>
            <div className="nq-box"><p>المصاريف التشغيلية</p><b>{iqd(data.expenses.current)}</b></div>
            <div className={cx('nq-box', net >= 0 ? 'green' : 'red')}><p>صافي الربح</p><b>{iqd(net)}</b></div>
            <div className="nq-box wide"><p>الهامش الإجمالي</p><b>{pct(m.margin)}</b><div className="nq-meter"><i style={{ width: `${Math.max(0, Math.min(100, m.margin * 100))}%`, background: GREEN }} /></div></div>
          </div>
          <div className="nq-chart h280"><ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={profitDonut} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value">{profitDonut.map(d => <Cell key={d.name} fill={d.color} aria-label={d.name} />)}</Pie>
              <Tooltip contentStyle={TIP} formatter={(v: number) => [iqd(v)]} />
              <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer></div>
        </div>
      </Card>
      <Card delay={0.36} className="span-1">
        <Head icon={<Receipt size={18} />} tone="red" title="المصاريف حسب النوع" sub={`${iqd(data.expenses.current)} خلال ${rangeLabel}`} />
        <div className="nq-stack">{data.expenses.byCategory.length === 0 ? <div className="nq-empty">لا توجد مصاريف مسجلة</div> : data.expenses.byCategory.slice(0, 6).map((e, i) => {
          const share = data.expenses.current ? Math.round((e.value / data.expenses.current) * 100) : 0;
          return <div key={e.key} className="nq-mini"><div className="nq-rank-top"><b>{EXPENSE_AR[e.key] ?? e.key}</b><strong>{iqd(e.value)}</strong></div><div className="nq-bar thin red"><i style={{ width: `${share}%`, animationDelay: `${i * 0.06}s` }} /></div></div>;
        })}</div>
      </Card>
    </div>}

    {/* Yearly financial trend */}
    {monthly && <Card delay={0.33} className="border-brown">
      <Head icon={<TrendingUp size={20} />} title="تحليل الاتجاه المالي الشهري" sub="الإيراد والربح لكل شهر بالفترة" />
      <div className="nq-chart h300"><ResponsiveContainer width="100%" height="100%">
        <LineChart data={trend} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis reversed dataKey="name" stroke={AXIS} fontSize={11} />
          <YAxis orientation="right" stroke={AXIS} fontSize={12} tickFormatter={k} width={44} />
          <Tooltip contentStyle={TIP} formatter={(v: number) => [iqd(v)]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="revenue" name="الإيراد" stroke={BROWN} strokeWidth={2.6} dot={false} activeDot={{ r: 6, stroke: "#fff", strokeWidth: 3 }} />
          {finance && <Line type="monotone" dataKey="profit" name="الربح" stroke={GREEN} strokeWidth={2} dot={false} />}
        </LineChart>
      </ResponsiveContainer></div>
    </Card>}

    {/* Products: sold vs returned + stock gap */}
    <div className="nq-row cols-3">
      <Card className="span-2" delay={0.35}>
        <h3 className="nq-h3 mb">تحليل المنتجات: المباع vs المرتجع</h3>
        <div className="nq-chart h300">{productBars.length ? <ResponsiveContainer width="100%" height="100%">
          <BarChart data={productBars} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}><defs><pattern id="rp-hatch-b" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#ef7342" /><rect width="2" height="6" fill="rgba(255,255,255,.22)" /></pattern></defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis reversed dataKey="name" stroke={AXIS} fontSize={11} interval={0} />
            <YAxis orientation="right" stroke={AXIS} fontSize={12} width={36} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'rgba(239,115,66,.06)' }} contentStyle={TIP} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar name="القطع المباعة" dataKey="sold" fill="url(#rp-hatch-b)" radius={[8, 8, 3, 3]} />
            <Bar name="القطع المرتجعة" dataKey="returned" fill={BROWN_L} radius={[8, 8, 3, 3]} />
          </BarChart>
        </ResponsiveContainer> : <div className="nq-empty">لا توجد مبيعات بالفترة</div>}</div>
      </Card>
      <div className="span-1 nq-side">
        <h3 className="nq-h3">فجوة المخزون</h3>
        {reorder.length === 0 ? <Card><div className="nq-empty">ماكو منتج ديبيع وقريب يخلص</div></Card> : reorder.map((v, i) => {
          const target = v.available + v.qty, percent = target ? Math.round((v.available / target) * 100) : 0;
          return <Card key={`${v.id}`} className="tight" delay={0.36 + i * 0.02}>
            <div className="nq-rank-top"><b>{v.productAr} · {v.colorAr}</b><Badge variant={percent >= 50 ? 'success' : 'warning'}>{percent}%</Badge></div>
            <div className="nq-rank-foot"><span>المطلوب شراؤه: {v.qty}</span><span>المتوفر: {v.available}</span></div>
            <div className="nq-bar"><i style={{ width: `${Math.min(100, percent)}%` }} /></div>
          </Card>;
        })}
        <Link href="/admin/purchases" className="nq-link">إنشاء طلب شراء</Link>
      </div>
    </div>

    {/* Category revenue (Nasaq: client budgets area) */}
    {categoryBars.length > 0 && <Card delay={0.35} className="border-brown">
      <Head icon={<Package size={20} />} title="مقارنة الإيراد حسب الصنف" sub={`الإيراد والقطع المباعة لكل صنف خلال ${rangeLabel}`} />
      <div className="nq-chart h300"><ResponsiveContainer width="100%" height="100%">
        <BarChart data={categoryBars} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}><defs><pattern id="rp-hatch-b" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#ef7342" /><rect width="2" height="6" fill="rgba(255,255,255,.22)" /></pattern></defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis reversed dataKey="name" stroke={AXIS} fontSize={12} />
          <YAxis orientation="right" stroke={AXIS} fontSize={12} tickFormatter={k} width={44} />
          <Tooltip cursor={{ fill: 'rgba(239,115,66,.06)' }} contentStyle={TIP} formatter={(v: number, n: string) => [n === 'الإيراد' ? iqd(v) : num(v), n]} />
          <Bar name="الإيراد" dataKey="revenue" fill="url(#rp-hatch-b)" radius={[10, 10, 4, 4]} maxBarSize={64} />
        </BarChart>
      </ResponsiveContainer></div>
    </Card>}

    {/* Donuts + lists */}
    <div className="nq-row cols-3">
      <Card delay={0.34}>
        <h3 className="nq-h3 mb">توزيع الطلبات حسب الحالة</h3>
        <div className="nq-chart h260">{statusPie.length ? <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={statusPie} cx="50%" cy="45%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value">{statusPie.map(d => <Cell key={d.name} fill={d.color} aria-label={d.name} />)}</Pie>
            <Tooltip contentStyle={TIP} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer> : <div className="nq-empty">لا توجد طلبات</div>}</div>
      </Card>
      <Card delay={0.35}>
        <h3 className="nq-h3 mb">تحليل طرق الدفع</h3>
        <div className="nq-chart h260">{payPie.length ? <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={payPie} cx="50%" cy="45%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value">{payPie.map(d => <Cell key={d.name} fill={d.color} aria-label={d.name} />)}</Pie>
            <Tooltip contentStyle={TIP} formatter={(v: number) => [iqd(v)]} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer> : <div className="nq-empty">لا توجد مدفوعات</div>}</div>
      </Card>
      <Card delay={0.4}>
        <h3 className="nq-h3 mb">الطلبات المتأخرة</h3>
        <div className="nq-stack">{late.length === 0 ? <div className="nq-empty">لا توجد طلبات متأخرة</div> : late.slice(0, 5).map((o, i) => (
          <Link key={o.id} href={`/admin/orders/${o.id}`} className="nq-late" style={{ animationDelay: `${0.45 + i * 0.05}s` }}>
            <div className="nq-late-icon"><AlertTriangle size={14} /></div>
            <div className="nq-late-body"><p>{o.name} · {o.reference}</p><span>{STATUS_AR[o.status] ?? o.status} · {iqd(o.revenue)}</span></div>
            <Badge variant="danger">{o.days} يوم تأخير</Badge>
          </Link>
        ))}</div>
      </Card>
    </div>

    {/* Customers & governorates */}
    <div className="nq-row cols-3">
      <Card delay={0.42}>
        <Head icon={<Users size={18} />} title="أفضل الزبائن" sub={`${num(data.customers.buyers)} مشتري · ${num(data.customers.newInPeriod)} جديد`} />
        <div className="nq-stack">{data.topBuyers.length === 0 ? <div className="nq-empty">لا يوجد زبائن بالفترة</div> : data.topBuyers.slice(0, 5).map((b, i) => (
          <div key={b.phone} className={cx('nq-rank', i === 0 && 'best')}>
            <div className="nq-rank-top"><div><span className="nq-rank-no">{i + 1}</span><b>{b.name}</b></div><strong>{iqd(b.revenue)}</strong></div>
            <div className="nq-rank-foot"><span>{b.orders} طلب · {b.delivered} مُسلّم</span><span>{b.governorateName?.ar}</span></div>
          </div>
        ))}</div>
      </Card>
      <Card delay={0.44} className="span-2">
        <Head icon={<MapPin size={18} />} title="الطلبات حسب المحافظة" sub="عدد الطلبات والمُسلّم منها" />
        <div className="nq-chart h280">{govs.length ? <ResponsiveContainer width="100%" height="100%">
          <BarChart data={govs} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}><defs><pattern id="rp-hatch-b" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#ef7342" /><rect width="2" height="6" fill="rgba(255,255,255,.22)" /></pattern></defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis reversed dataKey="name" stroke={AXIS} fontSize={11} interval={0} />
            <YAxis orientation="right" stroke={AXIS} fontSize={12} width={32} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'rgba(239,115,66,.06)' }} contentStyle={TIP} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar name="الطلبات" dataKey="orders" fill={BROWN_L} radius={[8, 8, 3, 3]} />
            <Bar name="المُسلّم" dataKey="delivered" fill="url(#rp-hatch-b)" radius={[8, 8, 3, 3]} />
          </BarChart>
        </ResponsiveContainer> : <div className="nq-empty">لا توجد طلبات</div>}</div>
      </Card>
    </div>

    {/* Inventory summary */}
    <div className="nq-stats four">
      <Card delay={0.45}><div className="nq-stat-label"><Boxes size={18} className="c-brown" /><span>متاح للبيع</span></div><div className="nq-stat-value big"><Num value={data.inventory.available} /></div><div className="nq-stat-note">{num(data.inventory.onHand)} موجود · {num(data.inventory.reserved)} محجوز</div></Card>
      <Card delay={0.46}><div className="nq-stat-label"><AlertTriangle size={18} className="c-amber" /><span>ألوان منخفضة</span></div><div className="nq-stat-value big">{data.inventory.lowCount}</div><div className="nq-stat-note">أقل من {data.inventory.lowThreshold} قطع</div></Card>
      <Card delay={0.47}><div className="nq-stat-label"><ShoppingCart size={18} className="c-red" /><span>ألوان نافدة</span></div><div className="nq-stat-value big c-red">{data.inventory.soldOutCount}</div><div className="nq-stat-note">تحتاج إعادة طلب</div></Card>
      <Card delay={0.48}><div className="nq-stat-label"><Truck size={18} className="c-blue" /><span>أجور التوصيل المحصلة</span></div><div className="nq-stat-value"><Num value={m.shipping} format="iqd" /> <small>د.ع</small></div><div className="nq-stat-note">منفصلة عن الإيراد</div></Card>
    </div>
    <p className="nq-foot"><BarChart3 size={14} /> الأرقام المالية محسوبة على الطلبات المُسلّمة بتاريخ التسليم · <PieIcon size={14} /> مقارنة مع {data.previousFrom.slice(0, 10)} – {data.previousTo.slice(0, 10)}</p>
  </main>;
}
