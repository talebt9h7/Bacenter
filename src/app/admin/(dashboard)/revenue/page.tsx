import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { LANGUAGE_COOKIE, normalizeLanguage } from '@/lib/i18n';
import { requireAdminSection } from '@/lib/admin-auth';
import Link from 'next/link';
import { and, desc, gte, lte } from 'drizzle-orm';
import { ArrowRight, CircleDollarSign, ShoppingCart, Tag, Truck } from 'lucide-react';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { iqd, when } from '@/lib/format';

const liveStatuses = ['delivered'];
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
function range(period?: string) {
  const to = new Date(); to.setHours(23,59,59,999);
  const from = new Date();
  if (period === 'today') from.setHours(0,0,0,0);
  else if (period === '7d') { from.setDate(from.getDate()-6); from.setHours(0,0,0,0); }
  else if (period === '90d') { from.setDate(from.getDate()-89); from.setHours(0,0,0,0); }
  else if (period === 'year') { from.setMonth(0,1); from.setHours(0,0,0,0); }
  else { from.setDate(from.getDate()-29); from.setHours(0,0,0,0); }
  return { from, to };
}
const productGrossRevenue = (o: typeof orders.$inferSelect) => Array.isArray(o.items) ? (o.items as {unitPrice?:number;quantity?:number}[]).reduce((s,i)=>s+num(i.unitPrice)*num(i.quantity),0) : 0;
const productRevenue = (o: typeof orders.$inferSelect) => Math.max(0, productGrossRevenue(o) - num(o.discountCents));
const label = (v: string) => v ? v.replace(/^./, x => x.toUpperCase()) : '—';

export const metadata = { title: 'Revenue' };
export const dynamic = 'force-dynamic';

export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const actor = await requireAdminSection('finance', 'view');
  if (!actor) redirect('/admin');
  const { period='30d' } = await searchParams;
  const lang = normalizeLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value);
  const t=(en:string,ar:string)=>lang==='ar'?ar:en;
  const { from, to } = range(period);
  const rows = await db.select().from(orders).where(and(gte(orders.createdAt, from), lte(orders.createdAt, to))).orderBy(desc(orders.createdAt));
  const live = rows.filter(o => liveStatuses.includes(o.status));
  const revenue = live.reduce((s,o) => s + productRevenue(o), 0);
  const discounts = live.reduce((s,o) => s + num(o.discountCents), 0);
  const delivery = live.reduce((s,o) => s + num(o.shippingCents), 0);
  const units = live.reduce((s,o) => s + (Array.isArray(o.items) ? (o.items as {quantity?:number}[]).reduce((a,i)=>a+num(i.quantity),0) : 0), 0);
  const avg = live.length ? revenue / live.length : 0;
  const bySource = Object.entries(live.reduce<Record<string,{orders:number; revenue:number}>>((acc,o) => { const key=o.source||'website'; acc[key] ??= {orders:0,revenue:0}; acc[key].orders++; acc[key].revenue += productRevenue(o); return acc; },{})).sort((a,b)=>b[1].revenue-a[1].revenue);

  return <main className="admin-page">
    <div className="admin-page-heading"><div><span className="admin-eyebrow"><CircleDollarSign size={12}/> {t('Finance','المالية')}</span><h1>{t('Revenue','الإيرادات')}</h1><p>{t('Product sales revenue only. Delivery collections are shown separately.','إيرادات مبيعات المنتجات فقط. يتم عرض مبالغ التوصيل بشكل منفصل.')}</p></div><div className="admin-heading-actions"><Link href="/admin/profit" className="admin-btn admin-btn-ghost">{t('Profit','الأرباح')} <ArrowRight size={15}/></Link></div></div>
    <div className="admin-filter-bar">{[['today',t('Today','اليوم')],['7d',t('7 days','7 أيام')],['30d',t('30 days','30 يوماً')],['90d',t('90 days','90 يوماً')],['year',t('Year','السنة')]].map(([v,l])=><Link key={v} href={`?period=${v}`} className="admin-btn admin-btn-ghost">{l}</Link>)}</div>
    <div className="admin-stats"><div className="admin-stat"><CircleDollarSign size={20}/><strong>{iqd(revenue)}</strong><span>{t('Product revenue','إيرادات المنتجات')}</span></div><div className="admin-stat"><ShoppingCart size={20}/><strong>{live.length}</strong><span>{t('Orders','الطلبات')}</span></div><div className="admin-stat"><Tag size={20}/><strong>{iqd(discounts)}</strong><span>{t('Discounts','الخصومات')}</span></div><div className="admin-stat"><Truck size={20}/><strong>{iqd(delivery)}</strong><span>{t('Delivery collected','مبالغ التوصيل المحصلة')}</span></div></div>
    <div className="admin-grid-2"><section className="admin-card"><div className="admin-card-heading"><h2>{t('Revenue overview','ملخص الإيرادات')}</h2></div><table className="admin-table"><tbody><tr><td>Product revenue</td><td className="num">{iqd(revenue)}</td></tr><tr><td>{t('Units sold','الوحدات المباعة')}</td><td className="num">{units}</td></tr><tr><td>{t('Average product order','متوسط طلب المنتجات')}</td><td className="num">{iqd(avg)}</td></tr><tr><td>{t('Delivery collected','مبالغ التوصيل المحصلة')}</td><td className="num">{iqd(delivery)}</td></tr></tbody></table><p className="admin-footnote">{t('Revenue excludes delivery and excludes cancelled/returned orders.','الإيرادات لا تشمل التوصيل ولا الطلبات الملغاة أو المرتجعة.')}</p></section>
    <section className="admin-card"><div className="admin-card-heading"><h2>{t('Revenue by source','الإيرادات حسب المصدر')}</h2></div><table className="admin-table"><thead><tr><th>{t('Source','المصدر')}</th><th className="num">{t('Orders','الطلبات')}</th><th className="num">{t('Revenue','الإيرادات')}</th></tr></thead><tbody>{bySource.map(([source,v])=><tr key={source}><td>{label(source)}</td><td className="num">{v.orders}</td><td className="num">{iqd(v.revenue)}</td></tr>)}{!bySource.length&&<tr><td colSpan={3}>{t('No sales in this period.','لا توجد مبيعات في هذه الفترة.')}</td></tr>}</tbody></table></section></div>
    <section className="admin-card"><div className="admin-card-heading"><div><h2>{t('Sales','المبيعات')}</h2><p className="admin-card-subtitle">{t('Detailed orders included in revenue.','تفاصيل الطلبات المشمولة ضمن الإيرادات.')}</p></div><Link href="/admin/orders" className="admin-link">{t('Manage orders','إدارة الطلبات')} <ArrowRight size={14}/></Link></div><table className="admin-table"><thead><tr><th>{t('Reference','المرجع')}</th><th>{t('Customer','العميل')}</th><th>{t('Source','المصدر')}</th><th>Status</th><th className="num">{t('Products','المنتجات')}</th><th className="num">{t('Delivery','التوصيل')}</th><th>{t('Date','التاريخ')}</th></tr></thead><tbody>{live.slice(0,300).map(o=><tr key={o.id}><td>{o.reference}</td><td>{o.name}<br/><small>{o.phone}</small></td><td>{label(o.source||'website')}</td><td>{label(o.status)}</td><td className="num">{iqd(productRevenue(o))}</td><td className="num">{iqd(o.shippingCents)}</td><td>{when(o.createdAt)}</td></tr>)}{!live.length&&<tr><td colSpan={7}>{t('No sales in this period.','لا توجد مبيعات في هذه الفترة.')}</td></tr>}</tbody></table></section>
  </main>;
}
