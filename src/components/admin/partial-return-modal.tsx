'use client';

/**
 * Partial delivery: the customer keeps some units and hands the rest back to the courier.
 * Pick how many of each line were received; the rest goes back into stock, the total is
 * recalculated (delivery fee unchanged, no return fee) and the order is marked delivered.
 */
import { useState } from 'react';
import { LoaderCircle, Minus, Plus, Undo2 } from 'lucide-react';
import { Modal, api, useFlash } from './ui';
import { groupInt } from '@/lib/number-format';
import { mediaSrc } from '@/lib/types';

type Line = { variantId: number; name: string; color: string; quantity: number; unitPrice?: number; priceCents?: number; image?: string | null };
export type PartialReturnOrder = { id: number; reference: string; items: Line[]; discountCents: number; shippingCents: number; codFeeCents: number; totalCents: number; paymentStatus: string; paymentMethod: string; paidCents?: number | null };

export function PartialReturnModal({ order, names, language, onClose, onDone }: { order: PartialReturnOrder; names?: Map<number, { product?: string; color?: string }>; language: 'ar' | 'en'; onClose: () => void; onDone: (data: { order: unknown; events?: unknown }) => void }) {
  const ar = language === 'ar';
  const L = (a: string, e: string) => ar ? a : e;
  const iqd = (n: number) => `${groupInt(Math.round(n))} ${L('د.ع', 'IQD')}`;
  const [kept, setKept] = useState(() => order.items.map(i => i.quantity));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { flash, fail } = useFlash();
  const price = (i: Line) => Number(i.unitPrice ?? i.priceCents ?? 0);
  const subtotal = order.items.reduce((s, i, k) => s + price(i) * kept[k], 0);
  const discount = Math.min(order.discountCents, subtotal);
  const total = Math.max(0, subtotal - discount) + order.shippingCents + order.codFeeCents;
  const backUnits = order.items.reduce((s, i, k) => s + i.quantity - kept[k], 0);
  const keptUnits = kept.reduce((s, q) => s + q, 0);
  const backValue = order.items.reduce((s, i, k) => s + price(i) * (i.quantity - kept[k]), 0);
  const prepaid = order.paymentStatus === 'paid' && order.paymentMethod !== 'cod' ? order.totalCents : Number(order.paidCents ?? 0);
  const due = Math.max(0, total - prepaid);
  const valid = keptUnits > 0 && backUnits > 0;
  const set = (k: number, q: number) => setKept(v => v.map((x, i) => i === k ? Math.max(0, Math.min(order.items[k].quantity, q)) : x));

  async function save() {
    setBusy(true);
    try { const data = await api<{ order: unknown; events?: unknown }>(`/api/admin/orders/${order.id}/partial-return`, { method: 'POST', json: { received: kept, note } }); onDone(data); onClose(); }
    catch (e) { fail(e); setBusy(false); }
  }

  return <Modal title={L(`تسليم جزئي · ${order.reference}`, `Partial delivery · ${order.reference}`)} onClose={onClose}>{flash}
    <p className="pr-intro">{L('حدد شكد استلم الزبون من كل منتج. الباقي يرجع للمخزون، والطلب يتحول "تم التوصيل" بالمبلغ الجديد. أجور التوصيل تبقى مثل ما هي وما تنحسب أجور إرجاع.', 'Set how many of each item the customer kept. The rest goes back into stock and the order is marked delivered at the new amount. The delivery fee stays and no return fee is charged.')}</p>
    <ul className="pr-lines">{order.items.map((item, k) => {
      const back = item.quantity - kept[k];
      return <li key={k} className={back > 0 ? 'has-back' : ''}>
        {item.image ? <img src={mediaSrc(item.image, 120)} alt="" /> : <span className="pr-noimg" />}
        <div className="pr-info"><b>{names?.get(item.variantId)?.product ?? item.name}</b><small>{names?.get(item.variantId)?.color ?? item.color} · {L(`مطلوب ${item.quantity}`, `ordered ${item.quantity}`)} · {iqd(price(item))}</small>{back > 0 && <em><Undo2 size={12} /> {L(`يرجع ${back}`, `${back} returned`)}</em>}</div>
        <div className="pr-step" aria-label={L('الكمية المستلمة', 'Quantity received')}>
          <button type="button" onClick={() => set(k, kept[k] - 1)} disabled={kept[k] <= 0} aria-label={L('أقل', 'Less')}><Minus size={14} /></button>
          <span><b>{kept[k]}</b><small>{L('استلم', 'kept')}</small></span>
          <button type="button" onClick={() => set(k, kept[k] + 1)} disabled={kept[k] >= item.quantity} aria-label={L('أكثر', 'More')}><Plus size={14} /></button>
        </div>
      </li>;
    })}</ul>
    <dl className="pr-sum">
      <div><dt>{L('قطع ترجع للمخزون', 'Units back to stock')}</dt><dd>{backUnits}{backValue ? ` · ${iqd(backValue)}` : ''}</dd></div>
      <div><dt>{L('مجموع المنتجات المستلمة', 'Kept items')}</dt><dd>{iqd(subtotal)}</dd></div>
      {discount > 0 && <div><dt>{L('الخصم', 'Discount')}</dt><dd>− {iqd(discount)}</dd></div>}
      <div><dt>{L('أجور التوصيل (بدون تغيير)', 'Delivery fee (unchanged)')}</dt><dd>{iqd(order.shippingCents + order.codFeeCents)}</dd></div>
      <div className="pr-total"><dt>{L('مجموع الطلب الجديد', 'New order total')}</dt><dd>{iqd(total)} <s>{iqd(order.totalCents)}</s></dd></div>
      {prepaid > 0 && <div><dt>{L('مدفوع مسبقاً', 'Paid in advance')}</dt><dd>{iqd(prepaid)}</dd></div>}
      <div className="pr-due"><dt>{L('المطلوب من شركة التوصيل', 'To collect from the courier')}</dt><dd>{iqd(due)}</dd></div>
    </dl>
    {prepaid > total && <p className="pr-warn">{L(`الزبون دافع أكثر من المجموع الجديد بـ ${iqd(prepaid - total)}؛ رجّع الفرق إله.`, `The customer paid ${iqd(prepaid - total)} more than the new total; refund the difference.`)}</p>}
    <label className="admin-field"><span>{L('ملاحظة (اختياري)', 'Note (optional)')}</span><input value={note} onChange={e => setNote(e.target.value)} placeholder={L('مثلاً: القياس ما ناسبه', 'e.g. size did not fit')} maxLength={300} /></label>
    {!valid && <p className="admin-hint">{keptUnits === 0 ? L('إذا رجّع كل شي، حوّل الطلب إلى مرتجع.', 'If everything came back, mark the order returned.') : L('نزّل الكمية المستلمة لمنتج واحد على الأقل.', 'Lower the kept quantity of at least one item.')}</p>}
    <div className="admin-modal-actions"><button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>{L('إلغاء', 'Cancel')}</button><button type="button" className="admin-btn admin-btn-primary" disabled={!valid || busy} onClick={() => void save()}>{busy ? <LoaderCircle size={15} className="spin" /> : <Undo2 size={15} />} {L('حفظ التسليم الجزئي', 'Save partial delivery')}</button></div>
  </Modal>;
}
