'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { Bars, Card, CountUp, Delta, Donut, Heatmap, Kpi, PALETTE, TrendChart, ago, compact, fmt, iqd, pct, type Lang } from './dash-ui';
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, CalendarDays, CircleDollarSign, Clock, Coins, Flame, Layers, MapPin, MessageSquare, Package, PackageX, Plus, Receipt, RefreshCw, ShoppingBag, ShoppingCart, Sparkles, Truck, Users, Wallet } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { GovernorateMap } from './governorate-map';
import { Breakdown, GlassBars, GlassCard, GlassLink, GlassSpark, Gauge, HeroChart, Num, PeriodSwitch, useGlassMotion } from './dash-glass';

/** Channels in UR orange shades, so the page keeps one colour. */
const GL_PALETTE = ['#ef7342', '#f39a6c', '#f6bd9c', '#d65a2a', '#fad8c4', '#b9481f', '#c9c9cc', '#e2e2e4'];
import type { DashboardData } from '@/lib/dashboard-data';

const STATUS_AR: Record<string, string> = { pending: 'قيد الانتظار', confirmed: 'مؤكد', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي', returned: 'مرتجع' };
const STATUS_EN: Record<string, string> = { pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', returned: 'Returned' };
const SOURCE_AR: Record<string, string> = { website: 'الموقع', instagram: 'إنستغرام', whatsapp: 'واتساب', facebook: 'فيسبوك', phone: 'هاتف', store: 'المتجر', other: 'أخرى', tiktok: 'تيك توك' };
export function DashboardView({ data, adminName }: { data: DashboardData; adminName?: string }) {
  const { language } = useLanguage();
  const router = useRouter();
  const lang: Lang = language === 'ar' ? 'ar' : 'en';
  const tt = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const status = (s: string) => (lang === 'ar' ? STATUS_AR : STATUS_EN)[s] ?? s;
  const m = data.money, p = data.moneyPrevious;
  const root = useRef<HTMLElement>(null);
  const [pending, setPending] = useState(false);
  useGlassMotion(root, `${data.period}-${data.fromDay}-${data.toDay}`);
  const self = data.period === 'custom' ? `/admin?from=${data.fromDay}&to=${data.toDay}` : `/admin?period=${data.period}`;
  const yesterday = new Date(Date.parse(`${data.today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const go = (from: string, to: string) => router.push(`/admin?from=${from}&to=${to}`, { scroll: false });
  const periods: [string, string][] = [['today', tt('Today', 'اليوم')], ['7d', tt('7 days', '7 أيام')], ['30d', tt('30 days', '30 يوم')], ['90d', tt('90 days', '90 يوم')], ['year', tt('This year', 'هذه السنة')]];
  const range = `${new Date(data.from).toLocaleDateString(lang === 'ar' ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Baghdad' })} – ${new Date(data.to).toLocaleDateString(lang === 'ar' ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Baghdad' })}`;
  const rangeText = data.fromDay === data.toDay ? new Date(data.from).toLocaleDateString(lang === 'ar' ? 'ar-IQ' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Baghdad' }) : range;
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

  const custom = data.period === 'custom';
  const periodItems = [
    { key: 'today', label: tt('Today', 'اليوم'), href: '/admin?period=today' },
    { key: 'yesterday', label: tt('Yesterday', 'أمس'), href: `/admin?from=${yesterday}&to=${yesterday}` },
    { key: '7d', label: tt('7D', '7 أيام'), href: '/admin?period=7d' },
    { key: '30d', label: tt('30D', '30 يوم'), href: '/admin?period=30d' },
    { key: '90d', label: tt('90D', '90 يوم'), href: '/admin?period=90d' },
    { key: 'year', label: tt('Year', 'السنة'), href: '/admin?period=year' },
  ];
  const isYesterday = custom && data.fromDay === yesterday && data.toDay === yesterday;
  const daily = data.daily;
  const avgDaily = daily.map(d => d.delivered ? d.revenue / d.delivered : 0);
  const cancelDaily = daily.map(d => d.orders ? (d.cancelled / d.orders) * 100 : 0);
  const iqdText = (n: number) => `${fmt(n)} ${tt('IQD', 'د.ع')}`;
  const pipeline = <GlassCard className="gl-pipeline" title={tt('Order pipeline', 'مسار الطلبات')} aside={<GlassLink href="/admin/orders">{tt('Orders', 'الطلبات')} <ArrowRight size={13} /></GlassLink>}>
    <ol className="gl-pipe">{data.pipeline.map(s => <li key={s.status}><Link href={`/admin/orders?status=${s.status}`}>
      <span className="gl-pipe-name">{status(s.status)}{s.orders > 0 && s.oldestHours > 24 && <small><Clock size={10} /> {tt(`${Math.round(s.oldestHours / 24)}d`, `${Math.round(s.oldestHours / 24)} يوم`)}</small>}</span>
      <span className="gl-pipe-track"><i className={`gl-hbar ${s.status === 'shipped' ? 'hot' : ''}`} style={{ width: `${Math.max(s.orders ? 6 : 0, (s.orders / pipelineMax) * 100)}%` }} /><b>{s.orders}</b></span>
      <span className="gl-pipe-val">{compact(s.value)}</span>
    </Link></li>)}</ol>
    <div className="gl-pipe-foot">
      <div><span>{tt('Expected revenue', 'إيراد متوقع')}</span><strong>{iqdText(data.expectedRevenue)}</strong>{data.finance && <small>{tt('profit', 'ربح')} {compact(data.expectedProfit)}</small>}</div>
      <div><span>{tt('To collect from couriers', 'بانتظار التحصيل')}</span><strong>{iqdText(data.toCollect)}</strong></div>
    </div>
  </GlassCard>;

  return <main ref={root} className={`admin-page dash gl-dash ${pending ? 'is-pending' : ''}`} data-period={data.period}>
    <header className="gl-top">
      <div className="gl-hello">
        <span className="gl-date"><i className="gl-live" />{rangeText}</span>
        <h1>{greeting}{adminName ? `${lang === 'ar' ? '، ' : ', '}${adminName}` : ''}</h1>
      </div>
      <div className="gl-top-actions">
        <PeriodSwitch items={periodItems} active={isYesterday ? 'yesterday' : data.period} custom={custom && !isYesterday} today={data.today} fromDay={data.fromDay} toDay={data.toDay} lang={lang} onPending={setPending} />
        <Link href="/admin/orders" className="gl-btn primary"><Plus size={16} /> {tt('Manual order', 'طلب يدوي')}</Link>
        <Link href={self} className="gl-btn icon" title={tt('Refresh', 'تحديث')} aria-label={tt('Refresh', 'تحديث')}><RefreshCw size={16} /></Link>
      </div>
    </header>

    {attention.length > 0 && <nav className="gl-attn" aria-label={tt('Needs attention', 'يحتاج انتباهك')}>{attention.map((a, i) => <Link key={i} href={a.href} className={`gl-attn-chip ${a.tone}`}>{a.icon}<span>{a.text}</span></Link>)}</nav>}

    <div className={`gl-row1 ${data.finance ? '' : 'no-finance'}`}>
      <GlassCard className="gl-hero">
        <div className="gl-hero-head">
          <span className="gl-label"><i />{tt('Product revenue', 'إيراد المنتجات')}</span>
          <div className="gl-big"><Num value={m.revenue} format="iqd" /><small>{tt('IQD', 'د.ع')}</small><Delta current={m.revenue} previous={p.revenue} lang={lang} /></div>
          <p className="gl-sub">{p.revenue ? tt(`vs ${compact(p.revenue)} in the previous period`, `مقابل ${compact(p.revenue)} بالفترة السابقة`) : tt('Delivered orders, delivery fees excluded', 'الطلبات المُسلّمة بدون أجور التوصيل')}{m.discounts ? tt(` · discounts ${compact(m.discounts)}`, ` · خصومات ${compact(m.discounts)}`) : ''}</p>
        </div>
        <HeroChart lang={lang} labels={daily.map(d => d.key)} emptyText={tt('No delivered sales in this period yet.', 'لا توجد مبيعات مُسلّمة في هذه الفترة بعد.')} tabs={[
          { key: 'revenue', label: tt('Revenue', 'الإيراد'), values: daily.map(d => d.revenue), compare: daily.map(d => d.previousRevenue), compareLabel: tt('previous', 'السابقة'), format: iqdText },
          ...(data.finance ? [{ key: 'profit', label: tt('Profit', 'الربح'), values: daily.map(d => d.profit), format: iqdText }] : []),
          { key: 'orders', label: tt('Orders', 'الطلبات'), values: daily.map(d => d.orders), second: { label: tt('delivered', 'مُسلّمة'), values: daily.map(d => d.delivered) }, format: (n: number) => `${fmt(n)} ${tt('orders', 'طلب')}` },
        ]} />
      </GlassCard>
      {data.finance ? <GlassCard className="gl-net">
        <span className="gl-label"><i />{tt('Net profit', 'صافي الربح')}</span>
        <div className="gl-big"><Num value={net} format="iqd" /><small>{tt('IQD', 'د.ع')}</small><Delta current={net} previous={netPrev} lang={lang} /></div>
        <Gauge value={m.margin} label={pct(m.margin, 1)} sub={tt('product margin', 'هامش ربح المنتجات')} />
        <Breakdown format={compact} rows={[
          { label: tt('Revenue', 'الإيراد'), value: m.revenue, kind: 'total' },
          { label: tt('Cost of goods', 'تكلفة البضاعة'), value: m.cogs + m.unknownCostRevenue, kind: 'minus' },
          { label: tt('Expenses', 'المصاريف'), value: data.expenses?.current ?? 0, kind: 'minus' },
          { label: tt('Net profit', 'صافي الربح'), value: net, kind: 'result' },
        ]} />
        {m.unknownCostUnits > 0 && <p className="gl-note">{tt(`${m.unknownCostUnits} units sold without a cost`, `${m.unknownCostUnits} قطعة مباعة بدون تكلفة`)}</p>}
      </GlassCard> : pipeline}
    </div>

    <section className="gl-tiles">
      <Link href="/admin/orders?status=delivered" className="gl-card gl-tile">
        <div className="gl-tile-top"><span className="gl-label">{tt('Delivered orders', 'طلبات مُسلّمة')}</span><span className="gl-ic"><Truck size={17} /></span></div>
        <div className="gl-tile-val"><Num value={m.orders} /><small>{tt('orders', 'طلب')}</small></div>
        <div className="gl-tile-foot"><span>{tt(`${fmt(m.units)} units`, `${fmt(m.units)} قطعة مباعة`)}</span><Delta current={m.orders} previous={p.orders} lang={lang} /></div>
        <GlassBars values={daily.map(d => d.delivered)} labels={daily.map(d => d.key)} />
      </Link>
      <div className="gl-card gl-tile">
        <div className="gl-tile-top"><span className="gl-label">{tt('Average order', 'متوسط الطلب')}</span><span className="gl-ic"><Receipt size={17} /></span></div>
        <div className="gl-tile-val"><Num value={m.averageOrder} format="compact" /><small>{tt('IQD', 'د.ع')}</small></div>
        <div className="gl-tile-foot"><span>{tt('Revenue ÷ delivered', 'الإيراد ÷ المُسلّمة')}</span><Delta current={m.averageOrder} previous={p.averageOrder} lang={lang} /></div>
        <GlassSpark values={avgDaily} />
      </div>
      <Link href="/admin/orders" className="gl-card gl-tile">
        <div className="gl-tile-top"><span className="gl-label">{tt('Orders placed', 'طلبات جديدة')}</span><span className="gl-ic"><ShoppingCart size={17} /></span></div>
        <div className="gl-tile-val"><Num value={data.placed.count} /><small>{tt('orders', 'طلب')}</small></div>
        <div className="gl-tile-foot"><span>{tt(`Worth ${compact(data.placed.value)}`, `بقيمة ${compact(data.placed.value)} د.ع`)}</span><Delta current={data.placed.count} previous={data.placed.previous} lang={lang} /></div>
        <GlassBars values={daily.map(d => d.orders)} labels={daily.map(d => d.key)} />
      </Link>
      <div className="gl-card gl-tile">
        <div className="gl-tile-top"><span className="gl-label">{tt('Cancellation rate', 'نسبة الإلغاء')}</span><span className="gl-ic"><PackageX size={17} /></span></div>
        <div className="gl-tile-val"><Num value={data.placed.cancelRate * 100} format="pct1" /></div>
        <div className="gl-tile-foot"><span>{tt(`Returns ${pct(data.placed.returnRate, 1)}`, `المرتجع ${pct(data.placed.returnRate, 1)}`)}</span><Delta current={data.placed.cancelRate} previous={data.placed.previousCancelRate} inverse lang={lang} /></div>
        <GlassSpark values={cancelDaily} />
      </div>
    </section>

    <div className="dash-grid three">
      {data.finance && pipeline}
      <Card icon={<ShoppingBag size={17} />} title={tt('Sales by channel', 'المبيعات حسب القناة')}><Donut palette={GL_PALETTE} centerLabel={tt('sources', 'مصادر')} emptyText={tt('No data yet.', 'لا توجد بيانات بعد.')} rows={data.bySource.map(r => ({ key: r.key, label: lang === 'ar' ? SOURCE_AR[r.key] ?? r.key : r.key.replace(/^./, c => c.toUpperCase()), value: r.revenue, sub: `${r.orders} ${tt('orders', 'طلب')}` }))} /></Card>
      <Card icon={<Clock size={17} />} title={tt('When orders come in', 'أوقات وصول الطلبات')}><Heatmap grid={data.heatmap} lang={lang} /></Card>
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
      <Card icon={<MapPin size={17} />} title={tt('Orders by governorate', 'طلبات المحافظات')} action={<span className="dash-muted">{tt(`${data.governoratesLive}/18 live`, `${data.governoratesLive}/18 مفعّلة`)}</span>}><GovernorateMap rows={data.governorateMap} lang={lang} /></Card>
    </div>

    <div className="dash-grid three">
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
