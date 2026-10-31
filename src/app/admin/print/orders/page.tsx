import { redirect } from 'next/navigation';
import { inArray } from 'drizzle-orm';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { getSettings } from '@/lib/settings';
import { PrintButton } from '../wholesale/[id]/print-button';
import './orders-print.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'طباعة الطلبات', robots: { index: false } };
const n = (v: number) => new Intl.NumberFormat('en-US').format(Math.round(v));
const PAY: Record<string, string> = { cod: 'الدفع عند الاستلام', electronic: 'دفع إلكتروني', cash: 'نقداً', bank_transfer: 'تحويل مصرفي' };
type Addr = { governorateAr?: string; governorate?: string; city?: string; line1?: string; landmark?: string; altPhone?: string };
type Item = { name: string; color?: string; quantity: number; unitPrice?: number };

/** Printable invoices (one per page) or shipping labels (four per A4 page) for one or more orders. */
export default async function PrintOrdersPage({ searchParams }: { searchParams: Promise<{ ids?: string; type?: string }> }) {
  if (!(await requireAdminSection('sales', 'view'))) redirect('/admin');
  const { ids = '', type = 'invoice' } = await searchParams;
  const list = [...new Set(ids.split(',').map(Number).filter(x => Number.isInteger(x) && x > 0))].slice(0, 200);
  const [rows, settings] = await Promise.all([list.length ? db.select().from(orders).where(inArray(orders.id, list)) : Promise.resolve([]), getSettings()]);
  const ordered = list.map(id => rows.find(r => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
  const label = type === 'label';
  return <div className={`op-page ${label ? 'op-labels' : 'op-invoices'}`} dir="rtl" lang="ar">
    <PrintButton />
    {!ordered.length && <p className="op-empty">ما أكو طلبات للطباعة.</p>}
    {label ? <div className="op-label-grid">{ordered.map(o => { const a = (o.address ?? {}) as Addr; const items = (o.items ?? []) as Item[]; const due = o.paymentStatus === 'paid' ? 0 : o.totalCents; return <article key={o.id} className="op-label">
      <header><b>أور للجلود</b><span dir="ltr">{o.reference}</span></header>
      <div className="op-to"><span>إلى</span><strong>{o.name}</strong><p dir="ltr" className="op-phone">{o.phone}{a.altPhone ? ` / ${a.altPhone}` : ''}</p><p>{a.governorateAr || a.governorate || o.governorate} — {a.city}</p>{a.line1 && <p>{a.line1}</p>}{a.landmark && <p>قرب: {a.landmark}</p>}</div>
      <footer><div><span>القطع</span><b>{items.reduce((s, i) => s + i.quantity, 0)}</b></div><div className="op-due"><span>{due ? 'المبلغ المطلوب' : 'مدفوع'}</span><b>{due ? `${n(due)} د.ع` : '✓'}</b></div></footer>
      {o.customerNote && <p className="op-note">ملاحظة: {o.customerNote}</p>}
    </article>; })}</div>
    : ordered.map(o => { const a = (o.address ?? {}) as Addr; const items = (o.items ?? []) as Item[]; const date = new Date(o.createdAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' }); return <article key={o.id} className="op-invoice">
      <header className="op-head"><div><h1>أور للجلود</h1><p>جلد طبيعي عراقي — صناعة يدوية</p></div><div className="op-ref"><span>فاتورة</span><b dir="ltr">{o.reference}</b><small dir="ltr">{date}</small></div></header>
      <section className="op-meta">
        <div><span>الزبون</span><b>{o.name}</b></div>
        <div><span>الهاتف</span><b dir="ltr">{o.phone}{a.altPhone ? ` / ${a.altPhone}` : ''}</b></div>
        <div><span>العنوان</span><b>{[a.governorateAr || a.governorate || o.governorate, a.city, a.line1].filter(Boolean).join(' — ')}{a.landmark ? ` (قرب ${a.landmark})` : ''}</b></div>
        <div><span>طريقة الدفع</span><b>{PAY[o.paymentMethod] ?? o.paymentMethod}{o.paymentStatus === 'paid' ? ' · مدفوع' : ''}</b></div>
      </section>
      <table className="op-table"><thead><tr><th>#</th><th className="op-name">المنتج</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr></thead>
        <tbody>{items.map((i, k) => <tr key={k}><td>{k + 1}</td><td className="op-name">{i.name}{i.color ? ` — ${i.color}` : ''}</td><td>{i.quantity}</td><td>{n(i.unitPrice ?? 0)}</td><td>{n((i.unitPrice ?? 0) * i.quantity)}</td></tr>)}</tbody></table>
      <section className="op-totals">
        <div><span>المجموع الفرعي</span><b>{n(o.subtotalCents)} د.ع</b></div>
        {o.discountCents > 0 && <div><span>الخصم{o.couponCode ? ` (${o.couponCode})` : ''}</span><b>− {n(o.discountCents)} د.ع</b></div>}
        <div><span>التوصيل</span><b>{o.shippingCents ? `${n(o.shippingCents)} د.ع` : 'مجاني'}</b></div>
        {o.codFeeCents > 0 && <div><span>رسوم الدفع عند الاستلام</span><b>{n(o.codFeeCents)} د.ع</b></div>}
        <div className="op-grand"><span>{o.paymentStatus === 'paid' ? 'الإجمالي (مدفوع)' : 'المبلغ المطلوب عند الاستلام'}</span><b>{n(o.totalCents)} د.ع</b></div>
      </section>
      {o.customerNote && <p className="op-note">ملاحظة الزبون: {o.customerNote}</p>}
      <footer className="op-foot">شكراً لاختيارك أور للجلود{settings.supportPhone ? ` · للاستفسار: ${settings.supportPhone}` : ''}{settings.instagram ? ` · ${settings.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@').replace(/\/$/, '')}` : ''}</footer>
    </article>; })}
  </div>;
}
