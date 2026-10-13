'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { Bars, Card, CountUp, Delta, Donut, Heatmap, Kpi, PALETTE, TrendChart, ago, compact, fmt, iqd, pct, type Lang } from './dash-ui';
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, CalendarDays, CircleDollarSign, Clock, Coins, Flame, Layers, MapPin, MessageSquare, Package, PackageX, Plus, Receipt, RefreshCw, ShoppingBag, ShoppingCart, Sparkles, Truck, Users, Wallet } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { DashboardData } from '@/lib/dashboard-data';

const STATUS_AR: Record<string, string> = { pending: 'قيد الانتظار', confirmed: 'مؤكد', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي', returned: 'مرتجع' };
const STATUS_EN: Record<string, string> = { pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', returned: 'Returned' };
const SOURCE_AR: Record<string, string> = { website: 'الموقع', instagram: 'إنستغرام', whatsapp: 'واتساب', facebook: 'فيسبوك', phone: 'هاتف', store: 'المتجر', other: 'أخرى', tiktok: 'تيك توك' };
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
        <TrendChart labels={data.daily.map(d => d.key)} emptyText={tt('No delivered sales in this period yet.', 'لا توجد مبيعات مُسلّمة في هذه الفترة بعد.')} series={[
          { key: 'previous', label: tt('Previous period', 'الفترة السابقة'), values: data.daily.map(d => d.previousRevenue), color: '#a7aaa2', dashed: true },
          { key: 'revenue', label: tt('Revenue', 'الإيراد'), values: data.daily.map(d => d.revenue), color: '#cd4c20', area: true },
          ...(data.finance ? [{ key: 'profit', label: tt('Profit', 'الربح'), values: data.daily.map(d => d.profit), color: '#2f6b4f' }] : []),
        ]} extra={[{ label: tt('New orders', 'طلبات جديدة'), values: data.daily.map(d => d.orders) }]} />
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
      <Card delay={420} icon={<ShoppingBag size={17} />} title={tt('Sales by channel', 'المبيعات حسب القناة')}><Donut centerLabel={tt('sources', 'مصادر')} emptyText={tt('No data yet.', 'لا توجد بيانات بعد.')} rows={data.bySource.map(r => ({ key: r.key, label: lang === 'ar' ? SOURCE_AR[r.key] ?? r.key : r.key.replace(/^./, c => c.toUpperCase()), value: r.revenue, sub: `${r.orders} ${tt('orders', 'طلب')}` }))} /></Card>
      <Card delay={460} icon={<MapPin size={17} />} title={tt('Top governorates', 'أعلى المحافظات')} action={<span className="dash-muted">{tt(`${data.governoratesLive}/18 live`, `${data.governoratesLive}/18 مفعّلة`)}</span>}><Bars emptyText={tt('No data yet.', 'لا توجد بيانات بعد.')} color="linear-gradient(90deg,#3d5a80,#6f8db5)" rows={data.byGovernorate.map(r => ({ key: r.key, label: lang === 'ar' ? r.nameAr : r.nameEn, value: r.revenue, sub: String(r.orders) }))} /></Card>
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
