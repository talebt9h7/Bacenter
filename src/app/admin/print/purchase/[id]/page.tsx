import { notFound, redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { loadProcurement } from '@/lib/procurement';
import { PrintButton } from '../../wholesale/[id]/print-button';
import '../../wholesale/[id]/invoice.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'فاتورة شراء', robots: { index: false } };
const n = (v: number) => new Intl.NumberFormat('en-US').format(Math.round(v));
const img = (url: string | null) => !url ? '/images/placeholder.svg' : url.startsWith('/api/media/') ? `${url}?w=240` : url;
const d = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' }) : '—';
const STATUS = { ordered: 'بالطريق', received: 'مستلمة', cancelled: 'ملغية' } as const;

/** Printable purchase / goods-received note with landed cost per unit and what is still owed. */
export default async function PurchasePrintPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminSection('catalog', 'view'))) redirect('/admin');
  const id = Number((await params).id);
  const { purchases, suppliers, payments } = await loadProcurement();
  const p = purchases.find(x => x.id === id);
  if (!p) notFound();
  const s = suppliers.find(x => x.id === p.supplierId);
  const paid = payments.filter(x => x.purchaseId === p.id);
  return <div className="inv-page" dir="rtl" lang="ar">
    <PrintButton />
    <article className="inv-sheet">
      <header className="inv-head">
        <p className="inv-latin"><span>UR LEATHER</span></p>
        <h1>أور للجلود</h1>
        <p className="inv-badge">فاتورة شراء · <bdi>{p.reference}</bdi> · {STATUS[p.status]}</p>
      </header>
      <section className="inv-meta">
        <div><span>المورد</span><b>{p.supplierName ?? '—'}</b></div>
        {s?.phone && <div><span>الهاتف</span><b dir="ltr">{s.phone}</b></div>}
        {p.supplierInvoice && <div><span>رقم فاتورة المورد</span><b>{p.supplierInvoice}</b></div>}
        <div><span>التاريخ</span><b dir="ltr">{d(p.purchaseDate)}</b></div>
        {p.receivedAt && <div><span>تاريخ الاستلام</span><b dir="ltr">{d(p.receivedAt)}</b></div>}
        {p.currency === 'USD' && <div><span>العملة</span><b dir="ltr">USD · {n(p.exchangeRate)} IQD</b></div>}
        {p.dueDate && p.remainingIqd > 0 && <div><span>موعد السداد</span><b dir="ltr" className={p.overdue ? 'inv-credit' : ''}>{d(p.dueDate)}</b></div>}
      </section>
      <table className="inv-table">
        <thead><tr><th>الصورة</th><th className="inv-product">المنتج</th><th>العدد</th><th>سعر الوحدة</th><th>التكلفة الفعلية<br /><small>للقطعة (دينار)</small></th><th>الإجمالي<br /><small>(دينار)</small></th></tr></thead>
        <tbody>{p.lines.map(l => <tr key={l.id}>
          <td><img src={img(l.image)} alt="" /></td>
          <td className="inv-product"><b>{l.productNameAr}{l.colorAr ? ` — ${l.colorAr}` : ''}</b></td>
          <td><span className="inv-qty">{l.quantity}</span></td>
          <td dir="ltr">{p.currency === 'USD' ? `$${(l.unitCost / 100).toFixed(2)}` : n(l.unitCost)}</td>
          <td><b>{n(l.landedCostIqd)}</b></td>
          <td><b>{n(l.landedCostIqd * l.quantity)} د.ع</b></td>
        </tr>)}</tbody>
      </table>
      <section className="inv-totals">
        <div className="inv-grand"><span>إجمالي الفاتورة</span><b>{n(p.totalIqd)} د.ع</b></div>
        <div className="inv-rows">
          <div><span>عدد القطع</span><b>{p.units}</b></div>
          <div><span>قيمة البضاعة</span><b>{n(p.subtotalIqd)} د.ع</b></div>
          {p.extraCostsIqd > 0 && <div><span>شحن وكمرك</span><b>+ {n(p.extraCostsIqd)} د.ع</b></div>}
          {p.discountIqd > 0 && <div><span>خصم المورد</span><b>− {n(p.discountIqd)} د.ع</b></div>}
          {p.supplierId != null && p.status !== 'cancelled' && <><div><span>المدفوع</span><b>{n(p.paidIqd)} د.ع</b></div><div className="inv-due"><span>المتبقي للمورد</span><b>{n(p.remainingIqd)} د.ع</b></div></>}
        </div>
      </section>
      {paid.length > 0 && <p className="inv-note">الدفعات: {paid.map(x => `${d(x.paidAt)} — ${n(x.amountIqd)} د.ع`).join(' · ')}</p>}
      {p.notes && <p className="inv-note">{p.notes}</p>}
      <footer className="inv-foot"><div className="inv-sign"><span>توقيع المورد</span><span>توقيع المستلم</span></div></footer>
    </article>
  </div>;
}
