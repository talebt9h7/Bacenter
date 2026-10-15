import { notFound, redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { loadProcurement } from '@/lib/procurement';
import { supplierLedger } from '@/lib/procurement-ledger';
import { PrintButton } from '../../wholesale/[id]/print-button';
import '../../wholesale/[id]/invoice.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'كشف حساب مورد', robots: { index: false } };
const n = (v: number) => new Intl.NumberFormat('en-US').format(Math.round(v));
const d = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' });

/** Printable supplier statement: opening balance, purchases, payments and the running balance. */
export default async function SupplierStatementPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminSection('catalog', 'view'))) redirect('/admin');
  const id = Number((await params).id);
  const { purchases, suppliers, payments } = await loadProcurement();
  const s = suppliers.find(x => x.id === id);
  if (!s) notFound();
  const ledger = supplierLedger(s, purchases.filter(p => p.supplierId === id), payments.filter(p => p.supplierId === id));
  return <div className="inv-page" dir="rtl" lang="ar">
    <PrintButton />
    <article className="inv-sheet">
      <header className="inv-head">
        <p className="inv-latin"><span>UR LEATHER</span></p>
        <h1>أور للجلود</h1>
        <p className="inv-badge">كشف حساب مورد</p>
      </header>
      <section className="inv-meta">
        <div><span>المورد</span><b>{s.name}</b></div>
        {s.phone && <div><span>الهاتف</span><b dir="ltr">{s.phone}</b></div>}
        {s.city && <div><span>المدينة</span><b>{s.city}</b></div>}
        <div><span>تاريخ الكشف</span><b dir="ltr">{d(new Date().toISOString())}</b></div>
      </section>
      <table className="inv-table">
        <thead><tr><th>التاريخ</th><th className="inv-product">البيان</th><th>شراء (عليه)</th><th>دفعة (له)</th><th>الرصيد</th></tr></thead>
        <tbody>
          <tr><td>—</td><td className="inv-product">رصيد سابق</td><td /><td /><td><b>{n(ledger.opening)}</b></td></tr>
          {ledger.rows.map((r, i) => <tr key={i}><td dir="ltr">{d(r.date)}</td><td className="inv-product">{r.kind === 'purchase' ? <>فاتورة شراء <bdi>{r.ref}</bdi></> : <>دفعة{r.ref ? <> · <bdi>{r.ref}</bdi></> : ''}</>}</td><td>{r.debit ? n(r.debit) : ''}</td><td>{r.credit ? n(r.credit) : ''}</td><td><b>{n(r.balance)}</b></td></tr>)}
        </tbody>
      </table>
      <section className="inv-totals">
        <div className="inv-grand"><span>{ledger.closing >= 0 ? 'الرصيد المستحق للمورد' : 'رصيد لنا عند المورد'}</span><b>{n(Math.abs(ledger.closing))} د.ع</b></div>
        <div className="inv-rows"><div><span>مجموع المشتريات</span><b>{n(s.purchasedIqd)} د.ع</b></div><div><span>مجموع الدفعات</span><b>{n(s.paidIqd)} د.ع</b></div></div>
      </section>
      <footer className="inv-foot"><div className="inv-sign"><span>توقيع المورد</span><span>ختم أور للجلود</span></div></footer>
    </article>
  </div>;
}
