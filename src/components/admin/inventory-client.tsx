'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Download, LoaderCircle, Minus, Plus, Search, Trash2, X } from 'lucide-react';
import { api, useFlash } from './ui';
import { useLanguage } from '@/components/language-provider';
import { catalogT } from '@/lib/i18n';

export type InventoryRow = { variantId: number; productId: string; productName: string; category: string; color: string; hex: string; stock: number; photos: number; image: string; price: number; priceIqd: number; published: boolean; knownCostIqd: number; unknownCostUnits: number };
export function InventoryTable({ rows: initialRows, lowStockThreshold, exchangeRate }: { rows: InventoryRow[]; lowStockThreshold: number; exchangeRate: number }) {
  const { language } = useLanguage();
  const tr = (label: keyof typeof import('@/lib/i18n').catalogTranslations) => catalogT(label, language);
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [reason, setReason] = useState('Stock count');
  const [busy, setBusy] = useState<number | null>(null);
  const [purchaseRow, setPurchaseRow] = useState<InventoryRow | null>(null);
  const [purchase, setPurchase] = useState({ purchasePriceUsd: '', batchNumber: '', notes: '' });
  const [purchaseLines, setPurchaseLines] = useState<Record<number, string>>({});
  const [newColors, setNewColors] = useState<Array<{ id: number; name: string; hex: string; quantity: string }>>([]);
  const [newColorDraft, setNewColorDraft] = useState({ name: '', hex: '#8b6f47', quantity: '' });
  const { flash, success, fail } = useFlash();
  const visible = useMemo(() => rows.filter(row => (filter === 'all' || (filter === 'low' ? row.stock > 0 && row.stock <= lowStockThreshold : row.stock === 0)) && (!query || `${row.productName} ${row.color} ${row.productId} ${row.category}`.toLowerCase().includes(query.toLowerCase()))), [rows, filter, query, lowStockThreshold]);
  const totals = useMemo(() => ({ units: rows.reduce((sum, row) => sum + row.stock, 0), knownCost: rows.reduce((sum, row) => sum + row.knownCostIqd, 0), unknownUnits: rows.reduce((sum, row) => sum + row.unknownCostUnits, 0), low: rows.filter(row => row.stock > 0 && row.stock <= lowStockThreshold).length, out: rows.filter(row => row.stock === 0).length }), [rows, lowStockThreshold]);
  async function apply(row: InventoryRow, body: { delta?: number; set?: number }) {
    setBusy(row.variantId);
    try { const data = await api<{ stock: number }>('/api/admin/inventory', { method: 'POST', json: { variantId: row.variantId, reason, ...body } }); setRows(current => current.map(item => item.variantId === row.variantId ? { ...item, stock: data.stock } : item)); setDrafts(current => { const next = { ...current }; delete next[row.variantId]; return next; }); success(`${row.productName} · ${row.color} is now ${data.stock} in stock.`); router.refresh(); }
    catch (error) { fail(error); }
    finally { setBusy(null); }
  }
  function openReceiveBatch(row: InventoryRow) {
    const productRows = rows.filter(item => item.productId === row.productId);
    setPurchaseRow(row);
    setPurchase({ purchasePriceUsd: '', batchNumber: '', notes: '' });
    setPurchaseLines(Object.fromEntries(productRows.map(item => [item.variantId, ''])));
    setNewColors([]);
    setNewColorDraft({ name: '', hex: '#8b6f47', quantity: '' });
  }
  function closeReceiveBatch() {
    setPurchaseRow(null);
    setPurchase({ purchasePriceUsd: '', batchNumber: '', notes: '' });
    setPurchaseLines({});
    setNewColors([]);
    setNewColorDraft({ name: '', hex: '#8b6f47', quantity: '' });
  }
  function addNewColor() {
    const name = newColorDraft.name.trim();
    const quantity = Number(newColorDraft.quantity);
    if (!name) return fail(language === 'ar' ? 'اكتب اسم اللون الجديد.' : 'Enter the new color name.');
    if (!Number.isInteger(quantity) || quantity <= 0) return fail(language === 'ar' ? 'أدخل كمية صحيحة للون الجديد.' : 'Enter a valid quantity for the new color.');
    if (purchaseRow && rows.some(item => item.productId === purchaseRow.productId && item.color.trim().toLowerCase() === name.toLowerCase())) return fail(language === 'ar' ? 'هذا اللون موجود مسبقاً ضمن المنتج.' : 'This color already exists for this product.');
    if (newColors.some(item => item.name.trim().toLowerCase() === name.toLowerCase())) return fail(language === 'ar' ? 'أضفت هذا اللون بالفعل.' : 'You already added this color.');
    setNewColors(current => [...current, { id: Date.now(), name, hex: newColorDraft.hex || '#8b6f47', quantity: String(quantity) }]);
    setNewColorDraft({ name: '', hex: '#8b6f47', quantity: '' });
  }
  async function receiveBatch() {
    if (!purchaseRow) return;
    const purchasePriceUsd = Number(purchase.purchasePriceUsd);
    const existingLines = Object.entries(purchaseLines).map(([variantId, quantity]) => ({ variantId: Number(variantId), quantity: Number(quantity) })).filter(line => line.quantity > 0);
    const createdLines = newColors.map(item => ({ name: item.name.trim(), hex: item.hex, quantity: Number(item.quantity) }));
    if (!existingLines.length && !createdLines.length) return fail(language === 'ar' ? 'أدخل كمية لون واحد على الأقل.' : 'Enter a quantity for at least one color.');
    if (!Number.isFinite(purchasePriceUsd) || purchasePriceUsd < 0) return fail(language === 'ar' ? 'أدخل تكلفة الشراء للوحدة بالدولار الأمريكي.' : 'Enter the purchase cost per unit in USD.');
    if (existingLines.some(line => !Number.isInteger(line.quantity) || line.quantity <= 0) || createdLines.some(line => !Number.isInteger(line.quantity) || line.quantity <= 0)) return fail(language === 'ar' ? 'كل الكميات يجب أن تكون أرقاماً صحيحة أكبر من صفر.' : 'All quantities must be whole numbers greater than zero.');
    setBusy(purchaseRow.variantId);
    try {
      const data = await api<{ rows: Array<{ variantId: number; stock: number; color: string }>; createdVariants: number[] }>('/api/admin/inventory', { method: 'POST', json: { productId: purchaseRow.productId, reason: 'Purchase received', lines: existingLines, newColors: createdLines, purchasePriceUsd, batchNumber: purchase.batchNumber, notes: purchase.notes, exchangeRate } });
      setRows(current => {
        let next = [...current];
        for (const item of data.rows) {
          const index = next.findIndex(row => row.variantId === item.variantId);
          if (index >= 0) next[index] = { ...next[index], stock: item.stock };
          else next.push({ variantId: item.variantId, productId: purchaseRow.productId, productName: purchaseRow.productName, category: purchaseRow.category, color: item.color, hex: createdLines.find(color => color.name === item.color)?.hex || '#8b6f47', stock: item.stock, photos: 0, image: purchaseRow.image, price: purchaseRow.price, priceIqd: purchaseRow.priceIqd, published: purchaseRow.published, knownCostIqd: 0, unknownCostUnits: 0 });
        }
        return next;
      });
      success(language === 'ar' ? `تم استلام الوجبة وإضافة ${existingLines.length + createdLines.length} لون.` : `Batch received across ${existingLines.length + createdLines.length} colors.`);
      closeReceiveBatch();
      router.refresh();
    } catch (error) { fail(error); }
    finally { setBusy(null); }
  }
  function exportCsv() { const header = 'product,handle,color,stock,known_cost_iqd,unknown_cost_units,category'; const lines = rows.map(row => [row.productName, row.productId, row.color, row.stock, row.knownCostIqd, row.unknownCostUnits, row.category].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')); const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href); }
  return <>{flash}
    <div className="admin-stats admin-stats-4"><div className="admin-stat"><strong>{totals.units.toLocaleString('en-US')}</strong><span>{tr('Units on hand')}</span></div><div className="admin-stat"><strong>{totals.knownCost.toLocaleString('en-US')} IQD</strong><span>{tr('Known stock cost')}</span>{totals.unknownUnits > 0 && <small>{totals.unknownUnits.toLocaleString('en-US')} {tr('units have no historical cost')}</small>}</div><div className="admin-stat"><strong>{totals.low}</strong><span>{tr('Low stock colors')}</span><small>≤ {lowStockThreshold} units</small></div><div className="admin-stat"><strong>{totals.out}</strong><span>{tr('Sold out colors')}</span></div></div>
    <section className="admin-card"><div className="admin-toolbar"><label className="admin-search"><Search size={16} /><input placeholder={tr('Search product or color…')} value={query} onChange={event => setQuery(event.target.value)} aria-label={tr('Search inventory')} /></label><div className="admin-segmented" role="tablist">{([['all', tr('All')], ['low', tr('Low')], ['out', tr('Sold out')]] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={filter === key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div><label className="admin-reason"><span>{tr('Reason')}</span><select value={reason} onChange={event => setReason(event.target.value)}>{[['Stock count', tr('Stock count')], ['Damaged', tr('Damaged')], ['Returned by customer', tr('Returned by customer')], ['Transfer', tr('Transfer')], ['Correction', tr('Correction')]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={exportCsv}><Download size={14} /> {tr('CSV')}</button></div>
      <div className="admin-table-wrap"><table className="admin-table admin-inventory-table"><thead><tr><th>{tr('Product')}</th><th>{tr('Color')}</th><th className="num">{tr('On hand')}</th><th>{tr('Adjust')}</th><th>{tr('Purchase')}</th><th>{tr('Set exact')}</th></tr></thead><tbody>{visible.map(row => { const level = row.stock === 0 ? 'danger' : row.stock <= lowStockThreshold ? 'warning' : 'success'; return <tr key={row.variantId}><td><div className="admin-product-cell"><img src={row.image} alt="" /><div><strong>{row.productName}</strong><small>{row.category}{!row.published && ' · draft'}</small></div></div></td><td><span className="admin-swatch" style={{ background: row.hex }} /> {row.color}</td><td className="num"><span className={`admin-badge ${level}`}>{row.stock}</span></td><td><div className="admin-inline-stepper"><button aria-label="Remove one" disabled={busy === row.variantId || row.stock === 0} onClick={() => void apply(row, { delta: -1 })}><Minus size={13} /></button></div></td><td><button className="admin-btn admin-btn-primary admin-btn-sm" disabled={busy === row.variantId} onClick={() => openReceiveBatch(row)}>{tr('Receive batch')}</button></td><td><form className="admin-set-form" onSubmit={event => { event.preventDefault(); const value = Number(drafts[row.variantId]); if (!Number.isInteger(value) || value < 0) return; if (value > row.stock) { openReceiveBatch(row); setPurchaseLines(current => ({ ...current, [row.variantId]: String(value - row.stock) })); } else void apply(row, { set: value }); }}><input type="number" min="0" placeholder={String(row.stock)} value={drafts[row.variantId] ?? ''} onChange={event => setDrafts(current => ({ ...current, [row.variantId]: event.target.value }))} aria-label={`Set stock for ${row.productName} ${row.color}`} /><button className="admin-btn admin-btn-ghost admin-btn-sm" disabled={busy === row.variantId}>{tr('Set')}</button></form></td></tr>; })}{!visible.length && <tr><td colSpan={6}><p className="admin-empty">{tr('No inventory matches that filter.')}</p></td></tr>}</tbody></table></div>
    </section>
    {purchaseRow && <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeReceiveBatch(); }}><section className="admin-card" style={{ width: 'min(860px, calc(100vw - 32px))', maxHeight: '90vh', overflowY: 'auto', margin: 'auto' }} role="dialog" aria-modal="true">
      <div className="admin-card-heading"><div><span className="admin-eyebrow">{language === 'ar' ? 'استلام وجبة جديدة' : 'Receive new batch'}</span><h2>{purchaseRow.productName}</h2></div><button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={closeReceiveBatch}><X size={14} /></button></div>
      <p style={{ marginTop: 0 }}>{language === 'ar' ? 'اختر ألوان الوجبة وكميات كل لون. الألوان الموجودة تُزاد كميتها، والألوان الجديدة تُنشأ تلقائياً. سعر البيع لا يُدخل هنا لأنه تابع للمنتج.' : 'Enter each color quantity. Existing colors receive more stock; new colors are created automatically. Sale price is managed at product level.'}</p>
      <div className="admin-form-grid admin-form-grid-2">
        <label className="admin-field"><span>{language === 'ar' ? 'تكلفة الشراء / قطعة (USD)' : 'Purchase cost / unit (USD)'}</span><input type="number" min="0" step="0.01" value={purchase.purchasePriceUsd} onChange={e => setPurchase(v => ({ ...v, purchasePriceUsd: e.target.value }))} placeholder="13.00" /></label>
        <label className="admin-field"><span>{language === 'ar' ? 'سعر الصرف وقت الشراء' : 'Exchange rate at purchase'}</span><input value={exchangeRate.toLocaleString('en-US')} disabled /></label>
        <label className="admin-field span-2"><span>{language === 'ar' ? 'رقم الوجبة / الشحنة' : 'Batch / shipment reference'}</span><input value={purchase.batchNumber} onChange={e => setPurchase(v => ({ ...v, batchNumber: e.target.value }))} placeholder="TR-2026-09" /></label>
      </div>
      <div style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 18 }}>
        <div className="admin-card-heading" style={{ marginBottom: 10 }}><div><h3 style={{ margin: 0 }}>{language === 'ar' ? 'ألوان المنتج الحالية' : 'Current product colors'}</h3><small>{language === 'ar' ? 'أدخل الكمية فقط للألوان الموجودة في هذه الوجبة.' : 'Enter quantity only for colors included in this batch.'}</small></div></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{language === 'ar' ? 'اللون' : 'Color'}</th><th className="num">{language === 'ar' ? 'المخزون الحالي' : 'Current stock'}</th><th className="num">{language === 'ar' ? 'كمية الوجبة' : 'Batch quantity'}</th></tr></thead><tbody>{rows.filter(row => row.productId === purchaseRow.productId).map(row => <tr key={row.variantId}><td><span className="admin-swatch" style={{ background: row.hex }} /> {row.color}</td><td className="num">{row.stock}</td><td className="num"><input style={{ width: 120 }} type="number" min="0" value={purchaseLines[row.variantId] ?? ''} onChange={e => setPurchaseLines(current => ({ ...current, [row.variantId]: e.target.value }))} placeholder="0" /></td></tr>)}</tbody></table></div>
      </div>
      <div style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 18 }}>
        <div className="admin-card-heading" style={{ marginBottom: 10 }}><div><h3 style={{ margin: 0 }}>{language === 'ar' ? 'إضافة ألوان جديدة' : 'Add new colors'}</h3><small>{language === 'ar' ? 'إذا وصل لون غير موجود، أضفه هنا وسيُنشأ كـ Variant جديد لنفس المنتج.' : 'New colors are created as variants under the same product.'}</small></div></div>
        <div className="admin-form-grid admin-form-grid-3">
          <label className="admin-field"><span>{language === 'ar' ? 'اسم اللون' : 'Color name'}</span><input value={newColorDraft.name} onChange={e => setNewColorDraft(v => ({ ...v, name: e.target.value }))} placeholder={language === 'ar' ? 'أخضر' : 'Green'} /></label>
          <label className="admin-field"><span>{language === 'ar' ? 'لون العرض' : 'Display color'}</span><input type="color" value={newColorDraft.hex} onChange={e => setNewColorDraft(v => ({ ...v, hex: e.target.value }))} style={{ minHeight: 42, padding: 4 }} /></label>
          <label className="admin-field"><span>{language === 'ar' ? 'الكمية' : 'Quantity'}</span><input type="number" min="1" value={newColorDraft.quantity} onChange={e => setNewColorDraft(v => ({ ...v, quantity: e.target.value }))} placeholder="7" /></label>
        </div>
        <button className="admin-btn admin-btn-ghost admin-btn-sm" style={{ marginTop: 10 }} onClick={addNewColor}><Plus size={14} /> {language === 'ar' ? 'إضافة اللون للوجبة' : 'Add color to batch'}</button>
        {newColors.length > 0 && <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>{newColors.map(color => <div key={color.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10 }}><div><span className="admin-swatch" style={{ background: color.hex }} /> <strong>{color.name}</strong> <small>· {color.quantity} {language === 'ar' ? 'قطعة' : 'units'}</small></div><button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setNewColors(current => current.filter(item => item.id !== color.id))}><Trash2 size={14} /></button></div>)}</div>}
      </div>
      <label className="admin-field" style={{ marginTop: 18 }}><span>{language === 'ar' ? 'ملاحظات' : 'Notes'}</span><textarea rows={3} value={purchase.notes} onChange={e => setPurchase(v => ({ ...v, notes: e.target.value }))} placeholder={language === 'ar' ? 'المورد، الفاتورة، الشحنة...' : 'Supplier, invoice, shipment...' } /></label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}><button className="admin-btn admin-btn-ghost" onClick={closeReceiveBatch}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</button><button className="admin-btn admin-btn-primary" disabled={busy === purchaseRow.variantId} onClick={() => void receiveBatch()}>{busy === purchaseRow.variantId ? <LoaderCircle size={15} className="spin" /> : null} {language === 'ar' ? 'حفظ الوجبة' : 'Save batch'}</button></div>
    </section></div>}
  </>;
}
