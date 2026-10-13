'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, CalendarDays, CircleDollarSign, Coins, LoaderCircle, Percent, Plus, Receipt, ShoppingBag, Tag, Trash2, TrendingUp, Truck, Wallet, Boxes } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import type { ReportsData } from '@/lib/reports-data';
import { Bars, Bridge, Card, Donut, Kpi, Legend, PageHero, PeriodNav, TrendChart, compact, fmt, iqd, pct, type Lang } from './dash-ui';

const SOURCE_AR: Record<string, string> = { website: 'الموقع', instagram: 'إنستغرام', whatsapp: 'واتساب', facebook: 'فيسبوك', phone: 'هاتف', store: 'المتجر', other: 'أخرى', tiktok: 'تيك توك' };
const EXPENSE: Record<string, [string, string]> = { marketing: ['Marketing', 'تسويق'], advertising: ['Advertising', 'إعلانات'], packaging: ['Packaging', 'تغليف'], salary: ['Salaries', 'رواتب'], rent: ['Rent', 'إيجار'], software: ['Software', 'برامج'], delivery: ['Delivery', 'توصيل'], photography: ['Photography', 'تصوير'], operations: ['Operations', 'تشغيل'], other: ['Other', 'أخرى'] };
const PAYMENT: Record<string, [string, string]> = { cash: ['Cash', 'نقد'], bank: ['Bank', 'بنك'], card: ['Card', 'بطاقة'], transfer: ['Transfer', 'حوالة'], other: ['Other', 'أخرى'] };
const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
function useLang() { const { language } = useLanguage(); const lang: Lang = language === 'ar' ? 'ar' : 'en'; return { lang, tt: (en: string, ar: string) => lang === 'ar' ? ar : en }; }
const range = (data: ReportsData, lang: Lang) => { const f = (iso: string) => new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Baghdad' }); return `${f(data.from)} – ${f(data.to)}`; };

export function RevenueView({ data, finance }: { data: ReportsData; finance: boolean }) {
  const { lang, tt } = useLang();
  const m = data.money, p = data.moneyPrevious;
  const labels = data.series.map(s => s.key);
  return <main className="admin-page dash">
    <PageHero eyebrow={<><CalendarDays size={13} /> {range(data, lang)}</>} title={tt('Revenue', 'الإيرادات')} description={tt('Product sales recognised on delivery. Delivery fees and cash handling are collected for couriers and kept apart from revenue.', 'مبيعات المنتجات المُحتسبة عند التسليم. أجور التوصيل ورسوم التحصيل تبقى منفصلة عن الإيراد.')}
      actions={<><PeriodNav base="/admin/revenue" period={data.period} lang={lang} /><div className="dash-quick">{finance && <Link href={`/admin/profit?period=${data.period}`} className="dash-btn">{tt('Profit', 'الأرباح')} <ArrowRight size={14} /></Link>}<Link href={`/admin/reports?period=${data.period}&section=sales`} className="dash-btn primary">{tt('Sales report', 'تقرير المبيعات')}</Link></div></>} />
    <section className="dash-kpis">
      <Kpi lang={lang} icon={<CircleDollarSign size={17} />} tone="accent" label={tt('Product revenue', 'إيراد المنتجات')} value={m.revenue} format={iqd} current={m.revenue} previous={p.revenue} spark={data.series.map(s => s.revenue)} />
      <Kpi lang={lang} delay={50} icon={<ShoppingBag size={17} />} tone="blue" label={tt('Gross sales', 'إجمالي المبيعات')} value={m.grossSales} format={iqd} current={m.grossSales} previous={p.grossSales} note={tt('Before discounts', 'قبل الخصومات')} />
      <Kpi lang={lang} delay={100} icon={<Tag size={17} />} tone="danger" inverse label={tt('Discounts', 'الخصومات')} value={m.discounts} format={iqd} current={m.discounts} previous={p.discounts} note={pct(m.grossSales ? m.discounts / m.grossSales : 0, 1)} />
      <Kpi lang={lang} delay={150} icon={<Receipt size={17} />} tone="gold" label={tt('Average order', 'متوسط الطلب')} value={m.averageOrder} format={iqd} current={m.averageOrder} previous={p.averageOrder} />
      <Kpi lang={lang} delay={200} icon={<Truck size={17} />} tone="violet" label={tt('Delivered orders', 'طلبات مُسلّمة')} value={m.orders} current={m.orders} previous={p.orders} note={tt(`${fmt(m.units)} units`, `${fmt(m.units)} قطعة`)} />
      <Kpi lang={lang} delay={250} icon={<Truck size={17} />} tone="success" label={tt('Delivery collected', 'أجور التوصيل المحصلة')} value={m.shipping} format={iqd} current={m.shipping} previous={p.shipping} note={m.codFees ? tt(`+ ${fmt(m.codFees)} cash handling`, `+ ${fmt(m.codFees)} رسوم تحصيل`) : tt('Not revenue', 'ليست إيراداً')} />
    </section>
    <div className="dash-grid main">
      <Card className="span-2" icon={<TrendingUp size={17} />} title={tt('Revenue by day', 'الإيراد اليومي')} action={<Legend items={[{ label: tt('Revenue', 'الإيراد'), color: '#cd4c20' }, { label: tt('Previous period', 'الفترة السابقة'), color: '#a7aaa2', dashed: true }]} />}>
        <TrendChart labels={labels} emptyText={tt('No delivered sales in this period.', 'لا توجد مبيعات مُسلّمة بالفترة.')} series={[{ key: 'prev', label: tt('Previous period', 'الفترة السابقة'), values: data.series.map(s => s.previousRevenue), color: '#a7aaa2', dashed: true }, { key: 'rev', label: tt('Revenue', 'الإيراد'), values: data.series.map(s => s.revenue), color: '#cd4c20', area: true }]} extra={[{ label: tt('Delivered orders', 'طلبات مُسلّمة'), values: data.series.map(s => s.delivered) }]} />
      </Card>
      <Card icon={<ShoppingBag size={17} />} title={tt('By channel', 'حسب القناة')}><Donut centerLabel={tt('channels', 'قنوات')} emptyText={tt('No sales.', 'لا توجد مبيعات.')} rows={data.bySource.map(r => ({ key: r.key, label: lang === 'ar' ? SOURCE_AR[r.key] ?? r.key : cap(r.key), value: r.revenue, sub: `${r.orders} · ${compact(r.revenue)}` }))} /></Card>
    </div>
    <Card icon={<Receipt size={17} />} title={tt('Sales ledger', 'سجل المبيعات')} action={<span className="dash-muted">{tt(`${data.deliveredList.length} delivered orders`, `${data.deliveredList.length} طلب مُسلّم`)}</span>}>
      <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>{tt('Order', 'الطلب')}</th><th>{tt('Customer', 'الزبون')}</th><th>{tt('Channel', 'القناة')}</th><th className="num">{tt('Units', 'القطع')}</th><th className="num">{tt('Discount', 'الخصم')}</th><th className="num">{tt('Product revenue', 'إيراد المنتجات')}</th><th className="num">{tt('Delivery', 'التوصيل')}</th><th className="num">{tt('Collected', 'المحصّل')}</th><th>{tt('Delivered', 'تاريخ التسليم')}</th></tr></thead>
        <tbody>{data.deliveredList.map(o => <tr key={o.id}><td><Link href={`/admin/orders/${o.id}`} className="admin-strong-link">{o.reference}</Link></td><td>{o.name}<small dir="ltr">{o.phone}</small></td><td>{lang === 'ar' ? SOURCE_AR[o.source] ?? o.source : cap(o.source)}</td><td className="num">{o.units}</td><td className="num">{o.discount ? `− ${fmt(o.discount)}` : '—'}</td><td className="num"><strong>{iqd(o.revenue)}</strong></td><td className="num">{fmt(o.shipping)}</td><td className="num">{iqd(o.total)}</td><td>{new Date(o.deliveredAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' })}</td></tr>)}{!data.deliveredList.length && <tr><td colSpan={9} className="dash-muted">{tt('No sales in this period.', 'لا توجد مبيعات بالفترة.')}</td></tr>}</tbody></table></div>
    </Card>
  </main>;
}

export function ProfitView({ data, expenses }: { data: ReportsData; expenses: { id: number; expenseDate: string; description: string; category: string; amountIqd: number }[] }) {
  const { lang, tt } = useLang();
  const m = data.money, p = data.moneyPrevious;
  const net = m.profit - data.expenses.current, netPrev = p.profit - data.expenses.previous;
  const labels = data.series.map(s => s.key);
  return <main className="admin-page dash">
    <PageHero eyebrow={<><CalendarDays size={13} /> {range(data, lang)}</>} title={tt('Profit', 'الأرباح')} description={tt('Gross profit uses the FIFO purchase cost saved on each sold unit; net profit subtracts operating expenses. Units with no purchase cost are reported apart instead of being given an invented cost.', 'إجمالي الربح يعتمد على تكلفة الشراء (أول داخل أول خارج) المحفوظة على كل قطعة مباعة، والصافي بعد طرح المصاريف. القطع بدون تكلفة تُعرض لحالها وما تنحسب بتكلفة وهمية.')}
      actions={<><PeriodNav base="/admin/profit" period={data.period} lang={lang} /><div className="dash-quick"><Link href={`/admin/finance?period=${data.period}`} className="dash-btn">{tt('Expenses', 'المصاريف')} <ArrowRight size={14} /></Link><Link href={`/admin/reports?period=${data.period}&section=profit`} className="dash-btn primary">{tt('Profit report', 'تقرير الأرباح')}</Link></div></>} />
    <section className="dash-kpis">
      <Kpi lang={lang} icon={<Wallet size={17} />} tone="success" label={tt('Gross profit', 'إجمالي الربح')} value={m.profit} format={iqd} current={m.profit} previous={p.profit} spark={data.series.map(s => s.profit)} />
      <Kpi lang={lang} delay={50} icon={<Percent size={17} />} tone="gold" label={tt('Gross margin', 'الهامش الإجمالي')} value={m.margin * 100} format={n => `${n.toFixed(1)}%`} current={m.margin} previous={p.margin} />
      <Kpi lang={lang} delay={100} icon={<Coins size={17} />} tone="danger" inverse label={tt('Cost of goods sold', 'تكلفة البضاعة المباعة')} value={m.cogs} format={iqd} current={m.cogs} previous={p.cogs} />
      <Kpi lang={lang} delay={150} icon={<Receipt size={17} />} tone="violet" inverse label={tt('Operating expenses', 'المصاريف التشغيلية')} value={data.expenses.current} format={iqd} current={data.expenses.current} previous={data.expenses.previous} />
      <Kpi lang={lang} delay={200} icon={<TrendingUp size={17} />} tone={net >= 0 ? 'success' : 'danger'} label={tt('Net profit', 'صافي الربح')} value={net} format={iqd} current={net} previous={netPrev} spark={data.series.map(s => s.net)} note={<>{tt('Net margin', 'الهامش الصافي')} <b>{pct(m.revenue ? net / m.revenue : 0, 1)}</b></>} />
      <Kpi lang={lang} delay={250} icon={<Boxes size={17} />} tone="blue" label={tt('Cost coverage', 'تغطية التكلفة')} value={m.units ? (m.knownCostUnits / m.units) * 100 : 100} format={n => `${n.toFixed(0)}%`} note={tt(`${fmt(m.unknownCostUnits)} units without cost`, `${fmt(m.unknownCostUnits)} قطعة بدون تكلفة`)} />
    </section>
    <Bridge steps={[{ label: tt('Revenue', 'الإيراد'), value: m.revenue }, { label: tt('COGS', 'تكلفة البضاعة'), value: m.cogs, op: '−' }, ...(m.unknownCostRevenue ? [{ label: tt('Unknown-cost revenue', 'إيراد بدون تكلفة'), value: m.unknownCostRevenue, op: '−' as const }] : []), { label: tt('Gross profit', 'إجمالي الربح'), value: m.profit, op: '=' }, { label: tt('Expenses', 'المصاريف'), value: data.expenses.current, op: '−' }, { label: tt('Net profit', 'صافي الربح'), value: net, op: '=', total: true }]} />
    <div className="dash-grid main">
      <Card className="span-2" icon={<TrendingUp size={17} />} title={tt('Profit over time', 'الربح عبر الوقت')} action={<Legend items={[{ label: tt('Gross profit', 'إجمالي الربح'), color: '#2f6b4f' }, { label: tt('Net', 'الصافي'), color: '#3d5a80' }]} />}>
        <TrendChart labels={labels} emptyText={tt('No delivered sales in this period.', 'لا توجد مبيعات مُسلّمة بالفترة.')} series={[{ key: 'gp', label: tt('Gross profit', 'إجمالي الربح'), values: data.series.map(s => s.profit), color: '#2f6b4f', area: true }, { key: 'net', label: tt('Net', 'الصافي'), values: data.series.map(s => s.net), color: '#3d5a80' }]} />
      </Card>
      <Card icon={<Receipt size={17} />} title={tt('Expenses by category', 'المصاريف حسب النوع')}><Bars emptyText={tt('No expenses.', 'لا توجد مصاريف.')} rows={data.expenses.byCategory.map(e => ({ key: e.key, label: EXPENSE[e.key]?.[lang === 'ar' ? 1 : 0] ?? e.key, value: e.value }))} color="linear-gradient(90deg,#7a5195,#a685c4)" /></Card>
    </div>
    <div className="dash-grid two">
      <Card icon={<Wallet size={17} />} title={tt('Most profitable products', 'أكثر المنتجات ربحاً')}><Bars emptyText="—" rows={[...data.productTable].filter(r => r.units).sort((a, b) => b.profit - a.profit).slice(0, 8).map(r => ({ key: r.id, label: lang === 'ar' ? r.nameAr : r.name, value: r.profit, sub: r.margin == null ? tt('cost unknown', 'تكلفة غير معروفة') : pct(r.margin) }))} color="linear-gradient(90deg,#2f6b4f,#5e9c7d)" /></Card>
      <Card icon={<Receipt size={17} />} title={tt('Operating expenses', 'المصاريف التشغيلية')} action={<Link href="/admin/finance" className="dash-link">{tt('Manage', 'إدارة')} <ArrowRight size={13} /></Link>}>
        <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>{tt('Date', 'التاريخ')}</th><th>{tt('Description', 'الوصف')}</th><th>{tt('Category', 'النوع')}</th><th className="num">{tt('Amount', 'المبلغ')}</th></tr></thead><tbody>{expenses.map(e => <tr key={e.id}><td>{new Date(e.expenseDate).toLocaleDateString('en-GB')}</td><td>{e.description}</td><td><span className="dash-chip">{EXPENSE[e.category]?.[lang === 'ar' ? 1 : 0] ?? e.category}</span></td><td className="num">{iqd(e.amountIqd)}</td></tr>)}{!expenses.length && <tr><td colSpan={4} className="dash-muted">{tt('No operating expenses in this period.', 'لا توجد مصاريف بالفترة.')}</td></tr>}</tbody></table></div>
      </Card>
    </div>
  </main>;
}

type ExpenseRow = { id: number; expenseDate: string; description: string; reference: string | null; category: string; paymentMethod: string; amountIqd: number };
export function FinanceView({ data, rows, purchases, canManage }: { data: ReportsData; rows: ExpenseRow[]; purchases: number; canManage: boolean }) {
  const { lang, tt } = useLang();
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const m = data.money;
  const net = m.profit - data.expenses.current;
  async function remove(row: ExpenseRow) {
    if (!window.confirm(tt(`Delete the expense “${row.description}”?`, `حذف المصروف «${row.description}»؟`))) return;
    setBusy(row.id);
    try { const r = await fetch(`/api/admin/expenses/${row.id}`, { method: 'DELETE' }); if (!r.ok) throw new Error(); router.refresh(); }
    catch { window.alert(tt('Could not delete the expense.', 'تعذر حذف المصروف.')); }
    finally { setBusy(null); }
  }
  return <main className="admin-page dash">
    <PageHero eyebrow={<><CalendarDays size={13} /> {range(data, lang)}</>} title={tt('Finance', 'المالية')} description={tt('Expenses, purchases and stock value next to sales and profit. Purchases are cash put into stock; they become cost only when the units are sold.', 'المصاريف والمشتريات وقيمة المخزون جنب المبيعات والأرباح. المشتريات فلوس داخلة بالمخزون، وتصير تكلفة بس من تنباع القطع.')}
      actions={<><PeriodNav base="/admin/finance" period={data.period} lang={lang} /><div className="dash-quick">{canManage && <a href="#add-expense" className="dash-btn primary"><Plus size={15} /> {tt('Add expense', 'إضافة مصروف')}</a>}<Link href={`/admin/reports?period=${data.period}&section=profit`} className="dash-btn">{tt('Reports', 'التقارير')} <ArrowRight size={14} /></Link></div></>} />
    <section className="dash-kpis">
      <Kpi lang={lang} icon={<CircleDollarSign size={17} />} tone="accent" label={tt('Product revenue', 'إيراد المنتجات')} value={m.revenue} format={iqd} current={m.revenue} previous={data.moneyPrevious.revenue} />
      <Kpi lang={lang} delay={50} icon={<Wallet size={17} />} tone="success" label={tt('Gross profit', 'إجمالي الربح')} value={m.profit} format={iqd} current={m.profit} previous={data.moneyPrevious.profit} />
      <Kpi lang={lang} delay={100} icon={<Receipt size={17} />} tone="violet" inverse label={tt('Operating expenses', 'المصاريف التشغيلية')} value={data.expenses.current} format={iqd} current={data.expenses.current} previous={data.expenses.previous} />
      <Kpi lang={lang} delay={150} icon={<TrendingUp size={17} />} tone={net >= 0 ? 'success' : 'danger'} label={tt('Net profit', 'صافي الربح')} value={net} format={iqd} />
      <Kpi lang={lang} delay={200} icon={<ShoppingBag size={17} />} tone="blue" label={tt('Stock purchased', 'مشتريات المخزون')} value={purchases} format={iqd} note={tt('Received in this period', 'المستلم بهذه الفترة')} />
      <Kpi lang={lang} delay={250} icon={<Boxes size={17} />} tone="gold" label={tt('Stock value (cost)', 'قيمة المخزون (تكلفة)')} value={data.inventory.knownValue} format={iqd} note={data.inventory.unknownCostUnits ? tt(`${fmt(data.inventory.unknownCostUnits)} units without cost`, `${fmt(data.inventory.unknownCostUnits)} قطعة بدون تكلفة`) : tt('Purchase cost basis', 'على أساس تكلفة الشراء')} />
    </section>
    <Bridge steps={[{ label: tt('Revenue', 'الإيراد'), value: m.revenue }, { label: tt('COGS', 'تكلفة البضاعة'), value: m.cogs, op: '−' }, ...(m.unknownCostRevenue ? [{ label: tt('Unknown-cost revenue', 'إيراد بدون تكلفة'), value: m.unknownCostRevenue, op: '−' as const }] : []), { label: tt('Gross profit', 'إجمالي الربح'), value: m.profit, op: '=' }, { label: tt('Expenses', 'المصاريف'), value: data.expenses.current, op: '−' }, { label: tt('Net profit', 'صافي الربح'), value: net, op: '=', total: true }]} />
    <div className="dash-grid main">
      <Card className="span-2" icon={<Receipt size={17} />} title={tt('Operating expenses', 'المصاريف التشغيلية')} action={<span className="dash-muted">{rows.length}</span>}>
        <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>{tt('Date', 'التاريخ')}</th><th>{tt('Description', 'الوصف')}</th><th>{tt('Category', 'النوع')}</th><th>{tt('Payment', 'الدفع')}</th><th className="num">{tt('Amount', 'المبلغ')}</th>{canManage && <th />}</tr></thead>
          <tbody>{rows.map(e => <tr key={e.id}><td>{new Date(e.expenseDate).toLocaleDateString('en-GB')}</td><td><b>{e.description}</b>{e.reference && <small>{e.reference}</small>}</td><td><span className="dash-chip">{EXPENSE[e.category]?.[lang === 'ar' ? 1 : 0] ?? e.category}</span></td><td>{PAYMENT[e.paymentMethod]?.[lang === 'ar' ? 1 : 0] ?? e.paymentMethod}</td><td className="num"><strong>{iqd(e.amountIqd)}</strong></td>{canManage && <td className="num"><button type="button" className="admin-btn admin-btn-danger-ghost admin-btn-sm" disabled={busy === e.id} onClick={() => void remove(e)} aria-label={tt('Delete', 'حذف')}>{busy === e.id ? <LoaderCircle size={13} className="spin" /> : <Trash2 size={13} />}</button></td>}</tr>)}{!rows.length && <tr><td colSpan={6} className="dash-muted">{tt('No expenses in this period.', 'لا توجد مصاريف بالفترة.')}</td></tr>}</tbody></table></div>
      </Card>
      <Card icon={<Receipt size={17} />} title={tt('By category', 'حسب النوع')}><Bars emptyText={tt('No expenses.', 'لا توجد مصاريف.')} rows={data.expenses.byCategory.map(e => ({ key: e.key, label: EXPENSE[e.key]?.[lang === 'ar' ? 1 : 0] ?? e.key, value: e.value, sub: pct(data.expenses.current ? e.value / data.expenses.current : 0) }))} color="linear-gradient(90deg,#7a5195,#a685c4)" /><p className="dash-foot">{tt('Delivery fees collected from customers are not revenue or profit.', 'أجور التوصيل المحصلة من الزبائن ليست إيراداً ولا ربحاً.')}</p></Card>
    </div>
    {canManage && <Card id="add-expense" icon={<Plus size={17} />} title={tt('Add expense', 'إضافة مصروف')}>
      <form className="admin-form-grid" action="/api/admin/expenses" method="post">
        <label>{tt('Description', 'الوصف')}<input name="description" required placeholder={tt('Meta ads, rent, packaging…', 'إعلانات ميتا، إيجار، تغليف…')} /></label>
        <label>{tt('Amount (IQD)', 'المبلغ (د.ع)')}<input name="amountIqd" type="number" min="1" required /></label>
        <label>{tt('Category', 'النوع')}<select name="category">{Object.entries(EXPENSE).map(([k, v]) => <option key={k} value={k}>{v[lang === 'ar' ? 1 : 0]}</option>)}</select></label>
        <label>{tt('Payment method', 'طريقة الدفع')}<select name="paymentMethod">{Object.entries(PAYMENT).map(([k, v]) => <option key={k} value={k}>{v[lang === 'ar' ? 1 : 0]}</option>)}</select></label>
        <label>{tt('Date', 'التاريخ')}<input name="expenseDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
        <label>{tt('Reference', 'المرجع')}<input name="reference" placeholder={tt('Invoice / receipt', 'فاتورة / وصل')} /></label>
        <label className="full">{tt('Notes', 'ملاحظات')}<textarea name="notes" rows={3} /></label>
        <div><button className="admin-btn admin-btn-primary" type="submit"><Plus size={15} /> {tt('Save expense', 'حفظ المصروف')}</button></div>
      </form>
    </Card>}
  </main>;
}
