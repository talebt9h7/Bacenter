'use client';
import { useState } from 'react';
import { ProfitBox } from './profit-box';
import { estimateProfit, type CostLayer } from '@/lib/profit-estimate';
import { useRouter } from 'next/navigation';
import { LoaderCircle, Save, Trash2 } from 'lucide-react';
import { api, Modal, useFlash } from './ui';
import { useLanguage } from '@/components/language-provider';
import { iraqGovernorates } from '@/lib/iraq';
import { groupInt } from '@/lib/number-format';
import { mediaSrc } from '@/lib/types';
import './accounts.css';

type CatalogRow = { variantId: number; productId: string; productName: string; productNameAr?: string; color: string; colorAr?: string; stock: number; priceCents: number; salePriceIqd: number; image: string | null; published: boolean };
type ManualLine = CatalogRow & { quantity: number; unitPrice: number };

/** Admin → Orders → "Add manual order": an order taken by phone, Instagram, WhatsApp or in the shop. */
type CourierOption = { id: number; name: string; defaultFeeIqd: number; rates: Record<string, number> };
/** The order being edited: the same form fills with it and saves the changes instead of creating a new order. */
export type EditableOrder = { id: number; reference: string; name: string; phone: string; email: string; governorate: string; status: string; source: string; sourceNote: string | null; paymentMethod: string; paymentStatus: string; shippingCents: number; discountCents: number; customerNote: string | null; fulfillment?: string; courierId?: number | null; courierFeeIqd?: number | null; address: { city?: string; line1?: string; landmark?: string }; items: { productId: string; variantId: number; name: string; color: string; quantity: number; unitPrice?: number; priceCents?: number; image?: string | null }[] };
export function ManualOrderModal({ catalog, costLayers, couriers = [], defaultCourierId = null, zoneRates = {}, order, onClose, onSaved }: { catalog: CatalogRow[]; costLayers?: Record<number, CostLayer[]>; couriers?: CourierOption[]; defaultCourierId?: number | null; zoneRates?: Record<string, number>; order?: EditableOrder; onClose: () => void; onSaved?: (order: unknown) => void }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const L = (a: string, e: string) => (ar ? a : e);
  const iqd = (n: number) => (ar ? `${groupInt(Math.round(n))} د.ع` : `${groupInt(Math.round(n))} IQD`);
  const productName = (row: CatalogRow) => (ar ? row.productNameAr || row.productName : row.productName);
  const colorName = (row: CatalogRow) => (ar ? row.colorAr || row.color : row.color);
  const router = useRouter();
  const editing = !!order;
  // Wholesale invoices have no delivery: their address and hand-over stay as they are.
  const isWholesale = order?.source === 'wholesale';
  const pickupText = 'استلام من المحل';
  const [name, setName] = useState(order?.name ?? ''), [phone, setPhone] = useState(order?.phone ?? ''), [governorate, setGovernorate] = useState(order?.governorate || 'baghdad'), [address, setAddress] = useState(() => { const a = order?.address; if (!a || a.line1 === pickupText) return ''; return a.line1 || [a.city, a.landmark].filter(Boolean).join(' - '); });
  const [source, setSource] = useState(order?.source || 'instagram'), [sourceNote, setSourceNote] = useState(order?.sourceNote ?? ''), [paymentMethod, setPaymentMethod] = useState(order?.paymentMethod || 'cod'), [paymentStatus, setPaymentStatus] = useState(order?.paymentStatus || 'unpaid'), [shipping, setShipping] = useState(order ? String(order.shippingCents ?? 0) : ''), [discount, setDiscount] = useState(order ? String(order.discountCents ?? 0) : '0'), [note, setNote] = useState(order?.customerNote ?? ''), [selected, setSelected] = useState('');
  // Units already in this order are held by it, so they count as available when editing.
  const held = new Map((order?.items ?? []).map(item => [item.variantId, item.quantity]));
  const [lines, setLines] = useState<ManualLine[]>(() => (order?.items ?? []).map(item => {
    const row = catalog.find(c => c.variantId === item.variantId);
    const base: CatalogRow = row ?? { variantId: item.variantId, productId: item.productId, productName: item.name, color: item.color, stock: 0, priceCents: 0, salePriceIqd: item.unitPrice ?? item.priceCents ?? 0, image: item.image ?? null, published: false };
    return { ...base, stock: base.stock + item.quantity, quantity: item.quantity, unitPrice: item.unitPrice ?? item.priceCents ?? 0 };
  })), [busy, setBusy] = useState(false);
  const [fulfillment, setFulfillment] = useState<'courier' | 'pickup'>(order?.fulfillment === 'pickup' ? 'pickup' : 'courier');
  const [courierId, setCourierId] = useState(order ? (order.courierId ? String(order.courierId) : '') : String(couriers.find(c => c.id === defaultCourierId)?.id ?? (couriers.length === 1 ? couriers[0].id : '')));
  const [handedOver, setHandedOver] = useState(true);
  const methods = [...new Set([...(fulfillment === 'pickup' ? ['cash', 'bank_transfer', 'electronic'] : ['cod', 'bank_transfer', 'electronic']), ...(order && order.paymentMethod ? [order.paymentMethod] : [])])];
  const pickFulfillment = (next: 'courier' | 'pickup') => { setFulfillment(next); if (next === 'pickup') { setShipping('0'); setSource('store'); if (paymentMethod === 'cod') setPaymentMethod('cash'); } else { setShipping(''); if (paymentMethod === 'cash') setPaymentMethod('cod'); } };
  const methodName: Record<string, string> = { cod: L('الدفع عند الاستلام', 'Cash on delivery'), cash: L('نقد', 'Cash'), bank_transfer: L('تحويل ماستر', 'Master transfer'), electronic: L('دفع إلكتروني', 'Electronic') };
  const { flash, fail } = useFlash();
  const addLine = (row: CatalogRow) => { if (lines.some(x => x.variantId === row.variantId)) { setLines(v => v.map(x => (x.variantId === row.variantId ? { ...x, quantity: Math.min(x.stock, x.quantity + 1) } : x))); return; } setLines(v => [...v, { ...row, stock: row.stock + (held.get(row.variantId) ?? 0), quantity: 1, unitPrice: row.salePriceIqd }]); };
  const subtotal = lines.reduce((s, x) => s + x.unitPrice * x.quantity, 0), safeDiscount = Math.min(Math.max(0, Number(discount) || 0), subtotal), delivery = fulfillment === 'pickup' ? 0 : shipping === '' ? (zoneRates[governorate] ?? null) : Math.max(0, Number(shipping) || 0), total = Math.max(0, subtotal - safeDiscount) + (delivery ?? 0);
  async function save() {
    if (!order) return;
    setBusy(true);
    try {
      const govAr = iraqGovernorates.find(g => g.code === governorate)?.nameAr ?? governorate;
      const keepCity = order.address?.city && order.address.city !== pickupText && governorate === order.governorate;
      const data = await api<{ order: unknown }>(`/api/admin/orders/${order.id}`, { method: 'PATCH', json: {
        name, phone, email: order.email, governorate,
        city: isWholesale ? (order.address?.city || govAr || 'جملة') : fulfillment === 'pickup' ? pickupText : keepCity ? order.address.city : govAr,
        address: isWholesale ? (order.address?.line1 && order.address.line1.length >= 3 ? order.address.line1 : 'بيع جملة') : fulfillment === 'pickup' ? (address.trim() || pickupText) : address, landmark: order.address?.landmark ?? '',
        source, sourceNote, shipping: fulfillment === 'pickup' || isWholesale ? 0 : delivery ?? 0, discount: safeDiscount,
        paymentMethod, paymentStatus: paymentMethod === 'cod' ? order.paymentStatus : paymentStatus, customerNote: note,
        items: lines.map(x => ({ variantId: x.variantId, quantity: x.quantity, unitPrice: x.unitPrice })),
        ...(isWholesale ? {} : { fulfillment }), courierId: !isWholesale && fulfillment === 'courier' && courierId ? Number(courierId) : null, courierFeeIqd: fulfillment === 'courier' ? order.courierFeeIqd ?? null : null,
      } });
      onSaved?.(data.order); onClose();
    } catch (e) { fail(e); setBusy(false); }
  }
  async function submit() { if (editing) return save(); setBusy(true); try { const data = await api<{ id: number }>('/api/admin/orders/manual', { method: 'POST', json: { name, phone, governorate, address, source, sourceNote, paymentMethod, paymentStatus: paymentMethod === 'cod' ? 'unpaid' : fulfillment === 'pickup' && paymentMethod === 'cash' ? (handedOver ? 'paid' : 'unpaid') : paymentStatus, status: fulfillment === 'pickup' && handedOver ? 'delivered' : 'pending', fulfillment, courierId: fulfillment === 'courier' && courierId ? Number(courierId) : null, shipping: delivery, discount: safeDiscount, note, items: lines.map(x => ({ variantId: x.variantId, quantity: x.quantity, unitPrice: x.unitPrice })) } }); router.push(`/admin/orders/${data.id}`); } catch (e) { fail(e); setBusy(false); } }
  const q = selected.trim().toLowerCase();
  const choices = catalog.filter(x => x.published && x.stock > 0 && (!q || `${x.productName} ${x.productNameAr ?? ''} ${x.color} ${x.colorAr ?? ''}`.toLowerCase().includes(q)));

  const sources: [string, string, string][] = [['instagram', 'إنستغرام', 'Instagram'], ['whatsapp', 'واتساب', 'WhatsApp'], ['facebook', 'فيسبوك', 'Facebook'], ['phone', 'اتصال هاتفي', 'Phone call'], ['store', 'من المحل', 'In store'], ['other', 'غير ذلك', 'Other'], ['website', 'الموقع', 'Website'], ['tiktok', 'تيك توك', 'TikTok'], ['wholesale', 'جملة', 'Wholesale']];
  const shownSources = sources.filter(([key], i) => i < 6 || key === source);
  return <Modal title={editing ? L(`تعديل الطلب ${order!.reference}`, `Edit order ${order!.reference}`) : L('إضافة طلب يدوي', 'Add manual order')} onClose={onClose} wide>{flash}
    {!isWholesale && <div className="admin-form-grid" style={{ marginBottom: 12 }}><div className="admin-field admin-field-full"><span>{L('طريقة التسليم', 'Hand-over')}</span><div className="acc-seg"><button type="button" className={fulfillment === 'courier' ? 'is-on' : ''} onClick={() => pickFulfillment('courier')}>{L('توصيل بشركة', 'Delivery company')}</button><button type="button" className={fulfillment === 'pickup' ? 'is-on' : ''} onClick={() => pickFulfillment('pickup')}>{L('استلام من المحل', 'Shop pick-up')}</button></div></div></div>}
    <div className="admin-form-grid">
      <label className="admin-field"><span>{L('اسم الزبون *', 'Customer name *')}</span><input value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="admin-field"><span>{L('رقم الهاتف *', 'Phone *')}</span><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0770 123 4567" inputMode="tel" dir="ltr" /></label>
      <label className="admin-field"><span>{L('مصدر الطلب *', 'Order source *')}</span><select value={source} onChange={e => setSource(e.target.value)}>
        {shownSources.map(([key, a, e]) => <option key={key} value={key}>{L(a, e)}</option>)}
      </select></label>
      <label className="admin-field"><span>{L('ملاحظة عن المصدر', 'Source note')}</span><input value={sourceNote} onChange={e => setSourceNote(e.target.value)} placeholder={L('مثلاً: رسالة خاص / اسم الحساب / الحملة', 'DM / username / campaign')} /></label>
      {fulfillment === 'courier' && !isWholesale && <label className="admin-field"><span>{L('المحافظة *', 'Governorate *')}</span><select value={governorate} onChange={e => setGovernorate(e.target.value)}>{iraqGovernorates.map(g => <option key={g.code} value={g.code}>{ar ? g.nameAr : g.nameEn}</option>)}</select></label>}
      
      {fulfillment === 'courier' && !isWholesale && <label className="admin-field admin-field-full"><span>{L('العنوان بالتفصيل *', 'Detailed address *')}</span><input value={address} onChange={e => setAddress(e.target.value)} /></label>}
      
    </div>

    <section className="admin-card" style={{ marginTop: 18 }}>
      <div className="admin-card-heading"><h3>{L('المنتجات', 'Products')}</h3></div>
      <input className="mo-search" type="search" value={selected} onChange={e => setSelected(e.target.value)} placeholder={L('ابحث باسم المنتج أو اللون…', 'Search product or colour…')} aria-label={L('بحث المنتجات', 'Search products')} />
      <div className="mo-grid" role="list">
        {choices.map(x => { const count = lines.find(l => l.variantId === x.variantId)?.quantity ?? 0; return <button key={x.variantId} type="button" role="listitem" className={`mo-tile${count ? ' is-added' : ''}`} onClick={() => addLine(x)} title={L('اضغط للإضافة', 'Tap to add')}>
          <span className="mo-photo">{x.image ? <img src={mediaSrc(x.image, 240)} alt="" loading="lazy" /> : null}{count > 0 && <b className="mo-count">{count}</b>}</span>
          <strong>{productName(x)}</strong>
          <small>{colorName(x)}</small>
          <span className="mo-meta"><span>{iqd(x.salePriceIqd)}</span><span>{L(`متوفر ${x.stock}`, `${x.stock} left`)}</span></span>
        </button>; })}
        {!choices.length && <p className="mo-empty">{L('ماكو منتج بهذا الاسم.', 'No product matches.')}</p>}
      </div>
      {lines.length > 0 && <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>{L('المنتج', 'Product')}</th><th>{L('الكمية', 'Qty')}</th><th>{L('سعر القطعة', 'Unit price')}</th><th>{L('المجموع', 'Total')}</th><th /></tr></thead>
        <tbody>{lines.map((line, i) => <tr key={line.variantId}>
          <td><div className="admin-product-cell"><img src={line.image ? mediaSrc(line.image, 160) : '/placeholder.svg'} alt="" /><div><strong>{productName(line)}</strong><small>{colorName(line)} · {L(`المتوفر ${line.stock}`, `${line.stock} in stock`)}</small></div></div></td>
          <td><input type="number" min="1" max={line.stock} value={line.quantity} onChange={e => setLines(v => v.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Math.min(x.stock, Number(e.target.value) || 1)) } : x)))} style={{ width: 80 }} aria-label={L('الكمية', 'Quantity')} /></td>
          <td><input type="number" min="0" step="250" value={line.unitPrice} onChange={e => setLines(v => v.map((x, j) => (j === i ? { ...x, unitPrice: Math.max(0, Number(e.target.value) || 0) } : x)))} style={{ width: 120 }} aria-label={L('سعر القطعة', 'Unit price')} /></td>
          <td>{iqd(line.unitPrice * line.quantity)}</td>
          <td><button type="button" className="admin-icon-btn" aria-label={L('حذف', 'Remove')} onClick={() => setLines(v => v.filter((_, j) => j !== i))}><Trash2 size={15} /></button></td>
        </tr>)}</tbody>
      </table></div>}
    </section>

    <div className="admin-form-grid" style={{ marginTop: 18 }}>
      
      {fulfillment === 'courier' && !isWholesale && <label className="admin-field"><span>{L('شركة التوصيل', 'Delivery company')}</span><select value={courierId} onChange={e => setCourierId(e.target.value)}><option value="">{L('— تتحدد بعدين —', '— later —')}</option>{couriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      {fulfillment === 'courier' && !isWholesale && <label className="admin-field"><span>{L('أجور التوصيل على الزبون', 'Delivery charged')}</span><input type="number" min="0" step="500" value={shipping} onChange={e => setShipping(e.target.value)} placeholder={L('فارغ = حسب سعر المحافظة', 'Empty = governorate rate')} /></label>}
      <label className="admin-field"><span>{L('الخصم', 'Discount')}</span><input type="number" min="0" step="250" value={discount} onChange={e => setDiscount(e.target.value)} /></label>
      <label className="admin-field"><span>{L('طريقة الدفع', 'Payment')}</span><select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>{methods.map(m => <option key={m} value={m}>{methodName[m] ?? m}</option>)}</select></label>
      {fulfillment === 'pickup' && !editing && <label className="admin-field"><span>{L('الزبون استلم؟', 'Handed over?')}</span><select value={handedOver ? '1' : '0'} onChange={e => setHandedOver(e.target.value === '1')}><option value="1">{L('نعم، استلم هسه', 'Yes, now')}</option><option value="0">{L('لا، يستلم بعدين', 'Not yet')}</option></select></label>}
      {(paymentMethod === 'bank_transfer' || paymentMethod === 'electronic') && <label className="admin-field"><span>{L('وصل المبلغ؟', 'Money received?')}</span><select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}><option value="unpaid">{L('لا، بعده', 'Not yet')}</option><option value="paid">{L('نعم، وصل', 'Yes')}</option></select></label>}
      
      <label className="admin-field admin-field-full"><span>{L('ملاحظة الزبون', 'Customer note')}</span><textarea value={note} onChange={e => setNote(e.target.value)} rows={3} /></label>
    </div>

    <section className="mo-summary" aria-label={L('ملخص الطلب', 'Order summary')}>
      <h4>{L('ملخص الطلب', 'Order summary')}</h4>
      <dl>
        <div><dt>{L('المنتجات', 'Products')} <small>({lines.reduce((n, x) => n + x.quantity, 0)} {L('قطعة', 'pcs')})</small></dt><dd>{iqd(subtotal)}</dd></div>
        {safeDiscount > 0 && <div className="is-discount"><dt>{L('الخصم', 'Discount')}</dt><dd><bdi dir="ltr">−{groupInt(Math.round(safeDiscount))}</bdi> {L('د.ع', 'IQD')}</dd></div>}
        <div><dt>{L('التوصيل', 'Delivery')} {fulfillment === 'courier' && <small>({iraqGovernorates.find(g => g.code === governorate)?.[ar ? 'nameAr' : 'nameEn']})</small>}</dt><dd>{fulfillment === 'pickup' ? L('بدون · استلام من المحل', 'None · pick-up') : delivery === null ? L('حسب المحافظة', 'By governorate') : delivery === 0 ? L('مجاني', 'Free') : iqd(delivery)}</dd></div>
      </dl>
      <div className="mo-total"><span>{L('الإجمالي', 'Total')}</span><strong>{iqd(total)}</strong></div>
      <p className="mo-pay">{paymentMethod === 'cod' ? L('الزبون يدفعها لمندوب شركة التوصيل.', 'Collected by the courier.') : paymentMethod === 'cash' ? L('نقد بالمحل.', 'Cash in the shop.') : paymentMethod === 'bank_transfer' ? L('تحويل ماستر.', 'Master transfer.') : L('دفع إلكتروني.', 'Electronic payment.')}</p>
    </section>
    {costLayers && <ProfitBox p={estimateProfit(lines, costLayers, safeDiscount)} onMaxDiscount={v => setDiscount(String(v))} />}
    <div className="admin-modal-actions">
      <button className="admin-btn admin-btn-ghost" onClick={onClose}>{L('إلغاء', 'Cancel')}</button>
      <button className="admin-btn admin-btn-primary" disabled={busy || !name || !phone || (fulfillment === 'courier' && !isWholesale && address.trim().length < 3) || !lines.length} onClick={() => void submit()}>{busy ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />} {editing ? L('حفظ التعديلات', 'Save changes') : L('إنشاء الطلب', 'Create order')}</button>
    </div>
  </Modal>;
}
