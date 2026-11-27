'use client';

/** Reports → orders report: how many orders came in over the chosen dates, from where, and what each one earns. */
import { useState } from 'react';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import type { ReportsData } from '@/lib/reports-data';
import { Num } from './dash-glass';

const SOURCE_AR: Record<string, string> = { website: 'الموقع', instagram: 'إنستغرام', whatsapp: 'واتساب', facebook: 'فيسبوك', phone: 'هاتف', store: 'المتجر', other: 'أخرى', tiktok: 'تيك توك', manual: 'يدوي', wholesale: 'جملة' };
const STATUS_AR: Record<string, string> = { pending: 'قيد الانتظار', confirmed: 'مؤكد', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي', returned: 'مرتجع' };
const num = (n: number) => Math.round(n).toLocaleString('en-US');
const when = (iso: string, single: boolean) => { const d = new Date(new Date(iso).getTime() + 3 * 3600_000); const t = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; return single ? t : `${d.getUTCDate()}/${d.getUTCMonth() + 1} · ${t}`; };

export function OrdersReport({ report, finance, rangeLabel, singleDay }: { report: ReportsData['ordersReport']; finance: boolean; rangeLabel: string; singleDay: boolean }) {
  const [source, setSource] = useState<string | null>(null);
  const rows = source ? report.rows.filter(r => r.source === source) : report.rows;
  const shown = source ? report.bySource.find(s => s.key === source) : null;
  const total = { orders: shown?.orders ?? report.count, revenue: shown?.revenue ?? report.revenue, profit: shown?.profit ?? report.profit };
  return <div className="nq-card or-card">
    <div className="nq-head"><div className="nq-head-title"><div className="nq-tile brown"><ClipboardList size={20} /></div><div><h3>تقرير الطلبات</h3><p>{`كل الطلبات المسجّلة خلال ${rangeLabel}، مصدرها وربح كل طلب`}</p></div></div></div>

    <div className="or-kpis">
      <div className="or-kpi"><span>عدد الطلبات</span><b><Num value={report.count} /></b><small>{report.active} فعّال · {report.lost} ملغي/مرتجع</small></div>
      <div className="or-kpi"><span>قيمة المنتجات</span><b><Num value={report.revenue} format="iqd" /> <small>د.ع</small></b><small>بدون أجور التوصيل</small></div>
      {finance && <div className="or-kpi hi"><span>مجموع أرباح الطلبات</span><b><Num value={report.profit} format="iqd" /> <small>د.ع</small></b><small>{num(report.realisedProfit)} د.ع منها من طلبات مُسلّمة</small></div>}
      <div className="or-kpi"><span>متوسط الطلب</span><b><Num value={report.active ? report.revenue / report.active : 0} format="iqd" /> <small>د.ع</small></b><small>{finance && report.active ? `ربح ${num(report.profit / report.active)} د.ع للطلب` : ' '}</small></div>
    </div>

    <div className="or-sources" role="tablist" aria-label="مصدر الطلب">
      <button type="button" role="tab" aria-selected={!source} className={!source ? 'on' : ''} onClick={() => setSource(null)}><b>الكل</b><span>{report.count} طلب</span></button>
      {report.bySource.map(s => <button key={s.key} type="button" role="tab" aria-selected={source === s.key} className={source === s.key ? 'on' : ''} onClick={() => setSource(source === s.key ? null : s.key)}>
        <b>{SOURCE_AR[s.key] ?? s.key}</b><span>{s.orders} طلب{finance ? ` · ربح ${num(s.profit)}` : ''}</span>
        <i style={{ width: `${report.count ? (s.orders / report.count) * 100 : 0}%` }} />
      </button>)}
    </div>

    {rows.length === 0 ? <div className="nq-empty">ماكو طلبات بهاي الفترة</div> : <div className="or-table-wrap"><table className="or-table">
      <thead><tr><th>الطلب</th><th>الزبون</th><th>المصدر</th><th>الحالة</th><th>{singleDay ? 'الوقت' : 'التاريخ'}</th><th>القطع</th><th>المبلغ</th>{finance && <th>الربح</th>}</tr></thead>
      <tbody>{rows.map(r => { const dead = r.status === 'cancelled' || r.status === 'returned'; return <tr key={r.id} className={dead ? 'dead' : ''}>
        <td><Link href={`/admin/orders/${r.id}`}>{r.reference}</Link></td>
        <td>{r.name}</td>
        <td><span className="or-src">{SOURCE_AR[r.source] ?? r.source}</span></td>
        <td><span className={`or-st st-${r.status}`}>{STATUS_AR[r.status] ?? r.status}</span></td>
        <td><bdi>{when(r.createdAt, singleDay)}</bdi></td>
        <td>{r.units}</td>
        <td>{dead ? '—' : num(r.revenue)}</td>
        {finance && <td className="or-profit">{dead ? '—' : <>{num(r.profit)}{r.unknownCost && <em title="بعض القطع بدون كلفة شراء">*</em>}{!r.realised && <small>متوقع</small>}</>}</td>}
      </tr>; })}</tbody>
      <tfoot><tr><td colSpan={5}>المجموع{source ? ` · ${SOURCE_AR[source] ?? source}` : ''} ({total.orders} طلب)</td><td>{rows.reduce((t, r) => t + (r.status === 'cancelled' || r.status === 'returned' ? 0 : r.units), 0)}</td><td>{num(total.revenue)}</td>{finance && <td className="or-profit">{num(total.profit)}</td>}</tr></tfoot>
    </table></div>}
    {(report.rows.length < report.count || (finance && report.unknownCost > 0)) && <p className="or-note">{report.rows.length < report.count ? `يعرض أحدث ${report.rows.length} طلب من ${report.count}. ` : ''}{finance && report.unknownCost > 0 ? `* ${report.unknownCost} طلب بيه قطع بدون كلفة شراء، فربحها محسوب بس على القطع اللي إلها كلفة.` : ''}</p>}
  </div>;
}
