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
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/500.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import '@fontsource/cairo/800.css';
import '@fontsource/cairo/900.css';
import './reports-nasaq.css';

const BROWN = '#8b5a2b', BROWN_L = '#c8a27a', GREEN = '#10B981', RED = '#EF4444', AMBER = '#F59E0B', BLUE = '#3B82F6', VIOLET = '#8B5CF6', PINK = '#EC4899', SLATE = '#CBD5E1';
const PALETTE = [BROWN, GREEN, BLUE, AMBER, PINK, VIOLET, BROWN_L, SLATE];
const GRID = '#E2E8F0', AXIS = '#64748B';
const TIP = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontFamily: 'var(--ap-font)', fontSize: 12 };

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
  if (!previous) return current ? 'جديد بالفترة' : 'بدون تغيير';
  const d = (current - previous) / Math.abs(previous);
  return `${d >= 0 ? '+' : ''}${Math.round(d * 100)}% عن الفترة السابقة`;
}

export function ReportsNasaq({ data, finance, today }: { data: ReportsData; finance: boolean; today: string }) {
  const router = useRouter();
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
  // Any day or span: picking a "from" after "to" (or the other way round) moves the other end with it.
  const pickDay = (d: string) => { if (d) go(`from=${d}&to=${d}`); };
  const pickFrom = (d: string) => { if (d) go(`from=${d}&to=${d > data.toDay ? d : data.toDay}`); };
  const pickTo = (d: string) => { if (d) go(`from=${d < data.fromDay ? d : data.fromDay}&to=${d}`); };
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

  return <main className="admin-page nq-reports" dir="rtl">
    <AccountsTabs />
    {/* Header */}
    <div className="nq-top">
      <div><h1>التقارير</h1><p>أداء المتجر، المبيعات، الأرباح والمخزون</p></div>
      <div className="nq-date"><p>تاريخ التقرير</p><b>{new Date(`${today}T12:00:00`).toLocaleDateString('ar-IQ-u-nu-latn')}</b></div>
    </div>

    {/* Toolbar with time filter */}
    <div className="nq-toolbar">
      {active === 'custom' ? <div className="nq-alert"><Calendar size={16} /><p>{singleDay ? <>تقرير يوم <b dir="ltr">{data.fromDay}</b></> : <>تقرير الفترة من <b dir="ltr">{data.fromDay}</b> إلى <b dir="ltr">{data.toDay}</b></>}</p><button type="button" onClick={() => go(ranges.month)}>رجوع للشهر الحالي</button></div>
        : <div className="nq-title"><div className="nq-tile brown"><Calendar size={20} /></div><h2>تحليلات الأداء</h2></div>}
      <div className="nq-tools">
        <div className="nq-seg">
          <button type="button" className={active === 'today' ? 'on' : ''} onClick={() => go(ranges.today)}>اليوم</button>
          <button type="button" className={active === 'yesterday' ? 'on' : ''} onClick={() => go(ranges.yesterday)}>أمس</button>
        </div>
        <label className="nq-date-pick"><span>يوم محدد</span><input id="rp-day" type="date" max={today} value={singleDay ? data.fromDay : ''} onChange={e => pickDay(e.target.value)} /></label>
        <div className="nq-range" role="group" aria-label="فترة مخصصة">
          <label className="nq-date-pick"><span>من</span><input id="rp-from" type="date" max={today} value={data.fromDay} onChange={e => pickFrom(e.target.value)} /></label>
          <label className="nq-date-pick"><span>إلى</span><input id="rp-to" type="date" max={today} value={data.toDay} onChange={e => pickTo(e.target.value)} /></label>
        </div>
        <label className="nq-select"><Calendar size={14} /><select value={shownYear} aria-label="السنة" onChange={e => { const y = Number(e.target.value); go(`from=${y}-01-01&to=${y === year ? today : `${y}-12-31`}`); }}>
          {Array.from({ length: 5 }, (_, i) => year - 4 + i).map(y => <option key={y} value={y}>{y}</option>)}
        </select></label>
        {finance && <a className="nq-btn green" href={`/api/admin/reports/export?${qs}`}><BadgeDollarSign size={16} />Excel موحد</a>}
        <div className="nq-seg">
          <button type="button" className={active === 'month' ? 'on' : ''} onClick={() => go(ranges.month)}>الشهر الحالي</button>
          <button type="button" className={active === 'prevMonth' ? 'on' : ''} onClick={() => go(ranges.prevMonth)}>الشهر السابق</button>
        </div>
        <button type="button" className="nq-btn" onClick={() => window.print()}><Printer size={16} />تصدير PDF</button>
        <div className="nq-seg">
          {([['month', 'هذا الشهر'], ['year', 'هذا العام'], ['all', 'كل الأوقات']] as const).map(([key, l]) => <button key={key} type="button" className={active === key ? 'on' : ''} onClick={() => go(ranges[key])}>{l}</button>)}
        </div>
      </div>
    </div>

    {/* Top stats */}
    <div className="nq-stats">
      <Card delay={0.05}>
        <div className="nq-stat-label"><BadgeDollarSign size={18} className="c-green" /><span>إيراد المنتجات</span></div>
        <div className="nq-stat-value c-green">{iqd(m.revenue)}</div>
        <div className="nq-stat-note">{vs(m.revenue, p.revenue)}</div>
      </Card>
      {finance ? <Card delay={0.1} className="tint-brown">
        <div className="nq-stat-label"><Wallet size={18} className="c-brown" /><span>صافي الربح</span></div>
        <div className={cx('nq-stat-value', net >= 0 ? 'c-brown' : 'c-red')}>{iqd(net)}</div>
        <div className="nq-stat-note">بعد تكلفة البضاعة والمصاريف · هامش {pct(m.revenue ? net / m.revenue : 0)}</div>
      </Card> : <Card delay={0.1}>
        <div className="nq-stat-label"><Receipt size={18} className="c-brown" /><span>متوسط الطلب</span></div>
        <div className="nq-stat-value">{iqd(m.averageOrder)}</div>
        <div className="nq-stat-note">{vs(m.averageOrder, p.averageOrder)}</div>
      </Card>}
      <Card delay={0.12} className="tint-green">
        <div className="nq-stat-label"><BadgeDollarSign size={18} className="c-green" /><span>المبالغ المحصلة</span></div>
        <div className="nq-stat-value c-green">{iqd(collected)}</div>
        <div className="nq-stat-note">تحصيل {collectRatio}% من قيمة الطلبات</div>
      </Card>
      <Card delay={0.14}>
        <div className="nq-stat-label"><ShoppingBag size={18} className="c-brown" /><span>طلبات مُسلّمة</span></div>
        <div className="nq-stat-value big">{num(m.orders)}</div>
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
          <AreaChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis reversed dataKey="name" stroke={AXIS} fontSize={10} tickLine={false} axisLine={false} />
            <YAxis orientation="right" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} tickFormatter={k} width={44} />
            <Tooltip contentStyle={TIP} formatter={(v: number) => [iqd(v)]} />
            <Area name="الفترة السابقة" type="monotone" dataKey="previous" stroke={SLATE} fill={SLATE} fillOpacity={0.08} />
            {finance && <Area name="الربح" type="monotone" dataKey="profit" stroke={GREEN} fill={GREEN} fillOpacity={0.1} />}
            <Area name="الإيراد" type="monotone" dataKey="revenue" stroke={BROWN} fill={BROWN} fillOpacity={0.1} />
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
            <Line type="monotone" dataKey="revenue" name="الإيراد المُسلّم" stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="expenses" name="المصاريف" stroke={RED} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
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
          <Line type="monotone" dataKey="revenue" name="الإيراد" stroke={BROWN} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 7 }} />
          {finance && <Line type="monotone" dataKey="profit" name="الربح" stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} />}
        </LineChart>
      </ResponsiveContainer></div>
    </Card>}

    {/* Products: sold vs returned + stock gap */}
    <div className="nq-row cols-3">
      <Card className="span-2" delay={0.35}>
        <h3 className="nq-h3 mb">تحليل المنتجات: المباع vs المرتجع</h3>
        <div className="nq-chart h300">{productBars.length ? <ResponsiveContainer width="100%" height="100%">
          <BarChart data={productBars} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis reversed dataKey="name" stroke={AXIS} fontSize={11} interval={0} />
            <YAxis orientation="right" stroke={AXIS} fontSize={12} width={36} allowDecimals={false} />
            <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={TIP} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar name="القطع المباعة" dataKey="sold" fill={BROWN} radius={[4, 4, 0, 0]} />
            <Bar name="القطع المرتجعة" dataKey="returned" fill={SLATE} radius={[4, 4, 0, 0]} />
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
        <BarChart data={categoryBars} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis reversed dataKey="name" stroke={AXIS} fontSize={12} />
          <YAxis orientation="right" stroke={AXIS} fontSize={12} tickFormatter={k} width={44} />
          <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={TIP} formatter={(v: number, n: string) => [n === 'الإيراد' ? iqd(v) : num(v), n]} />
          <Bar name="الإيراد" dataKey="revenue" fill={BROWN} radius={[6, 6, 0, 0]} maxBarSize={64} />
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
          <BarChart data={govs} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis reversed dataKey="name" stroke={AXIS} fontSize={11} interval={0} />
            <YAxis orientation="right" stroke={AXIS} fontSize={12} width={32} allowDecimals={false} />
            <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={TIP} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar name="الطلبات" dataKey="orders" fill={SLATE} radius={[4, 4, 0, 0]} />
            <Bar name="المُسلّم" dataKey="delivered" fill={BROWN} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer> : <div className="nq-empty">لا توجد طلبات</div>}</div>
      </Card>
    </div>

    {/* Inventory summary */}
    <div className="nq-stats four">
      <Card delay={0.45}><div className="nq-stat-label"><Boxes size={18} className="c-brown" /><span>متاح للبيع</span></div><div className="nq-stat-value big">{num(data.inventory.available)}</div><div className="nq-stat-note">{num(data.inventory.onHand)} موجود · {num(data.inventory.reserved)} محجوز</div></Card>
      <Card delay={0.46}><div className="nq-stat-label"><AlertTriangle size={18} className="c-amber" /><span>ألوان منخفضة</span></div><div className="nq-stat-value big">{data.inventory.lowCount}</div><div className="nq-stat-note">أقل من {data.inventory.lowThreshold} قطع</div></Card>
      <Card delay={0.47}><div className="nq-stat-label"><ShoppingCart size={18} className="c-red" /><span>ألوان نافدة</span></div><div className="nq-stat-value big c-red">{data.inventory.soldOutCount}</div><div className="nq-stat-note">تحتاج إعادة طلب</div></Card>
      <Card delay={0.48}><div className="nq-stat-label"><Truck size={18} className="c-blue" /><span>أجور التوصيل المحصلة</span></div><div className="nq-stat-value">{iqd(m.shipping)}</div><div className="nq-stat-note">منفصلة عن الإيراد</div></Card>
    </div>
    <p className="nq-foot"><BarChart3 size={14} /> الأرقام المالية محسوبة على الطلبات المُسلّمة بتاريخ التسليم · <PieIcon size={14} /> مقارنة مع {data.previousFrom.slice(0, 10)} – {data.previousTo.slice(0, 10)}</p>
  </main>;
}
