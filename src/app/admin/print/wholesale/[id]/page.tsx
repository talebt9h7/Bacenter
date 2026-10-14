import { notFound, redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { getWholesale } from '@/lib/wholesale-data';
import { getSettings } from '@/lib/settings';
import { PrintButton } from './print-button';
import './invoice.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'فاتورة جملة', robots: { index: false } };
const n = (v: number) => new Intl.NumberFormat('en-US').format(Math.round(v));
const img = (url: string | null) => !url ? '/images/placeholder.svg' : url.startsWith('/api/media/') ? `${url}?w=240` : url;
function Ziggurat() {
  return <svg viewBox="0 0 40 24" width="28" height="17" aria-hidden="true"><path d="M2 22h36M6 22v-5h28v5M10 17v-5h20v5M14 12V7h12v5M18 7V3h4v4" fill="none" stroke="currentColor" strokeWidth="2" /></svg>;
}

/** Printable wholesale invoice / price sheet: trader name and number, wholesale vs fixed retail price, trader profit. */
export default async function WholesaleInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminSection('sales', 'view'))) redirect('/admin');
  const [invoice, settings] = await Promise.all([getWholesale(Number((await params).id)), getSettings()]);
  if (!invoice) notFound();
  const date = new Date(invoice.createdAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' });
  const units = invoice.items.reduce((s, i) => s + i.quantity, 0);
  const retailTotal = invoice.items.reduce((s, i) => s + i.listPrice * i.quantity, 0);
  return <div className="inv-page" dir="rtl" lang="ar">
    <PrintButton />
    <article className="inv-sheet">
      <header className="inv-head">
        <p className="inv-latin"><Ziggurat /> <span>UR LEATHER</span> <Ziggurat /></p>
        <h1>أور للجلود</h1>
        <p className="inv-tag">جلد طبيعي عراقي — إرث سومري بروح معاصرة</p>
        <p className="inv-badge">فاتورة جملة · <bdi>{invoice.reference}</bdi></p>
      </header>
      <section className="inv-meta">
        <div><span>اسم التاجر</span><b>{invoice.name}</b></div>
        <div><span>رقم الهاتف</span><b dir="ltr">{invoice.phone}</b></div>
        {invoice.shop && <div><span>المحل</span><b>{invoice.shop}</b></div>}
        {invoice.city && <div><span>المدينة</span><b>{invoice.city}</b></div>}
        <div><span>التاريخ</span><b dir="ltr">{date}</b></div>
        <div><span>طريقة الدفع</span><b className={invoice.payment === 'credit' ? 'inv-credit' : ''}>{invoice.payment === 'credit' ? 'آجل' : 'نقد'}</b></div>
      </section>
      <table className="inv-table">
        <thead><tr><th>الصورة</th><th className="inv-product">المنتج</th><th>سعر الجملة<br /><small>(دينار)</small></th><th>سعر البيع الملزم<br /><small>(دينار)</small></th><th>ربح التاجر<br /><small>للقطعة</small></th><th>نسبة الربح</th><th>العدد</th><th>الإجمالي<br /><small>(جملة)</small></th></tr></thead>
        <tbody>{invoice.items.map((i, k) => { const profit = Math.max(0, i.listPrice - i.unitPrice); return <tr key={k}>
          <td><img src={img(i.image)} alt="" /></td>
          <td className="inv-product"><b>{i.nameAr || i.name}{(i.colorAr || i.color) ? ` — ${i.colorAr || i.color}` : ''}</b>{i.nameAr && i.nameAr !== i.name && <small dir="ltr">{i.name}</small>}</td>
          <td>{n(i.unitPrice)}</td>
          <td><b className="inv-gold">{n(i.listPrice)}</b><small>سعر ثابت</small></td>
          <td className="inv-gold">{n(profit)} د.ع</td>
          <td className="inv-gold">{i.listPrice > 0 ? Math.round(profit / i.listPrice * 100) : 0}%</td>
          <td><span className="inv-qty">{i.quantity}</span></td>
          <td><b>{n(i.unitPrice * i.quantity)} د.ع</b></td>
        </tr>; })}</tbody>
      </table>
      <section className="inv-totals">
        <div className="inv-grand"><span>الإجمالي الكلي للطلبية</span><b>{n(invoice.total)} د.ع</b></div>
        <div className="inv-rows">
          <div><span>عدد القطع</span><b>{units}</b></div>
          {invoice.discount > 0 && <div><span>الخصم</span><b>− {n(invoice.discount)} د.ع</b></div>}
          <div><span>قيمة البضاعة بسعر المفرد</span><b>{n(retailTotal)} د.ع</b></div>
          <div><span>ربح التاجر المتوقع</span><b className="inv-gold">{n(Math.max(0, retailTotal - invoice.total))} د.ع</b></div>
          {invoice.payment === 'credit' && <><div><span>المدفوع</span><b>{n(invoice.paid)} د.ع</b></div><div className="inv-due"><span>المتبقي بذمة التاجر</span><b>{n(invoice.remaining)} د.ع</b></div></>}
        </div>
      </section>
      {invoice.note && <p className="inv-note">{invoice.note}</p>}
      <footer className="inv-foot">
        <p>سعر البيع للمستهلك ثابت ويُلتزم به من قبل التاجر.</p>
        <p dir="ltr">{[settings.supportPhone, settings.instagram?.replace(/^https?:\/\/(www\.)?/, '')].filter(Boolean).join('  ·  ')}</p>
        <div className="inv-sign"><span>توقيع المستلم</span><span>ختم أور للجلود</span></div>
      </footer>
    </article>
  </div>;
}
