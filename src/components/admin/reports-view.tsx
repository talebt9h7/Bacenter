'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, BarChart3, Boxes, CalendarDays, CircleDollarSign, Clock, Download, MapPin, Package, Percent, Printer, Receipt, ShoppingBag, ShoppingCart, Tag, TrendingUp, Truck, Users, Wallet, PackageX, Layers, Coins } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { ReportsData, ReportSection } from '@/lib/reports-data';
import { Bars, Bridge, Card, Columns, Donut, Empty, Heatmap, Kpi, Legend, PageHero, TrendChart, compact, fmt, iqd, pct, type Lang } from './dash-ui';

const STATUS: Record<string, [string, string]> = { pending: ['Pending', 'قيد الانتظار'], confirmed: ['Confirmed', 'مؤكد'], processing: ['Processing', 'قيد التجهيز'], shipped: ['Shipped', 'تم الشحن'], delivered: ['Delivered', 'تم التوصيل'], cancelled: ['Cancelled', 'ملغي'], returned: ['Returned', 'مرتجع'], placed: ['Placed', 'طلبات جديدة'] };
const SOURCE_AR: Record<string, string> = { website: 'الموقع', instagram: 'إنستغرام', whatsapp: 'واتساب', facebook: 'فيسبوك', phone: 'هاتف', store: 'المتجر', other: 'أخرى', tiktok: 'تيك توك' };
const CATEGORY_AR: Record<string, string> = { wallets: 'محافظ', backpacks: 'حقائب ظهر', bags: 'حقائب', 'crossbody-bags': 'حقائب كروس', 'tote-bags': 'حقائب توت', accessories: 'إكسسوارات', other: 'أخرى' };
const EXPENSE_AR: Record<string, string> = { marketing: 'تسويق', advertising: 'إعلانات', packaging: 'تغليف', salary: 'رواتب', rent: 'إيجار', software: 'برامج', delivery: 'توصيل', photography: 'تصوير', operations: 'تشغيل', other: 'أخرى' };
const WEEKDAYS: [string, string][] = [['Sun', 'الأحد'], ['Mon', 'الاثنين'], ['Tue', 'الثلاثاء'], ['Wed', 'الأربعاء'], ['Thu', 'الخميس'], ['Fri', 'الجمعة'], ['Sat', 'السبت']];
const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const tone = (s: string) => s === 'delivered' ? 'success' : s === 'cancelled' || s === 'returned' ? 'danger' : s === 'pending' ? 'warning' : 'info';

type SortKey = string;
function useSort<T extends Record<string, unknown>>(rows: T[], initial: SortKey) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: initial, dir: -1 });
  const sorted = useMemo(() => [...rows].sort((a, b) => { const x = a[sort.key], y = b[sort.key]; const xv = x == null ? -Infinity : x, yv = y == null ? -Infinity : y; return (xv > yv ? 1 : xv < yv ? -1 : 0) * sort.dir; }), [rows, sort]);
  const th = (key: SortKey, label: string, num = true) => <th className={`${num ? 'num ' : ''}sortable`} onClick={() => setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>{label}{sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}</th>;
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
  const labels = data.series.map(s => s.key);
  const periods: [string, string][] = [['today', tt('Today', 'اليوم')], ['7d', tt('7 days', '7 أيام')], ['30d', tt('30 days', '30 يوم')], ['90d', tt('90 days', '90 يوم')], ['year', tt('This year', 'هذه السنة')]];
  const exportHref = `/api/admin/reports/export?${qs}`;
  const net = m.profit - data.expenses.current, netPrev = p.profit - data.expenses.previous;
  const dateFmt = (iso: string) => new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Baghdad' });

  const revenueKpis = <>
    <Kpi lang={lang} delay={0} icon={<CircleDollarSign size={17} />} tone="accent" label={tt('Product revenue', 'إيراد المنتجات')} value={m.revenue} format={iqd} current={m.revenue} previous={p.revenue} spark={data.series.map(s => s.revenue)} note={tt(`Gross ${fmt(m.grossSales)} − discounts ${fmt(m.discounts)}`, `الإجمالي ${fmt(m.grossSales)} − خصومات ${fmt(m.discounts)}`)} />
    {finance && <Kpi lang={lang} delay={50} icon={<Wallet size={17} />} tone="success" label={tt('Product profit', 'ربح المنتجات')} value={m.profit} format={iqd} current={m.profit} previous={p.profit} spark={data.series.map(s => s.profit)} note={<>{tt('Margin', 'الهامش')} <b>{pct(m.margin, 1)}</b></>} />}
    <Kpi lang={lang} delay={100} icon={<Truck size={17} />} tone="blue" label={tt('Delivered orders', 'طلبات مُسلّمة')} value={m.orders} current={m.orders} previous={p.orders} spark={data.series.map(s => s.delivered)} note={tt(`${fmt(m.units)} units`, `${fmt(m.units)} قطعة`)} />
    <Kpi lang={lang} delay={150} icon={<Receipt size={17} />} tone="gold" label={tt('Average order', 'متوسط الطلب')} value={m.averageOrder} format={iqd} current={m.averageOrder} previous={p.averageOrder} note={tt(`${(m.orders ? m.units / m.orders : 0).toFixed(2)} units per order`, `${(m.orders ? m.units / m.orders : 0).toFixed(2)} قطعة لكل طلب`)} />
    <Kpi lang={lang} delay={200} icon={<ShoppingCart size={17} />} tone="violet" label={tt('Orders placed', 'طلبات جديدة')} value={data.placed.count} current={data.placed.count} previous={data.placed.previous} spark={data.series.map(s => s.placed)} note={tt(`${pct(data.placed.cancelRate, 1)} cancelled · ${pct(data.placed.returnRate, 1)} returned`, `${pct(data.placed.cancelRate, 1)} ملغي · ${pct(data.placed.returnRate, 1)} مرتجع`)} />
    <Kpi lang={lang} delay={250} icon={<Truck size={17} />} tone="danger" label={tt('Delivery collected', 'أجور التوصيل المحصلة')} value={m.shipping} format={iqd} current={m.shipping} previous={p.shipping} note={tt('Kept apart from revenue', 'منفصلة عن الإيراد')} />
  </>;

  const trend = (withProfit = finance) => <TrendChart labels={labels} emptyText={tt('No delivered sales in this period.', 'لا توجد مبيعات مُسلّمة في هذه الفترة.')} series={[
    { key: 'prev', label: tt('Previous period', 'الفترة السابقة'), values: data.series.map(s => s.previousRevenue), color: '#a7aaa2', dashed: true },
    { key: 'rev', label: tt('Revenue', 'الإيراد'), values: data.series.map(s => s.revenue), color: '#cd4c20', area: true },
    ...(withProfit ? [{ key: 'profit', label: tt('Profit', 'الربح'), values: data.series.map(s => s.profit), color: '#2f6b4f' }] : []),
  ]} extra={[{ label: tt('Delivered', 'مُسلّمة'), values: data.series.map(s => s.delivered) }, { label: tt('Placed', 'جديدة'), values: data.series.map(s => s.placed) }]} />;
  const trendLegend = <Legend items={[{ label: tt('Revenue', 'الإيراد'), color: '#cd4c20' }, ...(finance ? [{ label: tt('Profit', 'الربح'), color: '#2f6b4f' }] : []), { label: tt('Previous period', 'الفترة السابقة'), color: '#a7aaa2', dashed: true }]} />;

  const products = useSort(data.productTable.filter(r => r.units || r.onHand) as unknown as Record<string, unknown>[], 'revenue');
  const inventory = useSort(data.inventory.table as unknown as Record<string, unknown>[], 'daysLeft');
  const govs = useSort(data.governorates as unknown as Record<string, unknown>[], 'orders');

  return <main className="admin-page dash">
    <PageHero eyebrow={<><CalendarDays size={13} /> {dateFmt(data.from)} – {dateFmt(data.to)}</>} title={tt('Reports', 'التقارير')}
      description={tt('Sales, profit, products, stock, customers, orders and delivery for the selected period, compared with the period before. Money counts delivered orders on their delivery date; delivery fees are kept apart.', 'المبيعات والأرباح والمنتجات والمخزون والزبائن والطلبات والتوصيل للفترة المختارة، مقارنة بالفترة اللي قبلها. المبالغ تُحتسب للطلبات المُسلّمة بتاريخ التسليم، وأجور التوصيل منفصلة.')}
      actions={<>
        <nav className="dash-periods">{periods.map(([k, l]) => <Link key={k} href={`/admin/reports?period=${k}&section=${section}`} className={data.period === k ? 'active' : ''} scroll={false}>{l}</Link>)}</nav>
        <form className="rp-custom" method="get"><input type="hidden" name="section" value={section} /><label>{tt('From', 'من')}<input type="date" name="from" defaultValue={data.fromDay} /></label><label>{tt('To', 'إلى')}<input type="date" name="to" defaultValue={data.toDay} /></label><button className="dash-btn" type="submit">{tt('Apply', 'تطبيق')}</button></form>
        <div className="dash-quick">{finance && <a href={exportHref} className="dash-btn primary"><Download size={15} /> {tt('Export Excel', 'تصدير Excel')}</a>}<button type="button" className="dash-btn" onClick={() => window.print()}><Printer size={15} /> {tt('Print', 'طباعة')}</button></div>
      </>} />

    <nav className="dash-tabs">{tabs.map(([key, label, icon]) => <Link key={key} href={`/admin/reports?${qs}&section=${key}`} className={section === key ? 'active' : ''} scroll={false}>{icon}{label}</Link>)}</nav>

    {section === 'overview' && <>
      <section className="dash-kpis">{revenueKpis}</section>
      {finance && <Bridge steps={[
        { label: tt('Revenue', 'الإيراد'), value: m.revenue },
        { label: tt('Cost of goods sold', 'تكلفة البضاعة المباعة'), value: m.cogs, op: '−' },
        ...(m.unknownCostRevenue ? [{ label: tt('Revenue with unknown cost', 'إيراد بدون تكلفة معروفة'), value: m.unknownCostRevenue, op: '−' as const }] : []),
        { label: tt('Gross profit', 'إجمالي الربح'), value: m.profit, op: '=' },
        { label: tt('Operating expenses', 'المصاريف التشغيلية'), value: data.expenses.current, op: '−' },
        { label: <>{tt('Net profit', 'صافي الربح')} <span className={`dash-delta ${net >= netPrev ? 'up' : 'down'}`}>{netPrev ? `${net >= netPrev ? '+' : ''}${(((net - netPrev) / Math.abs(netPrev)) * 100).toFixed(0)}%` : '—'}</span></>, value: net, op: '=', total: true },
      ]} />}
      <div className="dash-grid main">
        <Card className="span-2" icon={<TrendingUp size={17} />} title={tt('Revenue trend', 'اتجاه الإيراد')} action={trendLegend}>{trend()}</Card>
        <Card icon={<Layers size={17} />} title={tt('Order outcomes', 'نتائج الطلبات')}>
          <Donut centerLabel={tt('orders', 'طلب')} emptyText={tt('No orders.', 'لا توجد طلبات.')} format={s => pct(s)} rows={Object.entries(data.statusCounts).filter(([, v]) => v).map(([k, v]) => ({ key: k, label: status(k), value: v, sub: `${v}` }))} />
          <div className="dash-mini" style={{ marginTop: 14 }}><div><strong>{data.avgDeliveryDays ? data.avgDeliveryDays.toFixed(1) : '—'}</strong><span>{tt('avg days to deliver', 'متوسط أيام التسليم')}</span></div><div><strong>{pct(data.placed.cancelRate, 1)}</strong><span>{tt('cancellation rate', 'نسبة الإلغاء')}</span></div></div>
        </Card>
      </div>
      <div className="dash-grid three">
        <Card icon={<ShoppingBag size={17} />} title={tt('Revenue by channel', 'الإيراد حسب القناة')}><Donut centerLabel={tt('channels', 'قنوات')} emptyText={tt('No sales.', 'لا توجد مبيعات.')} rows={data.bySource.map(r => ({ key: r.key, label: source(r.key), value: r.revenue, sub: `${r.orders} ${tt('orders', 'طلب')} · AOV ${compact(r.aov)}` }))} /></Card>
        <Card icon={<Package size={17} />} title={tt('Revenue by category', 'الإيراد حسب الصنف')}><Bars emptyText={tt('No sales.', 'لا توجد مبيعات.')} rows={data.categoryTable.map(c => ({ key: c.key, label: category(c.key), value: c.revenue, sub: `${c.units} ${tt('units', 'قطعة')}` }))} /></Card>
        <Card icon={<Users size={17} />} title={tt('Customers', 'الزبائن')}>
          <div className="dash-mini"><div><strong>{fmt(data.customers.buyers)}</strong><span>{tt('buyers', 'مشتري')}</span></div><div><strong>{fmt(data.customers.newInPeriod)}</strong><span>{tt('new customers', 'زبون جديد')}</span></div><div><strong>{data.customers.buyers ? pct(data.customers.returning / data.customers.buyers) : '0%'}</strong><span>{tt('returning', 'عائدون')}</span></div><div><strong>{compact(data.customers.revenuePerBuyer)}</strong><span>{tt('revenue / buyer', 'إيراد لكل مشتري')}</span></div></div>
          <h3 className="dash-sub">{tt('Revenue split', 'توزيع الإيراد')}</h3>
          <Bars emptyText="—" rows={[{ key: 'new', label: tt('New buyers', 'مشترون جدد'), value: data.customers.revenueNew }, { key: 'ret', label: tt('Returning', 'عائدون'), value: data.customers.revenueReturning }]} color="linear-gradient(90deg,#6d4c9a,#9a7cc4)" />
        </Card>
      </div>
      <Card icon={<Package size={17} />} title={tt('Top products', 'أفضل المنتجات')} action={<Link className="dash-link" href={`/admin/reports?${qs}&section=products`}>{tt('All products', 'كل المنتجات')} <ArrowRight size={13} /></Link>}>
        <ProductsTable rows={data.productTable.filter(r => r.units).slice(0, 8)} lang={lang} finance={finance} category={category} />
      </Card>
    </>}

    {section === 'sales' && <>
      <section className="dash-kpis">{revenueKpis}</section>
      <div className="dash-grid main">
        <Card className="span-2" icon={<TrendingUp size={17} />} title={tt('Revenue by day', 'الإيراد اليومي')} action={trendLegend}>{trend()}</Card>
        <Card icon={<ShoppingCart size={17} />} title={tt('Orders placed', 'الطلبات الجديدة')}><Columns labels={labels} values={data.series.map(s => s.placed)} emptyText={tt('No orders.', 'لا توجد طلبات.')} /><p className="dash-foot">{tt(`${data.placed.count} orders placed · ${data.series.reduce((s, x) => s + x.cancelled, 0)} cancelled`, `${data.placed.count} طلب جديد · ${data.series.reduce((s, x) => s + x.cancelled, 0)} ملغي`)}</p></Card>
      </div>
      <div className="dash-grid two">
        <Card icon={<ShoppingBag size={17} />} title={tt('Channels', 'القنوات')}>
          <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>{tt('Channel', 'القناة')}</th><th className="num">{tt('Orders', 'الطلبات')}</th><th className="num">{tt('Revenue', 'الإيراد')}</th><th className="num">{tt('Share', 'الحصة')}</th><th className="num">{tt('Avg order', 'متوسط الطلب')}</th>{finance && <th className="num">{tt('Profit', 'الربح')}</th>}</tr></thead>
            <tbody>{data.bySource.map(r => <tr key={r.key}><td><b>{source(r.key)}</b></td><td className="num">{r.orders}</td><td className="num"><strong>{iqd(r.revenue)}</strong></td><td className="num">{pct(r.revenue / (m.revenue || 1))}</td><td className="num">{iqd(r.aov)}</td>{finance && <td className="num">{iqd(r.profit)}</td>}</tr>)}{!data.bySource.length && <tr><td colSpan={6} className="dash-muted">{tt('No sales in this period.', 'لا توجد مبيعات بالفترة.')}</td></tr>}</tbody></table></div>
        </Card>
        <Card icon={<CalendarDays size={17} />} title={tt('Revenue by weekday', 'الإيراد حسب أيام الأسبوع')}><Bars emptyText={tt('No sales.', 'لا توجد مبيعات.')} rows={data.byWeekday.map(d => ({ key: String(d.day), label: WEEKDAYS[d.day][lang === 'ar' ? 1 : 0], value: d.revenue, sub: `${d.orders}` }))} color="linear-gradient(90deg,#c08a2b,#e0b45e)" /></Card>
      </div>
      <Card icon={<Clock size={17} />} title={tt('When orders are placed', 'أوقات وصول الطلبات')}><Heatmap grid={data.heatmap} lang={lang} /></Card>
    </>}

    {section === 'profit' && finance && <>
      <section className="dash-kpis">
        <Kpi lang={lang} icon={<Wallet size={17} />} tone="success" label={tt('Gross profit', 'إجمالي الربح')} value={m.profit} format={iqd} current={m.profit} previous={p.profit} spark={data.series.map(s => s.profit)} />
        <Kpi lang={lang} delay={50} icon={<Percent size={17} />} tone="gold" label={tt('Gross margin', 'الهامش الإجمالي')} value={m.margin * 100} format={n => `${n.toFixed(1)}%`} current={m.margin} previous={p.margin} note={tt('On sales with known cost', 'على المبيعات المعروفة التكلفة')} />
        <Kpi lang={lang} delay={100} icon={<Coins size={17} />} tone="danger" label={tt('Cost of goods sold', 'تكلفة البضاعة المباعة')} value={m.cogs} format={iqd} current={m.cogs} previous={p.cogs} inverse note={tt(`${fmt(m.knownCostUnits)} units with known cost`, `${fmt(m.knownCostUnits)} قطعة معروفة التكلفة`)} />
        <Kpi lang={lang} delay={150} icon={<Receipt size={17} />} tone="violet" label={tt('Operating expenses', 'المصاريف التشغيلية')} value={data.expenses.current} format={iqd} current={data.expenses.current} previous={data.expenses.previous} inverse />
        <Kpi lang={lang} delay={200} icon={<TrendingUp size={17} />} tone={net >= 0 ? 'success' : 'danger'} label={tt('Net profit', 'صافي الربح')} value={net} format={iqd} current={net} previous={netPrev} spark={data.series.map(s => s.net)} note={<>{tt('Net margin', 'الهامش الصافي')} <b>{pct(m.revenue ? net / m.revenue : 0, 1)}</b></>} />
        <Kpi lang={lang} delay={250} icon={<PackageX size={17} />} tone="blue" label={tt('Unknown-cost sales', 'مبيعات بدون تكلفة')} value={m.unknownCostRevenue} format={iqd} note={tt(`${fmt(m.unknownCostUnits)} units excluded from profit`, `${fmt(m.unknownCostUnits)} قطعة مستبعدة من الربح`)} />
      </section>
      <Bridge steps={[{ label: tt('Revenue', 'الإيراد'), value: m.revenue }, { label: tt('COGS', 'تكلفة البضاعة'), value: m.cogs, op: '−' }, ...(m.unknownCostRevenue ? [{ label: tt('Unknown-cost revenue', 'إيراد بدون تكلفة'), value: m.unknownCostRevenue, op: '−' as const }] : []), { label: tt('Gross profit', 'إجمالي الربح'), value: m.profit, op: '=' }, { label: tt('Expenses', 'المصاريف'), value: data.expenses.current, op: '−' }, { label: tt('Net profit', 'صافي الربح'), value: net, op: '=', total: true }]} />
      <div className="dash-grid main">
        <Card className="span-2" icon={<TrendingUp size={17} />} title={tt('Profit over time', 'الربح عبر الوقت')} action={<Legend items={[{ label: tt('Gross profit', 'إجمالي الربح'), color: '#2f6b4f' }, { label: tt('Net after expenses', 'الصافي بعد المصاريف'), color: '#3d5a80' }, { label: tt('COGS', 'تكلفة البضاعة'), color: '#c08a2b' }]} />}>
          <TrendChart labels={labels} emptyText={tt('No delivered sales in this period.', 'لا توجد مبيعات مُسلّمة بالفترة.')} series={[{ key: 'cogs', label: tt('COGS', 'تكلفة البضاعة'), values: data.series.map(s => s.cogs), color: '#c08a2b' }, { key: 'gp', label: tt('Gross profit', 'إجمالي الربح'), values: data.series.map(s => s.profit), color: '#2f6b4f', area: true }, { key: 'net', label: tt('Net', 'الصافي'), values: data.series.map(s => s.net), color: '#3d5a80' }]} />
        </Card>
        <Card icon={<Receipt size={17} />} title={tt('Expenses by category', 'المصاريف حسب النوع')} action={<Link className="dash-link" href="/admin/finance">{tt('Finance', 'المالية')} <ArrowRight size={13} /></Link>}><Bars emptyText={tt('No expenses in this period.', 'لا توجد مصاريف بالفترة.')} rows={data.expenses.byCategory.map(e => ({ key: e.key, label: lang === 'ar' ? EXPENSE_AR[e.key] ?? e.key : cap(e.key), value: e.value }))} color="linear-gradient(90deg,#7a5195,#a685c4)" /></Card>
      </div>
      <div className="dash-grid two">
        <Card icon={<Package size={17} />} title={tt('Profit by category', 'الربح حسب الصنف')}><Bars emptyText="—" rows={data.categoryTable.map(c => ({ key: c.key, label: category(c.key), value: c.profit, sub: c.margin == null ? '—' : pct(c.margin) }))} color="linear-gradient(90deg,#2f6b4f,#5e9c7d)" /></Card>
        <Card icon={<TrendingUp size={17} />} title={tt('Most profitable products', 'أكثر المنتجات ربحاً')}><Bars emptyText="—" rows={[...data.productTable].filter(r => r.units).sort((a, b) => b.profit - a.profit).slice(0, 8).map(r => ({ key: r.id, label: lang === 'ar' ? r.nameAr : r.name, value: r.profit, sub: r.margin == null ? tt('cost unknown', 'تكلفة غير معروفة') : pct(r.margin) }))} color="linear-gradient(90deg,#2f6b4f,#5e9c7d)" /></Card>
      </div>
      <Card icon={<Package size={17} />} title={tt('Profit by product', 'الربح حسب المنتج')}><ProductsTable rows={data.productTable.filter(r => r.units)} lang={lang} finance category={category} showShare /></Card>
    </>}

    {section === 'products' && <>
      <section className="dash-kpis" data-cols="4">
        <Kpi lang={lang} icon={<Package size={17} />} tone="accent" label={tt('Products sold', 'منتجات مباعة')} value={data.productTable.filter(r => r.units).length} note={tt(`of ${data.productTable.length} products`, `من ${data.productTable.length} منتج`)} />
        <Kpi lang={lang} delay={50} icon={<ShoppingBag size={17} />} tone="blue" label={tt('Units sold', 'القطع المباعة')} value={m.units} current={m.units} previous={p.units} />
        <Kpi lang={lang} delay={100} icon={<PackageX size={17} />} tone="danger" label={tt('Returned units', 'قطع مرتجعة')} value={data.productTable.reduce((s, r) => s + r.returnedUnits, 0)} inverse />
        <Kpi lang={lang} delay={150} icon={<Boxes size={17} />} tone="gold" label={tt('Not sold in period', 'لم تُبع بالفترة')} value={data.productTable.filter(r => !r.units && r.onHand > 0).length} note={tt('products with stock and no sales', 'منتجات عندها مخزون وبدون مبيعات')} />
      </section>
      <Card icon={<Package size={17} />} title={tt('Product performance', 'أداء المنتجات')} action={<span className="dash-muted">{tt('Click a column to sort', 'اضغط على العمود للترتيب')}</span>}>
        <div className="dash-table-wrap"><table className="dash-table"><thead><tr>{products.th('name', tt('Product', 'المنتج'), false)}{products.th('units', tt('Units', 'القطع'))}{products.th('orders', tt('Orders', 'الطلبات'))}{products.th('revenue', tt('Revenue', 'الإيراد'))}{finance && products.th('profit', tt('Profit', 'الربح'))}{finance && products.th('margin', tt('Margin', 'الهامش'))}{products.th('returnedUnits', tt('Returned', 'مرتجع'))}{products.th('available', tt('Available', 'متاح'))}{products.th('daysLeft', tt('Days of stock', 'أيام المخزون'))}{products.th('sellThrough', tt('Sell-through', 'نسبة التصريف'))}</tr></thead>
          <tbody>{(products.sorted as unknown as ReportsData['productTable']).map(r => <tr key={r.id}><td><Link href={`/admin/products/${r.id}`} className="dash-product">{r.image ? <img src={r.image} alt="" loading="lazy" /> : <span className="dash-thumb" />}<span><b>{lang === 'ar' ? r.nameAr : r.name}</b><small>{category(r.category)}{!r.published && ` · ${tt('draft', 'مسودة')}`}</small></span></Link></td><td className="num">{r.units}</td><td className="num">{r.orders}</td><td className="num"><strong>{iqd(r.revenue)}</strong></td>{finance && <td className="num">{iqd(r.profit)}</td>}{finance && <td className="num">{r.margin == null ? '—' : pct(r.margin)}</td>}<td className="num">{r.returnedUnits || '—'}</td><td className="num">{r.available}</td><td className="num">{r.daysLeft == null ? '—' : <span className={`dash-chip ${r.daysLeft <= 14 ? 'danger' : r.daysLeft <= 30 ? 'warning' : 'success'}`}>{r.daysLeft}</span>}</td><td className="num">{pct(r.sellThrough)}</td></tr>)}</tbody></table></div>
      </Card>
      <Card icon={<Layers size={17} />} title={tt('Top colours', 'أكثر الألوان مبيعاً')}>
        <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>{tt('Colour', 'اللون')}</th><th>{tt('Product', 'المنتج')}</th><th className="num">{tt('Units', 'القطع')}</th><th className="num">{tt('Revenue', 'الإيراد')}</th>{finance && <th className="num">{tt('Profit', 'الربح')}</th>}<th className="num">{tt('Available', 'متاح')}</th></tr></thead>
          <tbody>{data.variantTable.map(v => <tr key={v.id}><td><span className="dash-chip"><i style={{ width: 9, height: 9, borderRadius: '50%', background: v.hex, display: 'inline-block' }} />{lang === 'ar' ? v.colorAr : v.color}</span></td><td>{lang === 'ar' ? v.productAr : v.product}</td><td className="num">{v.units}</td><td className="num">{iqd(v.revenue)}</td>{finance && <td className="num">{iqd(v.profit)}</td>}<td className="num">{v.available}</td></tr>)}{!data.variantTable.length && <tr><td colSpan={6} className="dash-muted">{tt('No sales in this period.', 'لا توجد مبيعات بالفترة.')}</td></tr>}</tbody></table></div>
      </Card>
    </>}

    {section === 'inventory' && <>
      <section className="dash-kpis">
        <Kpi lang={lang} icon={<Boxes size={17} />} tone="accent" label={tt('Units on hand', 'القطع الموجودة')} value={data.inventory.onHand} note={tt(`${fmt(data.inventory.reserved)} reserved by pending orders`, `${fmt(data.inventory.reserved)} محجوزة لطلبات الانتظار`)} />
        <Kpi lang={lang} delay={50} icon={<Package size={17} />} tone="success" label={tt('Available to sell', 'متاح للبيع')} value={data.inventory.available} />
        {finance && <Kpi lang={lang} delay={100} icon={<Coins size={17} />} tone="gold" label={tt('Stock value (cost)', 'قيمة المخزون (تكلفة)')} value={data.inventory.knownValue} format={iqd} note={data.inventory.unknownCostUnits ? tt(`${fmt(data.inventory.unknownCostUnits)} units without cost`, `${fmt(data.inventory.unknownCostUnits)} قطعة بدون تكلفة`) : tt('All units have a cost', 'كل القطع معروفة التكلفة')} />}
        <Kpi lang={lang} delay={150} icon={<CircleDollarSign size={17} />} tone="blue" label={tt('Retail value', 'القيمة بسعر البيع')} value={data.inventory.retailValue} format={iqd} />
        <Kpi lang={lang} delay={200} icon={<PackageX size={17} />} tone="danger" label={tt('Sold out colours', 'ألوان نافدة')} value={data.inventory.soldOutCount} />
        <Kpi lang={lang} delay={250} icon={<Clock size={17} />} tone="violet" label={tt('Low stock colours', 'ألوان منخفضة')} value={data.inventory.lowCount} note={`≤ ${data.inventory.lowThreshold}`} />
      </section>
      <Card icon={<Boxes size={17} />} title={tt('Stock by colour', 'المخزون حسب اللون')} action={<Link className="dash-link" href="/admin/inventory">{tt('Manage inventory', 'إدارة المخزون')} <ArrowRight size={13} /></Link>}>
        <div className="dash-table-wrap"><table className="dash-table"><thead><tr>{inventory.th('product', tt('Product / colour', 'المنتج / اللون'), false)}{inventory.th('onHand', tt('On hand', 'موجود'))}{inventory.th('reserved', tt('Reserved', 'محجوز'))}{inventory.th('available', tt('Available', 'متاح'))}{inventory.th('perDay', tt('Sold / day', 'بيع يومي'))}{inventory.th('daysLeft', tt('Days left', 'أيام متبقية'))}{finance && inventory.th('costValue', tt('Cost value', 'قيمة التكلفة'))}{inventory.th('retailValue', tt('Retail value', 'قيمة البيع'))}</tr></thead>
          <tbody>{(inventory.sorted as unknown as ReportsData['inventory']['table']).map(v => <tr key={v.id}><td><b>{lang === 'ar' ? v.productAr : v.product}</b><small><i style={{ width: 8, height: 8, borderRadius: '50%', background: v.hex, display: 'inline-block', marginInlineEnd: 5 }} />{lang === 'ar' ? v.colorAr : v.color}</small></td><td className="num">{v.onHand}</td><td className="num">{v.reserved || '—'}</td><td className="num"><span className={`dash-chip ${v.available === 0 ? 'danger' : v.available <= data.inventory.lowThreshold ? 'warning' : 'success'}`}>{v.available}</span></td><td className="num">{v.perDay ? v.perDay.toFixed(1) : '—'}</td><td className="num">{v.daysLeft ?? '—'}</td>{finance && <td className="num">{iqd(v.costValue)}</td>}<td className="num">{iqd(v.retailValue)}</td></tr>)}</tbody></table></div>
      </Card>
      <div className="dash-grid two">
        <Card icon={<Layers size={17} />} title={tt('Stock movements in period', 'حركة المخزون بالفترة')}>
          {data.inventory.movements.length ? <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>{tt('Reason', 'السبب')}</th><th className="num">{tt('In', 'داخل')}</th><th className="num">{tt('Out', 'خارج')}</th></tr></thead><tbody>{data.inventory.movements.map(r => <tr key={r.reason}><td>{r.reason}</td><td className="num">{r.in ? <span className="dash-chip success">+{r.in}</span> : '—'}</td><td className="num">{r.out ? <span className="dash-chip danger">−{r.out}</span> : '—'}</td></tr>)}</tbody></table></div> : <Empty small>{tt('No stock movements in this period.', 'لا توجد حركة مخزون بالفترة.')}</Empty>}
        </Card>
        <Card icon={<Package size={17} />} title={tt('Purchase batches', 'وجبات الشراء')}>
          <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>{tt('Batch', 'الوجبة')}</th><th>{tt('Product', 'المنتج')}</th><th className="num">{tt('Received', 'المستلم')}</th><th className="num">{tt('Left', 'المتبقي')}</th>{finance && <th className="num">{tt('Unit cost', 'تكلفة القطعة')}</th>}</tr></thead><tbody>{data.inventory.batches.slice(0, 30).map(b => <tr key={b.id}><td><b>{b.batch}</b><small>{new Date(b.receivedAt).toLocaleDateString('en-GB')}</small></td><td>{lang === 'ar' ? b.productAr : b.product}<small>{b.color}</small></td><td className="num">{b.received}</td><td className="num">{b.remaining}</td>{finance && <td className="num">{b.cost == null ? '—' : iqd(b.cost)}</td>}</tr>)}{!data.inventory.batches.length && <tr><td colSpan={5} className="dash-muted">{tt('No batches yet.', 'لا توجد وجبات بعد.')}</td></tr>}</tbody></table></div>
        </Card>
      </div>
    </>}

    {section === 'customers' && <>
      <section className="dash-kpis">
        <Kpi lang={lang} icon={<Users size={17} />} tone="accent" label={tt('Buyers in period', 'مشترون بالفترة')} value={data.customers.buyers} />
        <Kpi lang={lang} delay={50} icon={<Users size={17} />} tone="success" label={tt('New customers', 'زبائن جدد')} value={data.customers.newInPeriod} />
        <Kpi lang={lang} delay={100} icon={<TrendingUp size={17} />} tone="blue" label={tt('Returning buyers', 'مشترون عائدون')} value={data.customers.buyers ? (data.customers.returning / data.customers.buyers) * 100 : 0} format={n => `${n.toFixed(0)}%`} note={tt(`${data.customers.returning} of ${data.customers.buyers}`, `${data.customers.returning} من ${data.customers.buyers}`)} />
        <Kpi lang={lang} delay={150} icon={<Receipt size={17} />} tone="gold" label={tt('Revenue per buyer', 'إيراد لكل مشتري')} value={data.customers.revenuePerBuyer} format={iqd} />
        <Kpi lang={lang} delay={200} icon={<Users size={17} />} tone="violet" label={tt('Repeat customers (all time)', 'زبائن متكررون (كل الوقت)')} value={data.customers.repeatAllTime} note={tt(`of ${fmt(data.customers.total)} customers`, `من ${fmt(data.customers.total)} زبون`)} />
        <Kpi lang={lang} delay={250} icon={<Clock size={17} />} tone="danger" label={tt('Inactive 90+ days', 'غير نشط 90+ يوم')} value={data.customers.inactive90} note={tt(`${data.customers.optIn} accept marketing`, `${data.customers.optIn} يقبلون التسويق`)} />
      </section>
      <div className="dash-grid main">
        <Card className="span-2" icon={<Users size={17} />} title={tt('Top customers in period', 'أفضل الزبائن بالفترة')} action={<Link className="dash-link" href="/admin/customers">CRM <ArrowRight size={13} /></Link>}>
          <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>{tt('Customer', 'الزبون')}</th><th>{tt('Governorate', 'المحافظة')}</th><th className="num">{tt('Orders', 'الطلبات')}</th><th className="num">{tt('Delivered', 'مُسلّم')}</th><th className="num">{tt('Cancelled', 'ملغي')}</th><th className="num">{tt('Value', 'القيمة')}</th><th>{tt('Last order', 'آخر طلب')}</th></tr></thead>
            <tbody>{data.topBuyers.map(c => <tr key={c.phone}><td><Link href={`/admin/customers?q=${encodeURIComponent(c.phone)}`} className="dash-product"><span><b>{c.name}</b><small dir="ltr">{c.phone}</small></span></Link></td><td>{lang === 'ar' ? c.governorateName.ar : c.governorateName.en}</td><td className="num">{c.orders}</td><td className="num">{c.delivered}</td><td className="num">{c.cancelled ? <span className="dash-chip danger">{c.cancelled}</span> : '—'}</td><td className="num"><strong>{iqd(c.revenue)}</strong></td><td>{new Date(c.last).toLocaleDateString('en-GB')}</td></tr>)}{!data.topBuyers.length && <tr><td colSpan={7} className="dash-muted">{tt('No orders in this period.', 'لا توجد طلبات بالفترة.')}</td></tr>}</tbody></table></div>
        </Card>
        <Card icon={<TrendingUp size={17} />} title={tt('New vs returning', 'جدد مقابل عائدين')}>
          <Donut centerLabel={tt('groups', 'فئات')} emptyText={tt('No sales.', 'لا توجد مبيعات.')} rows={[{ key: 'new', label: tt('New buyers', 'مشترون جدد'), value: data.customers.revenueNew, sub: iqd(data.customers.revenueNew) }, { key: 'ret', label: tt('Returning buyers', 'مشترون عائدون'), value: data.customers.revenueReturning, sub: iqd(data.customers.revenueReturning) }]} />
        </Card>
      </div>
    </>}

    {section === 'orders' && <>
      <section className="dash-kpis">
        <Kpi lang={lang} icon={<ShoppingCart size={17} />} tone="accent" label={tt('Orders placed', 'طلبات جديدة')} value={data.placed.count} current={data.placed.count} previous={data.placed.previous} spark={data.series.map(s => s.placed)} />
        <Kpi lang={lang} delay={50} icon={<Truck size={17} />} tone="success" label={tt('Delivery success', 'نسبة التسليم')} value={data.placed.count ? (data.statusCounts.delivered / data.placed.count) * 100 : 0} format={n => `${n.toFixed(1)}%`} note={tt(`${data.statusCounts.delivered} delivered`, `${data.statusCounts.delivered} مُسلّم`)} />
        <Kpi lang={lang} delay={100} icon={<PackageX size={17} />} tone="danger" inverse label={tt('Cancellation rate', 'نسبة الإلغاء')} value={data.placed.cancelRate * 100} format={n => `${n.toFixed(1)}%`} current={data.placed.cancelRate} previous={data.placed.previousCancelRate} />
        <Kpi lang={lang} delay={150} icon={<PackageX size={17} />} tone="gold" label={tt('Return rate', 'نسبة المرتجع')} value={data.placed.returnRate * 100} format={n => `${n.toFixed(1)}%`} />
        <Kpi lang={lang} delay={200} icon={<Clock size={17} />} tone="blue" label={tt('Avg days to deliver', 'متوسط أيام التسليم')} value={data.avgDeliveryDays} format={n => n.toFixed(1)} />
        <Kpi lang={lang} delay={250} icon={<Layers size={17} />} tone="violet" label={tt('Still open', 'طلبات مفتوحة')} value={data.statusCounts.pending + data.statusCounts.confirmed + data.statusCounts.processing + data.statusCounts.shipped} note={tt('pending → shipped', 'انتظار ← شحن')} />
      </section>
      <div className="dash-grid two">
        <Card icon={<Layers size={17} />} title={tt('Fulfilment funnel', 'مسار تنفيذ الطلبات')}>
          <ul className="dash-funnel">{data.funnel.map((f, i) => <li key={f.key}><span>{status(f.key)}</span><b style={{ width: `${(f.count / (data.funnel[0].count || 1)) * 100}%`, animationDelay: `${i * 90}ms` }} /><span><strong>{f.count}</strong><small>{pct(f.count / (data.funnel[0].count || 1))}</small></span></li>)}</ul>
        </Card>
        <Card icon={<ShoppingCart size={17} />} title={tt('Orders per day', 'الطلبات يومياً')}><Columns labels={labels} values={data.series.map(s => s.placed)} emptyText={tt('No orders.', 'لا توجد طلبات.')} /></Card>
      </div>
      <Card icon={<ShoppingCart size={17} />} title={tt('Orders in period', 'طلبات الفترة')} action={<Link className="dash-link" href="/admin/orders">{tt('Manage orders', 'إدارة الطلبات')} <ArrowRight size={13} /></Link>}>
        <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>{tt('Order', 'الطلب')}</th><th>{tt('Customer', 'الزبون')}</th><th>{tt('Channel', 'القناة')}</th><th>{tt('Status', 'الحالة')}</th><th className="num">{tt('Units', 'القطع')}</th><th className="num">{tt('Products', 'المنتجات')}</th>{finance && <th className="num">{tt('Profit', 'الربح')}</th>}<th className="num">{tt('Delivery', 'التوصيل')}</th><th>{tt('Placed', 'التاريخ')}</th></tr></thead>
          <tbody>{data.ordersList.map(o => <tr key={o.id}><td><Link href={`/admin/orders/${o.id}`} className="admin-strong-link">{o.reference}</Link></td><td>{o.name}<small dir="ltr">{o.phone}</small></td><td>{source(o.source)}</td><td><span className={`dash-chip ${tone(o.status)}`}>{status(o.status)}</span></td><td className="num">{o.units}</td><td className="num">{iqd(o.revenue)}</td>{finance && <td className="num">{o.profit == null ? '—' : iqd(o.profit)}</td>}<td className="num">{iqd(o.shipping)}</td><td>{new Date(o.createdAt).toLocaleDateString('en-GB')}</td></tr>)}{!data.ordersList.length && <tr><td colSpan={9} className="dash-muted">{tt('No orders in this period.', 'لا توجد طلبات بالفترة.')}</td></tr>}</tbody></table></div>
      </Card>
    </>}

    {section === 'delivery' && <>
      <section className="dash-kpis" data-cols="4">
        <Kpi lang={lang} icon={<MapPin size={17} />} tone="accent" label={tt('Governorates with orders', 'محافظات فيها طلبات')} value={data.governorates.length} />
        <Kpi lang={lang} delay={50} icon={<Truck size={17} />} tone="success" label={tt('Delivery collected', 'أجور التوصيل المحصلة')} value={m.shipping} format={iqd} current={m.shipping} previous={p.shipping} />
        <Kpi lang={lang} delay={100} icon={<Clock size={17} />} tone="blue" label={tt('Avg days to deliver', 'متوسط أيام التسليم')} value={data.avgDeliveryDays} format={n => n.toFixed(1)} />
        <Kpi lang={lang} delay={150} icon={<PackageX size={17} />} tone="danger" label={tt('Returned in transit', 'مرتجع من الشحن')} value={data.statusCounts.returned} inverse />
      </section>
      <div className="dash-grid main">
        <Card className="span-2" icon={<MapPin size={17} />} title={tt('Delivery by governorate', 'التوصيل حسب المحافظة')} action={<Link className="dash-link" href="/admin/shipping">{tt('Delivery settings', 'إعدادات التوصيل')} <ArrowRight size={13} /></Link>}>
          <div className="dash-table-wrap"><table className="dash-table"><thead><tr>{govs.th('nameEn', tt('Governorate', 'المحافظة'), false)}{govs.th('orders', tt('Orders', 'الطلبات'))}{govs.th('successRate', tt('Delivered', 'تسليم'))}{govs.th('cancelRate', tt('Cancelled', 'إلغاء'))}{govs.th('returnRate', tt('Returned', 'مرتجع'))}{govs.th('avgDays', tt('Avg days', 'متوسط الأيام'))}<th className="num">{tt('Promised', 'الموعود')}</th>{govs.th('revenue', tt('Revenue', 'الإيراد'))}{govs.th('shipping', tt('Delivery fees', 'أجور التوصيل'))}</tr></thead>
            <tbody>{(govs.sorted as unknown as ReportsData['governorates']).map(g => <tr key={g.code}><td><b>{lang === 'ar' ? g.nameAr : g.nameEn}</b></td><td className="num">{g.orders}</td><td className="num"><span className={`dash-chip ${g.successRate >= 0.8 ? 'success' : g.successRate >= 0.6 ? 'warning' : 'danger'}`}>{pct(g.successRate)}</span></td><td className="num">{pct(g.cancelRate)}</td><td className="num">{pct(g.returnRate)}</td><td className="num">{g.avgDays == null ? '—' : g.avgDays.toFixed(1)}</td><td className="num">{g.promised}</td><td className="num">{iqd(g.revenue)}</td><td className="num">{iqd(g.shipping)}</td></tr>)}{!data.governorates.length && <tr><td colSpan={9} className="dash-muted">{tt('No orders in this period.', 'لا توجد طلبات بالفترة.')}</td></tr>}</tbody></table></div>
        </Card>
        <Card icon={<MapPin size={17} />} title={tt('Orders by governorate', 'الطلبات حسب المحافظة')}><Bars emptyText="—" rows={data.governorates.slice(0, 10).map(g => ({ key: g.code, label: lang === 'ar' ? g.nameAr : g.nameEn, value: g.orders, sub: pct(g.successRate) }))} format={fmt} color="linear-gradient(90deg,#3d5a80,#6f8db5)" /></Card>
      </div>
    </>}

    {section === 'discounts' && <>
      <section className="dash-kpis" data-cols="4">
        <Kpi lang={lang} icon={<Tag size={17} />} tone="accent" label={tt('Total discounts', 'إجمالي الخصومات')} value={m.discounts} format={iqd} current={m.discounts} previous={p.discounts} inverse />
        <Kpi lang={lang} delay={50} icon={<Percent size={17} />} tone="gold" label={tt('Discount rate', 'نسبة الخصم')} value={m.grossSales ? (m.discounts / m.grossSales) * 100 : 0} format={n => `${n.toFixed(1)}%`} note={tt('of gross sales', 'من إجمالي المبيعات')} />
        <Kpi lang={lang} delay={100} icon={<Receipt size={17} />} tone="blue" label={tt('Orders with a discount', 'طلبات عليها خصم')} value={data.discountedOrders} note={tt(`of ${m.orders} delivered`, `من ${m.orders} مُسلّم`)} />
        <Kpi lang={lang} delay={150} icon={<Tag size={17} />} tone="violet" label={tt('Saved through offers', 'وفّرها الزبائن بالعروض')} value={data.offers.reduce((s, o) => s + o.saved, 0)} format={iqd} note={tt(`${data.offers.length} offers with sales`, `${data.offers.length} عرض عليه مبيعات`)} />
      </section>
      <Card icon={<Percent size={17} />} title={tt('Offers & sales', 'العروض والتخفيضات')} action={<Link className="dash-link" href="/admin/promotions">{tt('Manage offers', 'إدارة العروض')} <ArrowRight size={13} /></Link>}>
        <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>{tt('Offer', 'العرض')}</th><th className="num">{tt('Orders', 'الطلبات')}</th><th className="num">{tt('Units', 'القطع')}</th><th className="num">{tt('Revenue', 'الإيراد')}</th><th className="num">{tt('Saved by customers', 'وفّرها الزبائن')}</th></tr></thead>
          <tbody>{data.offers.map(o => <tr key={o.name}><td><b>{o.name}</b></td><td className="num">{o.orders}</td><td className="num">{o.units}</td><td className="num"><strong>{iqd(o.revenue)}</strong></td><td className="num">{iqd(o.saved)}</td></tr>)}{!data.offers.length && <tr><td colSpan={5} className="dash-muted">{tt('No delivered sales under an offer in this period.', 'لا توجد مبيعات مُسلّمة ضمن عرض بالفترة.')}</td></tr>}</tbody></table></div>
      </Card>
      <Card icon={<Tag size={17} />} title={tt('Coupon performance', 'أداء الكوبونات')} action={<Link className="dash-link" href="/admin/coupons">{tt('Manage coupons', 'إدارة الكوبونات')} <ArrowRight size={13} /></Link>}>
        <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>{tt('Code', 'الكود')}</th><th className="num">{tt('Orders', 'الطلبات')}</th><th className="num">{tt('Discount given', 'الخصم الممنوح')}</th><th className="num">{tt('Revenue', 'الإيراد')}</th><th className="num">{tt('Avg order', 'متوسط الطلب')}</th><th className="num">{tt('Discount / revenue', 'الخصم ÷ الإيراد')}</th></tr></thead>
          <tbody>{data.coupons.map(c => <tr key={c.code}><td><b>{c.code === '—' ? tt('Manual discount', 'خصم يدوي') : c.code}</b></td><td className="num">{c.uses}</td><td className="num">{iqd(c.discount)}</td><td className="num">{iqd(c.revenue)}</td><td className="num">{iqd(c.aov)}</td><td className="num">{pct(c.revenue ? c.discount / c.revenue : 0, 1)}</td></tr>)}{!data.coupons.length && <tr><td colSpan={6} className="dash-muted">{tt('No discounts on delivered orders in this period.', 'لا توجد خصومات على طلبات مُسلّمة بالفترة.')}</td></tr>}</tbody></table></div>
      </Card>
    </>}

    <p className="dash-generated">{tt('Compared with', 'مقارنة مع')} {dateFmt(data.previousFrom)} – {dateFmt(data.previousTo)}</p>
  </main>;
}

function ProductsTable({ rows, lang, finance, category, showShare = false }: { rows: ReportsData['productTable']; lang: Lang; finance: boolean; category: (s: string) => string; showShare?: boolean }) {
  const tt = (en: string, ar: string) => lang === 'ar' ? ar : en;
  if (!rows.length) return <Empty>{tt('No delivered sales in this period.', 'لا توجد مبيعات مُسلّمة بالفترة.')}</Empty>;
  return <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>{tt('Product', 'المنتج')}</th><th className="num">{tt('Units', 'القطع')}</th><th className="num">{tt('Revenue', 'الإيراد')}</th>{finance && <><th className="num">{tt('Cost', 'التكلفة')}</th><th className="num">{tt('Profit', 'الربح')}</th><th>{tt('Margin', 'الهامش')}</th></>}{showShare && <th className="num">{tt('Share of profit', 'حصة من الربح')}</th>}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={r.id} style={{ animationDelay: `${i * 40}ms` }}><td><Link href={`/admin/products/${r.id}`} className="dash-product"><span className="dash-rank">{i + 1}</span>{r.image ? <img src={r.image} alt="" loading="lazy" /> : <span className="dash-thumb" />}<span><b>{lang === 'ar' ? r.nameAr : r.name}</b><small>{category(r.category)}</small></span></Link></td><td className="num">{r.units}</td><td className="num"><strong>{iqd(r.revenue)}</strong></td>{finance && <><td className="num">{iqd(r.cost)}</td><td className="num">{iqd(r.profit)}</td><td>{r.margin == null ? <span className="dash-muted">{tt('cost unknown', 'تكلفة غير معروفة')}</span> : <span className="dash-margin"><i style={{ width: `${Math.max(0, Math.min(100, r.margin * 100))}%` }} className={r.margin < 0.2 ? 'low' : ''} />{pct(r.margin)}</span>}</td></>}{showShare && <td className="num">{pct(r.profitShare)}</td>}</tr>)}</tbody></table></div>;
}
