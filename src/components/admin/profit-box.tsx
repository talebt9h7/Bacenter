'use client';
import { TrendingUp } from 'lucide-react';
import type { estimateProfit } from '@/lib/profit-estimate';

const num = (v: number) => new Intl.NumberFormat('en-US').format(Math.round(v));

/** Owner-only: what this order earns after the discount, and how far the discount can go before a loss. */
export function ProfitBox({ p, onMaxDiscount }: { p: ReturnType<typeof estimateProfit>; onMaxDiscount?: (value: number) => void }) {
  if (!p.revenue) return null;
  const loss = p.profit < 0, noCost = p.unknown > 0 && p.cost === 0;
  return <section className={`pf-box${loss ? ' is-loss' : ''}`} aria-label="ربح الطلب">
    <h4><TrendingUp size={15} /> ربحك من هذا الطلب <small>(للإدارة فقط)</small></h4>
    {noCost ? <p className="pf-note">ما مسجلة كلفة شراء لهذي المنتجات، فما أگدر أحسب الربح. سجّل الكلفة من «المشتريات» أو «المخزون».</p> : <>
      <dl>
        <div><dt>كلفة المنتجات</dt><dd>{num(p.cost)} د.ع</dd></div>
        <div><dt>الربح قبل الخصم</dt><dd>{num(p.profitBefore)} د.ع</dd></div>
        {p.discount > 0 && <div><dt>الخصم</dt><dd className="pf-minus"><bdi dir="ltr">−{num(p.discount)}</bdi> د.ع</dd></div>}
      </dl>
      <div className="pf-total"><span>{loss ? 'خسارة' : 'صافي الربح'}</span><strong><bdi dir="ltr">{loss ? '−' : ''}{num(Math.abs(p.profit))}</bdi> د.ع</strong></div>
      <div className="pf-max"><span>أقصى خصم بدون خسارة</span><b>{num(p.maxDiscount)} د.ع</b>{onMaxDiscount && p.maxDiscount > 0 && <button type="button" onClick={() => onMaxDiscount(p.maxDiscount)}>تطبيق</button>}</div>
      {p.unknown > 0 && <p className="pf-note">{p.unknown} قطعة ما إلها كلفة مسجلة، فما محسوبة بالربح.</p>}
    </>}
  </section>;
}
