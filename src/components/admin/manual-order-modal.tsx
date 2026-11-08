'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';
import { api, Modal, useFlash } from './ui';
import { useLanguage } from '@/components/language-provider';
import { iraqGovernorates } from '@/lib/iraq';
import { groupInt } from '@/lib/number-format';

type CatalogRow = { variantId: number; productId: string; productName: string; productNameAr?: string; color: string; colorAr?: string; stock: number; priceCents: number; salePriceIqd: number; image: string | null; published: boolean };
type ManualLine = CatalogRow & { quantity: number; unitPrice: number };

/** Admin → Orders → "Add manual order": an order taken by phone, Instagram, WhatsApp or in the shop. */
export function ManualOrderModal({ catalog, onClose }: { catalog: CatalogRow[]; onClose: () => void }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const L = (a: string, e: string) => (ar ? a : e);
  const iqd = (n: number) => (ar ? `${groupInt(Math.round(n))} د.ع` : `${groupInt(Math.round(n))} IQD`);
  const productName = (row: CatalogRow) => (ar ? row.productNameAr || row.productName : row.productName);
  const colorName = (row: CatalogRow) => (ar ? row.colorAr || row.color : row.color);
  const router = useRouter();
  const [name, setName] = useState(''), [phone, setPhone] = useState(''), [governorate, setGovernorate] = useState('baghdad'), [city, setCity] = useState(''), [address, setAddress] = useState(''), [landmark, setLandmark] = useState('');
  const [source, setSource] = useState('instagram'), [sourceNote, setSourceNote] = useState(''), [paymentMethod, setPaymentMethod] = useState('cod'), [paymentStatus, setPaymentStatus] = useState('unpaid'), [shipping, setShipping] = useState(''), [discount, setDiscount] = useState('0'), [note, setNote] = useState(''), [selected, setSelected] = useState('');
  const [lines, setLines] = useState<ManualLine[]>([]), [busy, setBusy] = useState(false);
  const { flash, fail } = useFlash();
  const addLine = () => { const row = catalog.find(x => x.variantId === Number(selected)); if (!row || lines.some(x => x.variantId === row.variantId)) return; setLines(v => [...v, { ...row, quantity: 1, unitPrice: row.salePriceIqd }]); setSelected(''); };
  const subtotal = lines.reduce((s, x) => s + x.unitPrice * x.quantity, 0), safeDiscount = Math.min(Math.max(0, Number(discount) || 0), subtotal), delivery = shipping === '' ? null : Math.max(0, Number(shipping) || 0), total = Math.max(0, subtotal - safeDiscount) + (delivery ?? 0);
  async function submit() { setBusy(true); try { const data = await api<{ id: number }>('/api/admin/orders/manual', { method: 'POST', json: { name, phone, governorate, city, address, landmark, source, sourceNote, paymentMethod, paymentStatus, shipping: delivery, discount: safeDiscount, note, items: lines.map(x => ({ variantId: x.variantId, quantity: x.quantity, unitPrice: x.unitPrice })) } }); router.push(`/admin/orders/${data.id}`); } catch (e) { fail(e); setBusy(false); } }
  const picked = selected ? catalog.find(x => x.variantId === Number(selected)) : undefined;

  return <Modal title={L('إضافة طلب يدوي', 'Add manual order')} onClose={onClose} wide>{flash}
    <div className="admin-form-grid">
      <label className="admin-field"><span>{L('اسم الزبون *', 'Customer name *')}</span><input value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="admin-field"><span>{L('رقم الهاتف *', 'Phone *')}</span><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0770 123 4567" inputMode="tel" dir="ltr" /></label>
      <label className="admin-field"><span>{L('مصدر الطلب *', 'Order source *')}</span><select value={source} onChange={e => setSource(e.target.value)}>
        <option value="instagram">{L('إنستغرام', 'Instagram')}</option><option value="whatsapp">{L('واتساب', 'WhatsApp')}</option><option value="facebook">{L('فيسبوك', 'Facebook')}</option><option value="phone">{L('اتصال هاتفي', 'Phone call')}</option><option value="store">{L('من المحل', 'In store')}</option><option value="other">{L('غير ذلك', 'Other')}</option>
      </select></label>
      <label className="admin-field"><span>{L('ملاحظة عن المصدر', 'Source note')}</span><input value={sourceNote} onChange={e => setSourceNote(e.target.value)} placeholder={L('مثلاً: رسالة خاص / اسم الحساب / الحملة', 'DM / username / campaign')} /></label>
      <label className="admin-field"><span>{L('المحافظة *', 'Governorate *')}</span><select value={governorate} onChange={e => setGovernorate(e.target.value)}>{iraqGovernorates.map(g => <option key={g.code} value={g.code}>{ar ? g.nameAr : g.nameEn}</option>)}</select></label>
      <label className="admin-field"><span>{L('المدينة / المنطقة *', 'City / district *')}</span><input value={city} onChange={e => setCity(e.target.value)} /></label>
      <label className="admin-field admin-field-full"><span>{L('العنوان بالتفصيل *', 'Detailed address *')}</span><input value={address} onChange={e => setAddress(e.target.value)} /></label>
      <label className="admin-field"><span>{L('أقرب نقطة دالة', 'Landmark')}</span><input value={landmark} onChange={e => setLandmark(e.target.value)} /></label>
    </div>

    <section className="admin-card" style={{ marginTop: 18 }}>
      <div className="admin-card-heading"><h3>{L('المنتجات', 'Products')}</h3></div>
      <div className="admin-toolbar admin-product-picker">
        <select value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">{L('اختر المنتج / اللون…', 'Choose product / color…')}</option>
          {catalog.filter(x => x.published && x.stock > 0).map(x => <option key={x.variantId} value={x.variantId}>{productName(x)} · {colorName(x)} · {L(`المتوفر ${x.stock}`, `stock ${x.stock}`)}</option>)}
        </select>
        <button type="button" className="admin-btn admin-btn-primary" onClick={addLine} disabled={!selected}><Plus size={15} />{L('إضافة المنتج', 'Add product')}</button>
      </div>
      {picked && <div className="admin-selected-product"><img src={picked.image || '/placeholder.svg'} alt="" /><div><strong>{productName(picked)}</strong><span>{colorName(picked)} · {L(`المتوفر ${picked.stock}`, `${picked.stock} in stock`)} · {iqd(picked.salePriceIqd)}</span></div></div>}
      {lines.length > 0 && <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>{L('المنتج', 'Product')}</th><th>{L('الكمية', 'Qty')}</th><th>{L('سعر القطعة', 'Unit price')}</th><th>{L('المجموع', 'Total')}</th><th /></tr></thead>
        <tbody>{lines.map((line, i) => <tr key={line.variantId}>
          <td><div className="admin-product-cell"><img src={line.image || '/placeholder.svg'} alt="" /><div><strong>{productName(line)}</strong><small>{colorName(line)} · {L(`المتوفر ${line.stock}`, `${line.stock} in stock`)}</small></div></div></td>
          <td><input type="number" min="1" max={line.stock} value={line.quantity} onChange={e => setLines(v => v.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Math.min(x.stock, Number(e.target.value) || 1)) } : x)))} style={{ width: 80 }} aria-label={L('الكمية', 'Quantity')} /></td>
          <td><input type="number" min="0" step="250" value={line.unitPrice} onChange={e => setLines(v => v.map((x, j) => (j === i ? { ...x, unitPrice: Math.max(0, Number(e.target.value) || 0) } : x)))} style={{ width: 120 }} aria-label={L('سعر القطعة', 'Unit price')} /></td>
          <td>{iqd(line.unitPrice * line.quantity)}</td>
          <td><button type="button" className="admin-icon-btn" aria-label={L('حذف', 'Remove')} onClick={() => setLines(v => v.filter((_, j) => j !== i))}><Trash2 size={15} /></button></td>
        </tr>)}</tbody>
      </table></div>}
    </section>

    <div className="admin-form-grid" style={{ marginTop: 18 }}>
      <label className="admin-field"><span>{L('أجور التوصيل', 'Delivery')}</span><input type="number" min="0" step="500" value={shipping} onChange={e => setShipping(e.target.value)} placeholder={L('فارغ = حسب سعر المحافظة', 'Empty = governorate rate')} /></label>
      <label className="admin-field"><span>{L('الخصم', 'Discount')}</span><input type="number" min="0" step="250" value={discount} onChange={e => setDiscount(e.target.value)} /></label>
      <label className="admin-field"><span>{L('طريقة الدفع', 'Payment')}</span><select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
        <option value="cod">{L('الدفع عند الاستلام', 'Cash on delivery')}</option><option value="cash">{L('نقداً', 'Cash')}</option><option value="bank_transfer">{L('تحويل بنكي', 'Bank transfer')}</option><option value="electronic">{L('دفع إلكتروني', 'Electronic')}</option>
      </select></label>
      <label className="admin-field"><span>{L('حالة الدفع', 'Payment status')}</span><select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}><option value="unpaid">{L('غير مدفوع', 'Unpaid')}</option><option value="paid">{L('مدفوع', 'Paid')}</option></select></label>
      <label className="admin-field admin-field-full"><span>{L('ملاحظة الزبون', 'Customer note')}</span><textarea value={note} onChange={e => setNote(e.target.value)} rows={3} /></label>
    </div>

    <div className="admin-alert info" style={{ marginTop: 16 }}>
      <strong>{L('المنتجات', 'Products')}: {iqd(subtotal)}</strong>
      {safeDiscount > 0 && <> · {L('الخصم', 'Discount')}: {iqd(safeDiscount)}</>}
      {' · '}{L('التوصيل', 'Delivery')}: {delivery === null ? L('حسب سعر المحافظة', 'governorate rate') : iqd(delivery)}
      {' · '}<strong>{L('الإجمالي', 'Total')}: {iqd(total)}{delivery === null ? L(' + التوصيل', ' + delivery') : ''}</strong>
      <br /><small>{L('الربح يُحسب تلقائياً من (سعر البيع − سعر الشراء) لكل قطعة.', 'Profit is worked out per item from sale price minus cost.')}</small>
    </div>
    <div className="admin-modal-actions">
      <button className="admin-btn admin-btn-ghost" onClick={onClose}>{L('إلغاء', 'Cancel')}</button>
      <button className="admin-btn admin-btn-primary" disabled={busy || !name || !phone || !city || !address || !lines.length} onClick={() => void submit()}>{busy ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />} {L('إنشاء الطلب', 'Create order')}</button>
    </div>
  </Modal>;
}
