'use client';

import Link from 'next/link';
import { AccountsTabs } from './accounts-views';
import { useMemo, useState } from 'react';
import { ArrowRight, BarChart3, Boxes, CalendarDays, CircleDollarSign, Clock, Download, MapPin, Package, Percent, Printer, Receipt, ShoppingBag, ShoppingCart, Tag, TrendingUp, Truck, Users, Wallet, PackageX, Layers, Coins } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { ReportsData, ReportSection } from '@/lib/reports-data';
import '@fontsource/alexandria/400.css';
import '@fontsource/alexandria/500.css';
import '@fontsource/alexandria/600.css';
import '@fontsource/alexandria/700.css';
import '@fontsource/bodoni-moda/500.css';
import '@fontsource/bodoni-moda/700.css';
import '@fontsource/aref-ruqaa/700.css';
import './reports-nq.css';
import './report-charts.css';
import { CountUp, Empty, compact, fmt, iqd, pct, type Lang } from './dash-ui';
import { ColumnChart, DeltaPill, bucket, Figures, HeatGrid, LegendKeys, Meter, Panel, RC, RankedBars, SegmentedBar, StatTile, TrendChart, Waterfall, type Step, type TrendLine } from './report-charts';

const STATUS: Record<string, [string, string]> = { pending: ['Pending', 'قيد الانتظار'], confirmed: ['Confirmed', 'مؤكد'], processing: ['Processing', 'قيد التجهيز'], shipped: ['Shipped', 'تم الشحن'], delivered: ['Delivered', 'تم التوصيل'], cancelled: ['Cancelled', 'ملغي'], returned: ['Returned', 'مرتجع'], placed: ['Placed', 'طلبات جديدة'] };
const SOURCE_AR: Record<string, string> = { website: 'الموقع', instagram: 'إنستغرام', whatsapp: 'واتساب', facebook: 'فيسبوك', phone: 'هاتف', store: 'المتجر', other: 'أخرى', tiktok: 'تيك توك' };
const CATEGORY_AR: Record<string, string> = { handbag: 'حقائب يد', handbags: 'حقائب يد', 'phone-cases': 'كفرات موبايل', 'card-holders': 'حاملات بطاقات', belts: 'أحزمة', wallets: 'محافظ', backpacks: 'حقائب ظهر', bags: 'حقائب', 'crossbody-bags': 'حقائب كروس', 'tote-bags': 'حقائب توت', accessories: 'إكسسوارات', other: 'أخرى' };
const EXPENSE_AR: Record<string, string> = { marketing: 'تسويق', advertising: 'إعلانات', packaging: 'تغليف', salary: 'رواتب', rent: 'إيجار', software: 'برامج', delivery: 'توصيل', photography: 'تصوير', operations: 'تشغيل', other: 'أخرى' };
const WEEKDAYS: [string, string][] = [['Sun', 'الأحد'], ['Mon', 'الاثنين'], ['Tue', 'الثلاثاء'], ['Wed', 'الأربعاء'], ['Thu', 'الخميس'], ['Fri', 'الجمعة'], ['Sat', 'السبت']];
const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const tone = (s: string) => s === 'delivered' ? 'success' : s === 'cancelled' || s === 'returned' ? 'danger' : s === 'pending' ? 'warning' : 'info';

type SortKey = string;
function useSort<T extends Record<string, unknown>>(rows: T[], initial: SortKey) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: initial, dir: -1 });
  const sorted = useMemo(() => [...rows].sort((a, b) => { const x = a[sort.key], y = b[sort.key]; const xv = x == null ? -Infinity : x, yv = y == null ? -Infinity : y; return (xv > yv ? 1 : xv < yv ? -1 : 0) * sort.dir; }), [rows, sort]);
  // A real <button> inside the header so sorting works with Tab + Enter/Space, not only a mouse click.
  const th = (key: SortKey, label: string, num = true) => <th className={`${num ? 'num ' : ''}sortable`} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
    <button type="button" className="rc-sort" onClick={() => setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))}>{label}<span aria-hidden="true">{sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}</span></button>
  </th>;
  return { sorted, th };
}

export function ReportsView({ data, section, finance }: { data: ReportsData; section: ReportSection; finance: boolean }) {
  const { language } = useLanguage();
  const lang: Lang = language === 'ar' ? 'ar' : 'en';
  const tt = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const status = (s: string) => STATUS[s]?.[lang === 'ar' ? 1 : 0] ?? s;
  const source = (s: string) => lang === 'ar' ? SOURCE_AR[s] ?? s : cap(s);
  const category = (s: string) => lang === 'ar' ? CATEGORY_AR[s] ?? s : cap(s.replace(/-/g, ' '));
  const m = data.money, p = data.moneyPrevious;
  const qs = data.period === 'custom' ? `from=${data.fromDay}&to=${data.toDay}` : `period=${data.period}`;
  const tabs: [ReportSection, string, React.ReactNode][] = [
    ['overview', tt('Executive', 'الملخص التنفيذي'), <BarChart3 key="o" size={14} />], ['sales', tt('Sales', 'المبيعات'), <CircleDollarSign key="s" size={14} />], ...(finance ? [['profit', tt('Profit', 'الأرباح'), <TrendingUp key="p" size={14} />] as [ReportSection, string, React.ReactNode]] : []),
    ['products', tt('Products', 'المنتجات'), <Package key="pr" size={14} />], ['inventory', tt('Inventory', 'المخزون'), <Boxes key="i" size={14} />], ['customers', tt('Customers', 'الزبائن'), <Users key="c" size={14} />],
    ['orders', tt('Orders', 'الطلبات'), <ShoppingCart key="or" size={14} />], ['delivery', tt('Delivery', 'التوصيل'), <Truck key="d" size={14} />], ['discounts', tt('Offers & coupons', 'العروض والكوبونات'), <Tag key="t" size={14} />],
  ];
  const weekly = data.series.length > 45;
  const b = bucket(data.series.map(s => s.key), [data.series.map(s => s.revenue), data.series.map(s => s.profit), data.series.map(s => s.previousRevenue), data.series.map(s => s.placed), data.series.map(s => s.net), data.series.map(s => s.cogs)]);
  const labels = b.labels;
  const [bRevenue, bProfit, bPrev, bPlaced, bNet, bCogs] = b.series;
  const periods: [string, string][] = [['today', tt('Today', 'اليوم')], ['7d', tt('7 days', '7 أيام')], ['30d', tt('30 days', '30 يوم')], ['90d', tt('90 days', '90 يوم')], ['year', tt('This year', 'هذه السنة')]];
  const exportHref = `/api/admin/reports/export?${qs}`;
  const net = m.profit - data.expenses.current, netPrev = p.profit - data.expenses.previous;
  const dateFmt = (iso: string) => new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Baghdad' });

  const products = useSort(data.productTable.filter(r => r.units || r.onHand) as unknown as Record<string, unknown>[], 'revenue');
  const inventory = useSort(data.inventory.table as unknown as Record<string, unknown>[], 'daysLeft');
  const govs = useSort(data.governorates as unknown as Record<string, unknown>[], 'orders');

  const statusColor: Record<string, string> = { delivered: RC.good, shipped: RC.violet, processing: RC.info, confirmed: RC.info, pending: RC.warning, cancelled: RC.critical, returned: RC.serious };
  const outcomeParts = (['delivered', 'shipped', 'processing', 'confirmed', 'pending', 'returned', 'cancelled'] as const).map(k => ({ key: k, label: status(k), value: (data.statusCounts as Record<string, number>)[k] ?? 0, color: statusColor[k] }));
  const openOrders = data.statusCounts.pending + data.statusCounts.confirmed + data.statusCounts.processing + data.statusCounts.shipped;
  const payLabel = (k: string) => (({ cash: tt('Cash', 'نقداً'), bank_transfer: tt('Bank transfer', 'تحويل بنكي'), electronic: tt('Electronic', 'إلكتروني'), cod: tt('Cash on delivery', 'عند الاستلام'), credit: tt('Credit', 'آجل') } as Record<string, string>)[k] || k);
  const payStatusLabel = (k: string) => (({ paid: tt('Paid', 'مدفوع'), unpaid: tt('Unpaid', 'غير مدفوع'), refunded: tt('Refunded', 'مسترجع'), partial: tt('Partially paid', 'مدفوع جزئياً') } as Record<string, string>)[k] || k);
  const payStatusColor: Record<string, string> = { paid: RC.good, unpaid: RC.warning, partial: RC.info, refunded: RC.other };
  const lines: TrendLine[] = [
    { key: 'rev', label: tt('Revenue', 'الإيراد'), values: bRevenue, color: RC.brown, area: true },
    ...(finance ? [{ key: 'profit', label: tt('Profit', 'الربح'), values: bProfit, color: RC.green, dash: 'dashed' as const }] : []),
    { key: 'prev', label: tt('Previous period', 'الفترة السابقة'), values: bPrev, color: RC.prev, context: true, dash: 'dotted' },
  ];
  const lineKeys = <LegendKeys items={lines.map(l => ({ label: l.label, color: l.color, dash: l.dash }))} />;
  const noSales = tt('No delivered sales in this period.', 'لا توجد مبيعات مُسلّمة بالفترة.');
  const steps: Step[] = [
    { label: tt('Revenue', 'الإيراد'), value: m.revenue, kind: 'start' },
    { label: tt('Cost of goods', 'تكلفة البضاعة'), value: m.cogs, kind: 'minus' },
    ...(m.unknownCostRevenue ? [{ label: tt('Unknown-cost sales', 'مبيعات بلا تكلفة'), value: m.unknownCostRevenue, kind: 'minus' as const }] : []),
    { label: tt('Gross profit', 'إجمالي الربح'), value: m.profit, kind: 'subtotal' },
    { label: tt('Expenses', 'المصاريف'), value: data.expenses.current, kind: 'minus' },
    { label: tt('Net profit', 'صافي الربح'), value: net, kind: 'total' },
  ];
  const heroLines: TrendLine[] = lines.map(l => ({ ...l, color: l.key === 'rev' ? RC.darkBrown : l.key === 'profit' ? RC.darkGreen : RC.darkPrev }));
  const hero = (title: string) => <Panel className="rc-hero span-8" title={title} sub={weekly ? tt('Delivered orders by week, counted on their delivery date', 'الطلبات المُسلّمة أسبوعياً، محسوبة بتاريخ التسليم') : tt('Delivered orders, counted on their delivery date', 'الطلبات المُسلّمة، محسوبة بتاريخ التسليم')} icon={<TrendingUp size={16} />} action={<LegendKeys items={heroLines.map(l => ({ label: l.label, color: l.color, dash: l.dash }))} />}>
    <div className="rc-hero-figure"><strong className="rc-num"><CountUp value={m.revenue} format={fmt} /></strong><span className="rc-unit">{tt('IQD', 'د.ع')}</span><DeltaPill current={m.revenue} previous={p.revenue} lang={lang} /></div>
    <ul className="rc-hero-facts">
      <li><span>{tt('Delivered', 'مُسلّمة')}</span><b className="rc-num">{fmt(m.orders)}</b></li>
      <li><span>{tt('Average order', 'متوسط الطلب')}</span><b className="rc-num">{fmt(m.averageOrder)}</b></li>
      {finance && <li><span>{tt('Margin', 'الهامش')}</span><b className="rc-num">{pct(m.margin, 1)}</b></li>}
      <li><span>{tt('Previous period', 'الفترة السابقة')}</span><b className="rc-num">{fmt(p.revenue)}</b></li>
    </ul>
    <TrendChart labels={labels} lines={heroLines} format={fmt} height={240} emptyText={noSales} lang={lang} />
  </Panel>;
  const fallPanel = <Panel className="span-4 rc-receipt" title={tt('From revenue to net', 'من الإيراد للصافي')} sub={tt('Where each dinar went', 'وين راح كل دينار')} icon={<Wallet size={16} />} delay={60}>
    <Waterfall steps={steps} format={fmt} />
    <div className="rc-fall-meters">
      <Meter label={tt('Gross margin', 'الهامش الإجمالي')} value={m.margin} tone="green" sub={tt('on sales with a known cost', 'على المبيعات المعروفة التكلفة')} />
      <Meter label={tt('Net margin', 'الهامش الصافي')} value={m.revenue ? Math.max(0, net / m.revenue) : 0} tone={net < 0 ? 'red' : 'brown'} />
    </div>
  </Panel>;
  const outcomesPanel = (cls = '') => <Panel className={cls} title={tt('Order outcomes', 'نتائج الطلبات')} sub={tt(`${data.placed.count} orders placed`, `${data.placed.count} طلب بالفترة`)} icon={<Layers size={16} />}>
    <SegmentedBar parts={outcomeParts} emptyText={tt('No orders.', 'لا توجد طلبات.')} />
    <Figures items={[{ label: tt('Avg days to deliver', 'متوسط أيام التسليم'), value: data.avgDeliveryDays ? data.avgDeliveryDays.toFixed(1) : '—' }, { label: tt('Cancellation rate', 'نسبة الإلغاء'), value: pct(data.placed.cancelRate, 1) }, { label: tt('Still open', 'مفتوحة'), value: fmt(openOrders) }]} />
  </Panel>;
  const payPanel = <Panel className="span-12" title={tt('Money by payment', 'الفلوس حسب الدفع')} sub={tt('Orders placed in the period, with delivery fees', 'طلبات الفترة، مع أجور التوصيل')} icon={<Coins size={16} />}>
    <div className="rc-split">
      <div><h3 className="rc-h3">{tt('Paid, by method', 'المدفوع حسب الطريقة')}</h3>
        <RankedBars share format={fmt} emptyText={tt('No paid orders.', 'لا توجد طلبات مدفوعة.')} rows={[...data.paymentMethods].sort((a, b) => b.total - a.total).map(r => ({ key: r.method, label: payLabel(r.method), value: r.total, sub: tt(`${r.count} orders · ${r.customers} customers`, `${r.count} طلب · ${r.customers} زبون`) }))} />
      </div>
      <div><h3 className="rc-h3">{tt('All orders, by payment status', 'كل الطلبات حسب حالة الدفع')}</h3>
        <SegmentedBar format={fmt} emptyText={tt('No orders.', 'لا توجد طلبات.')} parts={data.paymentTotals.map(r => ({ key: r.status, label: `${payStatusLabel(r.status)} · ${r.count}`, value: r.total, color: payStatusColor[r.status] ?? RC.other }))} />
        <p className="rc-note">{tt('Full order values including cancelled orders — not cash received.', 'قيم الطلبات كاملة وتشمل الملغية — مو فلوس مقبوضة.')}</p>
      </div>
    </div>
  </Panel>;

  return <main className="admin-page dash nq rc-page">
    <AccountsTabs />
    <header className="rc-head rc-rise">
      <div><h1>{tt('Reports', 'التقارير')}</h1><p><CalendarDays size={14} /> {dateFmt(data.from)} – {dateFmt(data.to)} <span>· {tt('compared with', 'مقارنة مع')} {dateFmt(data.previousFrom)} – {dateFmt(data.previousTo)}</span></p></div>
      <div className="rc-head-actions">{finance && <a href={exportHref} className="rc-btn primary"><Download size={15} /> {tt('Export Excel', 'تصدير Excel')}</a>}<button type="button" className="rc-btn" onClick={() => window.print()}><Printer size={15} /> {tt('Print', 'طباعة')}</button></div>
    </header>
    <div className="rc-toolbar">
      <nav className="rc-periods" aria-label={tt('Period', 'الفترة')}>{periods.map(([k, l]) => <Link key={k} href={`/admin/reports?period=${k}&section=${section}`} className={data.period === k ? 'on' : ''} aria-current={data.period === k ? 'true' : undefined} scroll={false}>{l}</Link>)}
        <details className={`rc-custom ${data.period === 'custom' ? 'on' : ''}`}><summary><CalendarDays size={14} />{data.period === 'custom' ? `${data.fromDay} → ${data.toDay}` : tt('Custom', 'مخصص')}</summary>
          <form method="get"><input type="hidden" name="section" value={section} /><label>{tt('From', 'من')}<input type="date" name="from" defaultValue={data.fromDay} /></label><label>{tt('To', 'إلى')}<input type="date" name="to" defaultValue={data.toDay} /></label><button className="rc-btn primary" type="submit">{tt('Apply', 'تطبيق')}</button></form>
        </details>
      </nav>
      <nav className="rc-tabs" aria-label={tt('Report sections', 'أقسام التقارير')}>{tabs.map(([key, label, icon]) => <Link key={key} href={`/admin/reports?${qs}&section=${key}`} className={section === key ? 'on' : ''} aria-current={section === key ? 'page' : undefined} scroll={false}>{icon}{label}</Link>)}</nav>
    </div>

    {section === 'overview' && <div className="rc-grid">
      {hero(tt('Product revenue', 'إيراد المنتجات'))}
      {finance ? fallPanel : outcomesPanel('span-4')}
      <section className="rc-tiles span-12">
        <StatTile lang={lang} icon={<Truck size={16} />} tone="blue" label={tt('Delivered orders', 'طلبات مُسلّمة')} value={m.orders} current={m.orders} previous={p.orders} hint={tt(`${fmt(m.units)} units`, `${fmt(m.units)} قطعة`)} spark={data.series.map(s => s.delivered)} />
        <StatTile lang={lang} delay={40} icon={<Receipt size={16} />} tone="amber" label={tt('Average order', 'متوسط الطلب')} value={m.averageOrder} format={fmt} current={m.averageOrder} previous={p.averageOrder} hint={tt(`${(m.orders ? m.units / m.orders : 0).toFixed(2)} units per order`, `${(m.orders ? m.units / m.orders : 0).toFixed(2)} قطعة لكل طلب`)} />
        <StatTile lang={lang} delay={80} icon={<ShoppingCart size={16} />} tone="violet" label={tt('Orders placed', 'طلبات جديدة')} value={data.placed.count} current={data.placed.count} previous={data.placed.previous} hint={tt(`${openOrders} still open`, `${openOrders} بعدها مفتوحة`)} spark={data.series.map(s => s.placed)} />
        {finance ? <StatTile lang={lang} delay={120} icon={<Wallet size={16} />} tone="green" label={tt('Product profit', 'ربح المنتجات')} value={m.profit} format={fmt} current={m.profit} previous={p.profit} hint={<>{tt('Margin', 'الهامش')} <b>{pct(m.margin, 1)}</b></>} spark={data.series.map(s => s.profit)} />
          : <StatTile lang={lang} delay={120} icon={<PackageX size={16} />} tone="red" label={tt('Cancellation rate', 'نسبة الإلغاء')} value={data.placed.cancelRate * 100} format={n => `${n.toFixed(1)}%`} current={data.placed.cancelRate} previous={data.placed.previousCancelRate} inverse />}
      </section>
      {finance && outcomesPanel('span-4')}
      <Panel className={finance ? 'span-4' : 'span-6'} title={tt('Revenue by channel', 'الإيراد حسب القناة')} icon={<ShoppingBag size={16} />} delay={40}>
        <RankedBars share format={compact} emptyText={tt('No sales.', 'لا توجد مبيعات.')} rows={data.bySource.map(r => ({ key: r.key, label: source(r.key), value: r.revenue, sub: tt(`${r.orders} orders`, `${r.orders} طلب`) }))} />
      </Panel>
      <Panel className={finance ? 'span-4' : 'span-6'} title={tt('Revenue by category', 'الإيراد حسب الصنف')} icon={<Package size={16} />} delay={80}>
        <RankedBars share format={compact} emptyText={tt('No sales.', 'لا توجد مبيعات.')} rows={data.categoryTable.map(c => ({ key: c.key, label: category(c.key), value: c.revenue, sub: tt(`${c.units} units`, `${c.units} قطعة`) }))} />
      </Panel>
      <Panel className="span-8" title={tt('Top products', 'أفضل المنتجات')} icon={<Package size={16} />} action={<Link className="rc-link" href={`/admin/reports?${qs}&section=products`}>{tt('All products', 'كل المنتجات')} <ArrowRight size={13} /></Link>}>
        <ProductsTable rows={data.productTable.filter(r => r.units).slice(0, 6)} lang={lang} finance={finance} category={category} />
      </Panel>
      <Panel className="span-4" title={tt('Customers', 'الزبائن')} icon={<Users size={16} />} action={<Link className="rc-link" href={`/admin/reports?${qs}&section=customers`}>{tt('Details', 'التفاصيل')} <ArrowRight size={13} /></Link>}>
        <Figures items={[{ label: tt('Buyers', 'مشترين'), value: fmt(data.customers.buyers) }, { label: tt('New', 'جدد'), value: fmt(data.customers.newInPeriod) }, { label: tt('Returning', 'عائدين'), value: data.customers.buyers ? pct(data.customers.returning / data.customers.buyers) : '0%' }, { label: tt('Revenue / buyer', 'إيراد لكل مشتري'), value: compact(data.customers.revenuePerBuyer) }]} />
        <h3 className="rc-h3">{tt('Revenue split', 'توزيع الإيراد')}</h3>
        <SegmentedBar format={compact} emptyText="—" parts={[{ key: 'new', label: tt('New buyers', 'مشترين جدد'), value: data.customers.revenueNew, color: RC.brown }, { key: 'ret', label: tt('Returning', 'عائدين'), value: data.customers.revenueReturning, color: RC.good }]} />
      </Panel>
      {payPanel}
    </div>}

    {section === 'sales' && <div className="rc-grid">
      {hero(tt('Revenue over time', 'الإيراد عبر الوقت'))}
      <Panel className="span-4" title={weekly ? tt('Orders placed per week', 'الطلبات الجديدة أسبوعياً') : tt('Orders placed per day', 'الطلبات الجديدة يومياً')} sub={tt(`${data.placed.count} placed · ${data.series.reduce((s, x) => s + x.cancelled, 0)} cancelled`, `${data.placed.count} طلب · ${data.series.reduce((s, x) => s + x.cancelled, 0)} ملغي`)} icon={<ShoppingCart size={16} />} delay={60}>
        <ColumnChart labels={labels} values={bPlaced} height={250} emptyText={tt('No orders.', 'لا توجد طلبات.')} />
      </Panel>
      <section className="rc-tiles span-12">
        <StatTile lang={lang} icon={<Truck size={16} />} tone="blue" label={tt('Delivered orders', 'طلبات مُسلّمة')} value={m.orders} current={m.orders} previous={p.orders} spark={data.series.map(s => s.delivered)} />
        <StatTile lang={lang} delay={40} icon={<Receipt size={16} />} tone="amber" label={tt('Average order', 'متوسط الطلب')} value={m.averageOrder} format={fmt} current={m.averageOrder} previous={p.averageOrder} />
        <StatTile lang={lang} delay={80} icon={<ShoppingBag size={16} />} tone="brown" label={tt('Units sold', 'القطع المباعة')} value={m.units} current={m.units} previous={p.units} />
        <StatTile lang={lang} delay={120} icon={<Tag size={16} />} tone="red" label={tt('Discounts given', 'الخصومات')} value={m.discounts} format={fmt} current={m.discounts} previous={p.discounts} inverse hint={tt(`of ${fmt(m.grossSales)} gross`, `من ${fmt(m.grossSales)} إجمالي`)} />
      </section>
      <Panel className="span-7" title={tt('Channels', 'القنوات')} icon={<ShoppingBag size={16} />}><div className="dash-table-wrap" tabIndex={0}><table className="dash-table"><thead><tr><th>{tt('Channel', 'القناة')}</th><th className="num">{tt('Orders', 'الطلبات')}</th><th className="num">{tt('Revenue', 'الإيراد')}</th><th className="num">{tt('Share', 'الحصة')}</th><th className="num">{tt('Avg order', 'متوسط الطلب')}</th>{finance && <th className="num">{tt('Profit', 'الربح')}</th>}</tr></thead>
            <tbody>{data.bySource.map(r => <tr key={r.key}><td><b>{source(r.key)}</b></td><td className="num">{r.orders}</td><td className="num"><strong>{iqd(r.revenue)}</strong></td><td className="num">{pct(r.revenue / (m.revenue || 1))}</td><td className="num">{iqd(r.aov)}</td>{finance && <td className="num">{iqd(r.profit)}</td>}</tr>)}{!data.bySource.length && <tr><td colSpan={6} className="dash-muted">{tt('No sales in this period.', 'لا توجد مبيعات بالفترة.')}</td></tr>}</tbody></table></div></Panel>
      <Panel className="span-5" title={tt('Revenue by weekday', 'الإيراد حسب أيام الأسبوع')} icon={<CalendarDays size={16} />} delay={40}>
        <RankedBars format={compact} emptyText={tt('No sales.', 'لا توجد مبيعات.')} rows={data.byWeekday.map(d => ({ key: String(d.day), label: WEEKDAYS[d.day][lang === 'ar' ? 1 : 0], value: d.revenue, sub: tt(`${d.orders} orders`, `${d.orders} طلب`) }))} />
      </Panel>
      <Panel className="span-12" title={tt('When orders come in', 'أوقات وصول الطلبات')} sub={tt('Baghdad time', 'بتوقيت بغداد')} icon={<Clock size={16} />}><HeatGrid grid={data.heatmap} lang={lang} /></Panel>
      {payPanel}
    </div>}

    {section === 'profit' && finance && <div className="rc-grid">
      <section className="rc-tiles span-12">
        <StatTile lang={lang} icon={<Wallet size={16} />} tone="green" label={tt('Gross profit', 'إجمالي الربح')} value={m.profit} format={fmt} current={m.profit} previous={p.profit} spark={data.series.map(s => s.profit)} hint={<>{tt('Margin', 'الهامش')} <b>{pct(m.margin, 1)}</b></>} />
        <StatTile lang={lang} delay={40} icon={<Coins size={16} />} tone="amber" label={tt('Cost of goods sold', 'تكلفة البضاعة المباعة')} value={m.cogs} format={fmt} current={m.cogs} previous={p.cogs} inverse hint={tt(`${fmt(m.knownCostUnits)} units with known cost`, `${fmt(m.knownCostUnits)} قطعة معروفة التكلفة`)} />
        <StatTile lang={lang} delay={80} icon={<Receipt size={16} />} tone="violet" label={tt('Operating expenses', 'المصاريف التشغيلية')} value={data.expenses.current} format={fmt} current={data.expenses.current} previous={data.expenses.previous} inverse />
        <StatTile lang={lang} delay={120} icon={<TrendingUp size={16} />} tone={net >= 0 ? 'brown' : 'red'} label={tt('Net profit', 'صافي الربح')} value={net} format={fmt} current={net} previous={netPrev} spark={data.series.map(s => s.net)} hint={m.unknownCostRevenue ? tt(`${fmt(m.unknownCostUnits)} units without a cost left out`, `${fmt(m.unknownCostUnits)} قطعة بلا تكلفة مستبعدة`) : <>{tt('Net margin', 'الهامش الصافي')} <b>{pct(m.revenue ? net / m.revenue : 0, 1)}</b></>} />
      </section>
      <Panel className="span-8" title={tt('Profit over time', 'الربح عبر الوقت')} icon={<TrendingUp size={16} />} action={<LegendKeys items={[{ label: tt('Gross profit', 'إجمالي الربح'), color: RC.green }, { label: tt('Net after expenses', 'الصافي بعد المصاريف'), color: RC.brown, dash: 'dashed' }, { label: tt('Cost of goods', 'تكلفة البضاعة'), color: RC.prev, dash: 'dotted' }]} />}>
        <TrendChart labels={labels} height={270} emptyText={noSales} lang={lang} lines={[{ key: 'gp', label: tt('Gross profit', 'إجمالي الربح'), values: bProfit, color: RC.green, area: true }, { key: 'net', label: tt('Net', 'الصافي'), values: bNet, color: RC.brown, dash: 'dashed' }, { key: 'cogs', label: tt('Cost of goods', 'تكلفة البضاعة'), values: bCogs, color: RC.prev, context: true, dash: 'dotted' }]} />
      </Panel>
      {fallPanel}
      <Panel className="span-6" title={tt('Most profitable products', 'أكثر المنتجات ربحاً')} icon={<Package size={16} />}>
        <RankedBars share format={compact} color={RC.green} emptyText="—" rows={[...data.productTable].filter(r => r.units).sort((a, b) => b.profit - a.profit).slice(0, 8).map(r => ({ key: String(r.id), label: lang === 'ar' ? r.nameAr : r.name, value: r.profit, sub: r.margin != null ? `${tt('margin', 'هامش')} ${pct(r.margin)}` : undefined, href: `/admin/products/${r.id}` }))} />
      </Panel>
      <Panel className="span-6" title={tt('Expenses by category', 'المصاريف حسب النوع')} icon={<Receipt size={16} />} action={<Link className="rc-link" href="/admin/finance">{tt('Finance', 'المالية')} <ArrowRight size={13} /></Link>}>
        <RankedBars share format={compact} color={RC.violet} emptyText={tt('No expenses in this period.', 'لا توجد مصاريف بالفترة.')} rows={data.expenses.byCategory.map(e => ({ key: e.key, label: lang === 'ar' ? EXPENSE_AR[e.key] ?? e.key : cap(e.key), value: e.value }))} />
      </Panel>
      <Panel className="span-12" title={tt('Profit by product', 'الربح حسب المنتج')} icon={<Package size={16} />}><ProductsTable rows={data.productTable.filter(r => r.units)} lang={lang} finance category={category} showShare /></Panel>
    </div>}

    {section === 'products' && <div className="rc-grid">
      <section className="rc-tiles span-12">
        <StatTile lang={lang} icon={<Package size={16} />} tone="brown" label={tt('Products sold', 'منتجات مباعة')} value={data.productTable.filter(r => r.units).length} hint={tt(`of ${data.productTable.length} products`, `من ${data.productTable.length} منتج`)} />
        <StatTile lang={lang} delay={40} icon={<ShoppingBag size={16} />} tone="blue" label={tt('Units sold', 'القطع المباعة')} value={m.units} current={m.units} previous={p.units} />
        <StatTile lang={lang} delay={80} icon={<PackageX size={16} />} tone="red" label={tt('Returned units', 'قطع مرتجعة')} value={data.productTable.reduce((s, r) => s + r.returnedUnits, 0)} />
        <StatTile lang={lang} delay={120} icon={<Boxes size={16} />} tone="amber" label={tt('Not sold in period', 'ما انباعت بالفترة')} value={data.productTable.filter(r => !r.units && r.onHand > 0).length} hint={tt('products with stock and no sales', 'منتجات بيها مخزون وبلا بيع')} />
      </section>
      <Panel className="span-6" title={tt('Best sellers by revenue', 'الأكثر مبيعاً بالإيراد')} icon={<TrendingUp size={16} />}>
        <RankedBars share format={compact} emptyText={noSales} limit={8} rows={data.productTable.filter(r => r.units).sort((a, b) => b.revenue - a.revenue).map(r => ({ key: String(r.id), label: lang === 'ar' ? r.nameAr : r.name, value: r.revenue, sub: tt(`${r.units} units`, `${r.units} قطعة`), href: `/admin/products/${r.id}` }))} />
      </Panel>
      <Panel className="span-6" title={tt('Top colours', 'أكثر الألوان مبيعاً')} icon={<Layers size={16} />} delay={40}>
        <RankedBars format={fmt} emptyText={noSales} limit={8} rows={data.variantTable.map(v => ({ key: String(v.id), label: `${lang === 'ar' ? v.productAr : v.product} · ${lang === 'ar' ? v.colorAr : v.color}`, value: v.units, swatch: v.hex, sub: tt(`${v.available} left`, `باقي ${v.available}`) }))} />
      </Panel>
      <Panel className="span-12" title={tt('Product performance', 'أداء المنتجات')} sub={tt('Click a column to sort', 'اضغط على العمود للترتيب')} icon={<Package size={16} />}><div className="dash-table-wrap" tabIndex={0}><table className="dash-table"><thead><tr>{products.th('name', tt('Product', 'المنتج'), false)}{products.th('units', tt('Units', 'القطع'))}{products.th('orders', tt('Orders', 'الطلبات'))}{products.th('revenue', tt('Revenue', 'الإيراد'))}{finance && products.th('profit', tt('Profit', 'الربح'))}{finance && products.th('margin', tt('Margin', 'الهامش'))}{products.th('returnedUnits', tt('Returned', 'مرتجع'))}{products.th('available', tt('Available', 'متاح'))}{products.th('daysLeft', tt('Days of stock', 'أيام المخزون'))}{products.th('sellThrough', tt('Sell-through', 'نسبة التصريف'))}</tr></thead>
          <tbody>{(products.sorted as unknown as ReportsData['productTable']).map(r => <tr key={r.id}><td><Link href={`/admin/products/${r.id}`} className="dash-product">{r.image ? <img src={r.image} alt="" loading="lazy" /> : <span className="dash-thumb" />}<span><b>{lang === 'ar' ? r.nameAr : r.name}</b><small>{category(r.category)}{!r.published && ` · ${tt('draft', 'مسودة')}`}</small></span></Link></td><td className="num">{r.units}</td><td className="num">{r.orders}</td><td className="num"><strong>{iqd(r.revenue)}</strong></td>{finance && <td className="num">{iqd(r.profit)}</td>}{finance && <td className="num">{r.margin == null ? '—' : pct(r.margin)}</td>}<td className="num">{r.returnedUnits || '—'}</td><td className="num">{r.available}</td><td className="num">{r.daysLeft == null ? '—' : <span className={`dash-chip ${r.daysLeft <= 14 ? 'danger' : r.daysLeft <= 30 ? 'warning' : 'success'}`}>{r.daysLeft}</span>}</td><td className="num">{pct(r.sellThrough)}</td></tr>)}</tbody></table></div></Panel>
      <Panel className="span-12" title={tt('Colours', 'الألوان')} icon={<Layers size={16} />}><div className="dash-table-wrap" tabIndex={0}><table className="dash-table"><thead><tr><th>{tt('Colour', 'اللون')}</th><th>{tt('Product', 'المنتج')}</th><th className="num">{tt('Units', 'القطع')}</th><th className="num">{tt('Revenue', 'الإيراد')}</th>{finance && <th className="num">{tt('Profit', 'الربح')}</th>}<th className="num">{tt('Available', 'متاح')}</th></tr></thead>
          <tbody>{data.variantTable.map(v => <tr key={v.id}><td><span className="dash-chip"><i style={{ width: 9, height: 9, borderRadius: '50%', background: v.hex, display: 'inline-block' }} />{lang === 'ar' ? v.colorAr : v.color}</span></td><td>{lang === 'ar' ? v.productAr : v.product}</td><td className="num">{v.units}</td><td className="num">{iqd(v.revenue)}</td>{finance && <td className="num">{iqd(v.profit)}</td>}<td className="num">{v.available}</td></tr>)}{!data.variantTable.length && <tr><td colSpan={6} className="dash-muted">{tt('No sales in this period.', 'لا توجد مبيعات بالفترة.')}</td></tr>}</tbody></table></div></Panel>
    </div>}

    {section === 'inventory' && <div className="rc-grid">
      <section className="rc-tiles span-12">
        <StatTile lang={lang} icon={<Boxes size={16} />} tone="brown" label={tt('Available to sell', 'متاح للبيع')} value={data.inventory.available} hint={tt(`${fmt(data.inventory.onHand)} on hand · ${fmt(data.inventory.reserved)} reserved`, `${fmt(data.inventory.onHand)} موجود · ${fmt(data.inventory.reserved)} محجوز`)} />
        {finance ? <StatTile lang={lang} delay={40} icon={<Coins size={16} />} tone="amber" label={tt('Stock value (cost)', 'قيمة المخزون (تكلفة)')} value={data.inventory.knownValue} format={fmt} hint={data.inventory.unknownCostUnits ? tt(`${fmt(data.inventory.unknownCostUnits)} units without a cost`, `${fmt(data.inventory.unknownCostUnits)} قطعة بلا تكلفة`) : undefined} />
          : <StatTile lang={lang} delay={40} icon={<CircleDollarSign size={16} />} tone="amber" label={tt('Retail value', 'القيمة بسعر البيع')} value={data.inventory.retailValue} format={fmt} />}
        <StatTile lang={lang} delay={80} icon={<PackageX size={16} />} tone="red" label={tt('Sold-out colours', 'ألوان نافدة')} value={data.inventory.soldOutCount} />
        <StatTile lang={lang} delay={120} icon={<Clock size={16} />} tone="violet" label={tt('Low-stock colours', 'ألوان منخفضة')} value={data.inventory.lowCount} hint={`≤ ${data.inventory.lowThreshold}`} />
      </section>
      <Panel className="span-6" title={tt('Reorder suggestions', 'اقتراحات إعادة الطلب')} sub={tt(`Enough for ${data.inventory.coverDays} days after a ${data.inventory.leadDays}-day wait`, `تكفي ${data.inventory.coverDays} يوم بيع بعد انتظار ${data.inventory.leadDays} يوم`)} icon={<ShoppingCart size={16} />} action={<Link className="rc-link" href="/admin/purchases">{tt('New purchase', 'مشتريات جديدة')} <ArrowRight size={13} /></Link>}>
        {data.inventory.reorder.length ? <div className="dash-table-wrap" tabIndex={0}><table className="dash-table"><thead><tr><th>{tt('Product / colour', 'المنتج / اللون')}</th><th className="num">{tt('Available', 'متاح')}</th><th className="num">{tt('Days left', 'أيام متبقية')}</th><th className="num">{tt('Order', 'اطلب')}</th>{finance && <th className="num">{tt('Est. cost', 'كلفة تقريبية')}</th>}</tr></thead>
            <tbody>{data.inventory.reorder.map(v => <tr key={v.id}><td><b>{lang === 'ar' ? v.productAr : v.product}</b><small><i style={{ width: 8, height: 8, borderRadius: '50%', background: v.hex, display: 'inline-block', marginInlineEnd: 5 }} />{lang === 'ar' ? v.colorAr : v.color}</small></td><td className="num"><span className={`dash-chip ${v.available === 0 ? 'danger' : 'warning'}`}>{v.available}</span></td><td className="num">{v.daysLeft ?? '—'}</td><td className="num"><b>{v.qty}</b></td>{finance && <td className="num">{v.budget ? iqd(v.budget) : '—'}</td>}</tr>)}</tbody></table></div> : <Empty small>{tt('Nothing selling is about to run out.', 'ماكو منتج ديبيع وقريب يخلص.')}</Empty>}
      </Panel>
      <Panel className="span-6" title={tt('Slow movers', 'منتجات راكدة')} sub={tt(`${fmt(data.inventory.slowValue)} IQD tied up`, `${fmt(data.inventory.slowValue)} د.ع واكفة`)} icon={<Clock size={16} />} delay={40}>
        {data.inventory.slow.length ? <div className="dash-table-wrap" tabIndex={0}><table className="dash-table"><thead><tr><th>{tt('Product / colour', 'المنتج / اللون')}</th><th className="num">{tt('On hand', 'موجود')}</th><th className="num">{tt('Sold / 30 days', 'بيع 30 يوم')}</th><th className="num">{finance ? tt('Tied up (cost)', 'مجمّد (كلفة)') : tt('Retail value', 'قيمة البيع')}</th></tr></thead>
            <tbody>{data.inventory.slow.map(v => <tr key={v.id}><td><b>{lang === 'ar' ? v.productAr : v.product}</b><small><i style={{ width: 8, height: 8, borderRadius: '50%', background: v.hex, display: 'inline-block', marginInlineEnd: 5 }} />{lang === 'ar' ? v.colorAr : v.color}</small></td><td className="num">{v.onHand}</td><td className="num">{Math.round(v.perDay * 30)}</td><td className="num">{iqd(finance ? v.tiedUp : v.retailValue)}</td></tr>)}</tbody></table></div> : <Empty small>{tt('No slow stock.', 'ماكو مخزون راكد.')}</Empty>}
      </Panel>
      <Panel className="span-12" title={tt('Stock by colour', 'المخزون حسب اللون')} icon={<Boxes size={16} />} action={<Link className="rc-link" href="/admin/inventory">{tt('Manage inventory', 'إدارة المخزون')} <ArrowRight size={13} /></Link>}><div className="dash-table-wrap" tabIndex={0}><table className="dash-table"><thead><tr>{inventory.th('product', tt('Product / colour', 'المنتج / اللون'), false)}{inventory.th('onHand', tt('On hand', 'موجود'))}{inventory.th('reserved', tt('Reserved', 'محجوز'))}{inventory.th('available', tt('Available', 'متاح'))}{inventory.th('perDay', tt('Sold / day', 'بيع يومي'))}{inventory.th('daysLeft', tt('Days left', 'أيام متبقية'))}{finance && inventory.th('costValue', tt('Cost value', 'قيمة التكلفة'))}{inventory.th('retailValue', tt('Retail value', 'قيمة البيع'))}</tr></thead>
          <tbody>{(inventory.sorted as unknown as ReportsData['inventory']['table']).map(v => <tr key={v.id}><td><b>{lang === 'ar' ? v.productAr : v.product}</b><small><i style={{ width: 8, height: 8, borderRadius: '50%', background: v.hex, display: 'inline-block', marginInlineEnd: 5 }} />{lang === 'ar' ? v.colorAr : v.color}</small></td><td className="num">{v.onHand}</td><td className="num">{v.reserved || '—'}</td><td className="num"><span className={`dash-chip ${v.available === 0 ? 'danger' : v.available <= data.inventory.lowThreshold ? 'warning' : 'success'}`}>{v.available}</span></td><td className="num">{v.perDay ? v.perDay.toFixed(1) : '—'}</td><td className="num">{v.daysLeft ?? '—'}</td>{finance && <td className="num">{iqd(v.costValue)}</td>}<td className="num">{iqd(v.retailValue)}</td></tr>)}</tbody></table></div></Panel>
      <Panel className="span-5" title={tt('Stock movements in period', 'حركة المخزون بالفترة')} icon={<Layers size={16} />}>{data.inventory.movements.length ? <div className="dash-table-wrap" tabIndex={0}><table className="dash-table"><thead><tr><th>{tt('Reason', 'السبب')}</th><th className="num">{tt('In', 'داخل')}</th><th className="num">{tt('Out', 'خارج')}</th></tr></thead><tbody>{data.inventory.movements.map(r => <tr key={r.reason}><td>{r.reason}</td><td className="num">{r.in ? <span className="dash-chip success">+{r.in}</span> : '—'}</td><td className="num">{r.out ? <span className="dash-chip danger">−{r.out}</span> : '—'}</td></tr>)}</tbody></table></div> : <Empty small>{tt('No movements.', 'لا توجد حركات.')}</Empty>}</Panel>
      <Panel className="span-7" title={tt('Purchase batches', 'وجبات الشراء')} icon={<Package size={16} />}><div className="dash-table-wrap" tabIndex={0}><table className="dash-table"><thead><tr><th>{tt('Batch', 'الوجبة')}</th><th>{tt('Product', 'المنتج')}</th><th className="num">{tt('Received', 'المستلم')}</th><th className="num">{tt('Left', 'المتبقي')}</th>{finance && <th className="num">{tt('Unit cost', 'تكلفة القطعة')}</th>}</tr></thead><tbody>{data.inventory.batches.slice(0, 30).map(b => <tr key={b.id}><td><b>{b.batch}</b><small>{dateFmt(b.receivedAt)}</small></td><td>{lang === 'ar' ? b.productAr : b.product}<small>{b.color}</small></td><td className="num">{b.received}</td><td className="num">{b.remaining}</td>{finance && <td className="num">{b.cost == null ? '—' : iqd(b.cost)}</td>}</tr>)}{!data.inventory.batches.length && <tr><td colSpan={5} className="dash-muted">{tt('No batches yet.', 'لا توجد وجبات بعد.')}</td></tr>}</tbody></table></div></Panel>
    </div>}

    {section === 'customers' && <div className="rc-grid">
      <section className="rc-tiles span-12">
        <StatTile lang={lang} icon={<Users size={16} />} tone="brown" label={tt('Buyers in period', 'مشترين بالفترة')} value={data.customers.buyers} hint={tt(`${fmt(data.customers.newInPeriod)} new`, `${fmt(data.customers.newInPeriod)} جديد`)} />
        <StatTile lang={lang} delay={40} icon={<TrendingUp size={16} />} tone="green" label={tt('Returning buyers', 'مشترين عائدين')} value={data.customers.buyers ? (data.customers.returning / data.customers.buyers) * 100 : 0} format={n => `${n.toFixed(0)}%`} hint={tt(`${fmt(data.customers.repeatAllTime)} repeat customers of ${fmt(data.customers.total)}`, `${fmt(data.customers.repeatAllTime)} زبون متكرر من ${fmt(data.customers.total)}`)} />
        <StatTile lang={lang} delay={80} icon={<Receipt size={16} />} tone="amber" label={tt('Revenue per buyer', 'إيراد لكل مشتري')} value={data.customers.revenuePerBuyer} format={fmt} />
        <StatTile lang={lang} delay={120} icon={<Clock size={16} />} tone="red" label={tt('Inactive 90+ days', 'غير نشط 90+ يوم')} value={data.customers.inactive90} hint={tt(`${data.customers.optIn} accept marketing`, `${data.customers.optIn} يقبلون الرسائل`)} />
      </section>
      <Panel className="span-8" title={tt('Top customers in period', 'أفضل الزبائن بالفترة')} icon={<Users size={16} />} action={<Link className="rc-link" href="/admin/customers">CRM <ArrowRight size={13} /></Link>}><div className="dash-table-wrap" tabIndex={0}><table className="dash-table"><thead><tr><th>{tt('Customer', 'الزبون')}</th><th>{tt('Governorate', 'المحافظة')}</th><th className="num">{tt('Orders', 'الطلبات')}</th><th className="num">{tt('Delivered', 'مُسلّم')}</th><th className="num">{tt('Cancelled', 'ملغي')}</th><th className="num">{tt('Value', 'القيمة')}</th><th>{tt('Last order', 'آخر طلب')}</th></tr></thead>
            <tbody>{data.topBuyers.map(c => <tr key={c.phone}><td><Link href={`/admin/customers?q=${encodeURIComponent(c.phone)}`} className="dash-product"><span><b>{c.name}</b><small dir="ltr">{c.phone}</small></span></Link></td><td>{lang === 'ar' ? c.governorateName.ar : c.governorateName.en}</td><td className="num">{c.orders}</td><td className="num">{c.delivered}</td><td className="num">{c.cancelled ? <span className="dash-chip danger">{c.cancelled}</span> : '—'}</td><td className="num"><strong>{iqd(c.revenue)}</strong></td><td>{dateFmt(c.last)}</td></tr>)}{!data.topBuyers.length && <tr><td colSpan={7} className="dash-muted">{tt('No orders in this period.', 'لا توجد طلبات بالفترة.')}</td></tr>}</tbody></table></div></Panel>
      <Panel className="span-4" title={tt('New vs returning', 'جدد مقابل عائدين')} sub={tt('Share of revenue', 'حصة من الإيراد')} icon={<TrendingUp size={16} />} delay={40}>
        <SegmentedBar format={compact} emptyText={tt('No sales.', 'لا توجد مبيعات.')} parts={[{ key: 'new', label: tt('New buyers', 'مشترين جدد'), value: data.customers.revenueNew, color: RC.brown }, { key: 'ret', label: tt('Returning', 'عائدين'), value: data.customers.revenueReturning, color: RC.good }]} />
        <Figures items={[{ label: tt('New in period', 'جدد بالفترة'), value: fmt(data.customers.newInPeriod) }, { label: tt('All customers', 'كل الزبائن'), value: fmt(data.customers.total) }]} />
      </Panel>
    </div>}

    {section === 'orders' && <div className="rc-grid">
      <section className="rc-tiles span-12">
        <StatTile lang={lang} icon={<ShoppingCart size={16} />} tone="brown" label={tt('Orders placed', 'طلبات جديدة')} value={data.placed.count} current={data.placed.count} previous={data.placed.previous} spark={data.series.map(s => s.placed)} />
        <StatTile lang={lang} delay={40} icon={<Truck size={16} />} tone="green" label={tt('Delivery success', 'نسبة التسليم')} value={data.placed.count ? (data.statusCounts.delivered / data.placed.count) * 100 : 0} format={n => `${n.toFixed(1)}%`} hint={tt(`${data.statusCounts.delivered} delivered`, `${data.statusCounts.delivered} مُسلّم`)} />
        <StatTile lang={lang} delay={80} icon={<PackageX size={16} />} tone="red" label={tt('Cancellation rate', 'نسبة الإلغاء')} value={data.placed.cancelRate * 100} format={n => `${n.toFixed(1)}%`} current={data.placed.cancelRate} previous={data.placed.previousCancelRate} inverse hint={tt(`returns ${pct(data.placed.returnRate, 1)}`, `المرتجع ${pct(data.placed.returnRate, 1)}`)} />
        <StatTile lang={lang} delay={120} icon={<Clock size={16} />} tone="blue" label={tt('Avg days to deliver', 'متوسط أيام التسليم')} value={data.avgDeliveryDays} format={n => n.toFixed(1)} hint={tt(`${openOrders} still open`, `${openOrders} بعدها مفتوحة`)} />
      </section>
      <Panel className="span-5" title={tt('Fulfilment funnel', 'مسار تنفيذ الطلبات')} sub={tt('Share of orders placed that reached each step', 'نسبة الطلبات اللي وصلت كل مرحلة')} icon={<Layers size={16} />}>
        <RankedBars format={fmt} emptyText={tt('No orders.', 'لا توجد طلبات.')} rows={data.funnel.map(f => ({ key: f.key, label: status(f.key), value: f.count, sub: pct(f.count / (data.funnel[0].count || 1)) }))} />
      </Panel>
      <Panel className="span-7" title={weekly ? tt('Orders per week', 'الطلبات أسبوعياً') : tt('Orders per day', 'الطلبات يومياً')} icon={<ShoppingCart size={16} />} delay={40}><ColumnChart labels={labels} values={bPlaced} height={220} emptyText={tt('No orders.', 'لا توجد طلبات.')} /></Panel>
      {outcomesPanel('span-12')}
      {payPanel}
      <Panel className="span-12" title={tt('Orders in period', 'طلبات الفترة')} icon={<ShoppingCart size={16} />} action={<Link className="rc-link" href="/admin/orders">{tt('Manage orders', 'إدارة الطلبات')} <ArrowRight size={13} /></Link>}><div className="dash-table-wrap" tabIndex={0}><table className="dash-table"><thead><tr><th>{tt('Order', 'الطلب')}</th><th>{tt('Customer', 'الزبون')}</th><th>{tt('Channel', 'القناة')}</th><th>{tt('Status', 'الحالة')}</th><th className="num">{tt('Units', 'القطع')}</th><th className="num">{tt('Products', 'المنتجات')}</th>{finance && <th className="num">{tt('Profit', 'الربح')}</th>}<th className="num">{tt('Delivery', 'التوصيل')}</th><th>{tt('Placed', 'التاريخ')}</th></tr></thead>
          <tbody>{data.ordersList.map(o => <tr key={o.id}><td><Link href={`/admin/orders/${o.id}`} className="admin-strong-link">{o.reference}</Link></td><td>{o.name}<small dir="ltr">{o.phone}</small></td><td>{source(o.source)}</td><td><span className={`dash-chip ${tone(o.status)}`}>{status(o.status)}</span></td><td className="num">{o.units}</td><td className="num">{iqd(o.revenue)}</td>{finance && <td className="num">{o.profit == null ? '—' : iqd(o.profit)}</td>}<td className="num">{iqd(o.shipping)}</td><td>{dateFmt(o.createdAt)}</td></tr>)}{!data.ordersList.length && <tr><td colSpan={9} className="dash-muted">{tt('No orders in this period.', 'لا توجد طلبات بالفترة.')}</td></tr>}</tbody></table></div></Panel>
    </div>}

    {section === 'delivery' && <div className="rc-grid">
      <section className="rc-tiles span-12">
        <StatTile lang={lang} icon={<MapPin size={16} />} tone="brown" label={tt('Governorates with orders', 'محافظات بيها طلبات')} value={data.governorates.length} />
        <StatTile lang={lang} delay={40} icon={<Truck size={16} />} tone="green" label={tt('Delivery collected', 'أجور التوصيل المحصلة')} value={m.shipping} format={fmt} current={m.shipping} previous={p.shipping} hint={tt('Kept apart from revenue', 'منفصلة عن الإيراد')} />
        <StatTile lang={lang} delay={80} icon={<Clock size={16} />} tone="blue" label={tt('Avg days to deliver', 'متوسط أيام التسليم')} value={data.avgDeliveryDays} format={n => n.toFixed(1)} />
        <StatTile lang={lang} delay={120} icon={<PackageX size={16} />} tone="red" label={tt('Returned in transit', 'مرتجع من الشحن')} value={data.statusCounts.returned} />
      </section>
      <Panel className="span-4" title={tt('Orders by governorate', 'الطلبات حسب المحافظة')} icon={<MapPin size={16} />}>
        <RankedBars share format={fmt} emptyText="—" limit={10} rows={data.governorates.map(g => ({ key: g.code, label: lang === 'ar' ? g.nameAr : g.nameEn, value: g.orders, sub: tt(`${pct(g.successRate)} delivered`, `${pct(g.successRate)} تسليم`) }))} />
      </Panel>
      <Panel className="span-8" title={tt('Delivery by governorate', 'التوصيل حسب المحافظة')} icon={<Truck size={16} />} delay={40} action={<Link className="rc-link" href="/admin/shipping">{tt('Delivery settings', 'إعدادات التوصيل')} <ArrowRight size={13} /></Link>}><div className="dash-table-wrap" tabIndex={0}><table className="dash-table"><thead><tr>{govs.th('nameEn', tt('Governorate', 'المحافظة'), false)}{govs.th('orders', tt('Orders', 'الطلبات'))}{govs.th('successRate', tt('Delivered', 'تسليم'))}{govs.th('cancelRate', tt('Cancelled', 'إلغاء'))}{govs.th('returnRate', tt('Returned', 'مرتجع'))}{govs.th('avgDays', tt('Avg days', 'متوسط الأيام'))}<th className="num">{tt('Promised', 'الموعود')}</th>{govs.th('revenue', tt('Revenue', 'الإيراد'))}{govs.th('shipping', tt('Delivery fees', 'أجور التوصيل'))}</tr></thead>
            <tbody>{(govs.sorted as unknown as ReportsData['governorates']).map(g => <tr key={g.code}><td><b>{lang === 'ar' ? g.nameAr : g.nameEn}</b></td><td className="num">{g.orders}</td><td className="num"><span className={`dash-chip ${g.successRate >= 0.8 ? 'success' : g.successRate >= 0.6 ? 'warning' : 'danger'}`}>{pct(g.successRate)}</span></td><td className="num">{pct(g.cancelRate)}</td><td className="num">{pct(g.returnRate)}</td><td className="num">{g.avgDays == null ? '—' : g.avgDays.toFixed(1)}</td><td className="num">{g.promised}</td><td className="num">{iqd(g.revenue)}</td><td className="num">{iqd(g.shipping)}</td></tr>)}{!data.governorates.length && <tr><td colSpan={9} className="dash-muted">{tt('No orders in this period.', 'لا توجد طلبات بالفترة.')}</td></tr>}</tbody></table></div></Panel>
    </div>}

    {section === 'discounts' && <div className="rc-grid">
      <section className="rc-tiles span-12">
        <StatTile lang={lang} icon={<Tag size={16} />} tone="brown" label={tt('Total discounts', 'إجمالي الخصومات')} value={m.discounts} format={fmt} current={m.discounts} previous={p.discounts} inverse />
        <StatTile lang={lang} delay={40} icon={<Percent size={16} />} tone="amber" label={tt('Discount rate', 'نسبة الخصم')} value={m.grossSales ? (m.discounts / m.grossSales) * 100 : 0} format={n => `${n.toFixed(1)}%`} hint={tt('of gross sales', 'من إجمالي المبيعات')} />
        <StatTile lang={lang} delay={80} icon={<Receipt size={16} />} tone="blue" label={tt('Orders with a discount', 'طلبات عليها خصم')} value={data.discountedOrders} hint={tt(`of ${m.orders} delivered`, `من ${m.orders} مُسلّم`)} />
        <StatTile lang={lang} delay={120} icon={<Tag size={16} />} tone="violet" label={tt('Saved through offers', 'وفّرها الزبائن بالعروض')} value={data.offers.reduce((s, o) => s + o.saved, 0)} format={fmt} hint={tt(`${data.offers.length} offers`, `${data.offers.length} عرض`)} />
      </section>
      <Panel className="span-6" title={tt('Offers & sales', 'العروض والتخفيضات')} icon={<Percent size={16} />} action={<Link className="rc-link" href="/admin/promotions">{tt('Manage offers', 'إدارة العروض')} <ArrowRight size={13} /></Link>}><div className="dash-table-wrap" tabIndex={0}><table className="dash-table"><thead><tr><th>{tt('Offer', 'العرض')}</th><th className="num">{tt('Orders', 'الطلبات')}</th><th className="num">{tt('Units', 'القطع')}</th><th className="num">{tt('Revenue', 'الإيراد')}</th><th className="num">{tt('Saved by customers', 'وفّرها الزبائن')}</th></tr></thead>
          <tbody>{data.offers.map(o => <tr key={o.name}><td><b>{o.name}</b></td><td className="num">{o.orders}</td><td className="num">{o.units}</td><td className="num"><strong>{iqd(o.revenue)}</strong></td><td className="num">{iqd(o.saved)}</td></tr>)}{!data.offers.length && <tr><td colSpan={5} className="dash-muted">{tt('No delivered sales under an offer in this period.', 'لا توجد مبيعات مُسلّمة ضمن عرض بالفترة.')}</td></tr>}</tbody></table></div></Panel>
      <Panel className="span-6" title={tt('Coupon performance', 'أداء الكوبونات')} icon={<Tag size={16} />} delay={40} action={<Link className="rc-link" href="/admin/coupons">{tt('Manage coupons', 'إدارة الكوبونات')} <ArrowRight size={13} /></Link>}><div className="dash-table-wrap" tabIndex={0}><table className="dash-table"><thead><tr><th>{tt('Code', 'الكود')}</th><th className="num">{tt('Orders', 'الطلبات')}</th><th className="num">{tt('Discount given', 'الخصم الممنوح')}</th><th className="num">{tt('Revenue', 'الإيراد')}</th><th className="num">{tt('Avg order', 'متوسط الطلب')}</th><th className="num">{tt('Discount / revenue', 'الخصم ÷ الإيراد')}</th></tr></thead>
          <tbody>{data.coupons.map(c => <tr key={c.code}><td><b>{c.code === '—' ? tt('Manual discount', 'خصم يدوي') : c.code}</b></td><td className="num">{c.uses}</td><td className="num">{iqd(c.discount)}</td><td className="num">{iqd(c.revenue)}</td><td className="num">{iqd(c.aov)}</td><td className="num">{pct(c.revenue ? c.discount / c.revenue : 0, 1)}</td></tr>)}{!data.coupons.length && <tr><td colSpan={6} className="dash-muted">{tt('No discounts on delivered orders in this period.', 'لا توجد خصومات على طلبات مُسلّمة بالفترة.')}</td></tr>}</tbody></table></div></Panel>
    </div>}
  </main>;
}


function ProductsTable({ rows, lang, finance, category, showShare = false }: { rows: ReportsData['productTable']; lang: Lang; finance: boolean; category: (s: string) => string; showShare?: boolean }) {
  const tt = (en: string, ar: string) => lang === 'ar' ? ar : en;
  if (!rows.length) return <Empty>{tt('No delivered sales in this period.', 'لا توجد مبيعات مُسلّمة بالفترة.')}</Empty>;
  return <div className="dash-table-wrap" tabIndex={0}><table className="dash-table"><thead><tr><th>{tt('Product', 'المنتج')}</th><th className="num">{tt('Units', 'القطع')}</th><th className="num">{tt('Revenue', 'الإيراد')}</th>{finance && <><th className="num">{tt('Cost', 'التكلفة')}</th><th className="num">{tt('Profit', 'الربح')}</th><th>{tt('Margin', 'الهامش')}</th></>}{showShare && <th className="num">{tt('Share of profit', 'حصة من الربح')}</th>}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={r.id} style={{ animationDelay: `${i * 40}ms` }}><td><Link href={`/admin/products/${r.id}`} className="dash-product"><span className="dash-rank">{i + 1}</span>{r.image ? <img src={r.image} alt="" loading="lazy" /> : <span className="dash-thumb" />}<span><b>{lang === 'ar' ? r.nameAr : r.name}</b><small>{category(r.category)}</small></span></Link></td><td className="num">{r.units}</td><td className="num"><strong>{iqd(r.revenue)}</strong></td>{finance && <><td className="num">{iqd(r.cost)}</td><td className="num">{iqd(r.profit)}</td><td>{r.margin == null ? <span className="dash-muted">{tt('cost unknown', 'تكلفة غير معروفة')}</span> : <span className="dash-margin"><i style={{ width: `${Math.max(0, Math.min(100, r.margin * 100))}%` }} className={r.margin < 0.2 ? 'low' : ''} />{pct(r.margin)}</span>}</td></>}{showShare && <td className="num">{pct(r.profitShare)}</td>}</tr>)}</tbody></table></div>;
}
