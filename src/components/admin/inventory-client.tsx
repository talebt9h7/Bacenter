'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ChevronDown, LoaderCircle, Pencil, Minus, PackagePlus, Plus, Search, Trash2, X } from 'lucide-react';
import { api, useFlash } from './ui';
import { useLanguage } from '@/components/language-provider';
import { catalogT } from '@/lib/i18n';
import { availableUnits, stockLevel } from '@/lib/stock-level';

export type InventoryRow = { variantId: number; productId: string; productName: string; category: string; color: string; hex: string; stock: number; reserved?: number; photos: number; image: string; price: number; priceIqd: number; published: boolean; knownCostIqd: number; unknownCostUnits: number ; costedUnits?: number; lastCostIqd?: number | null; sold30?: number };
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
  const [costDraft, setCostDraft] = useState<{ id: number; value: string } | null>(null);
  async function saveCost(row: InventoryRow) {
    if (!costDraft) return;
    const cost = Number(costDraft.value.replace(/[,\s]/g, ''));
    if (!Number.isFinite(cost) || cost < 0) return fail(language === 'ar' ? 'اكتب تكلفة صحيحة بالدينار.' : 'Enter a valid cost in IQD.');
    setBusy(row.variantId);
    try {
      const data = await api<{ costIqd: number; units: number }>('/api/admin/inventory/cost', { method: 'POST', json: { variantId: row.variantId, costIqd: cost } });
      setRows(current => current.map(item => item.variantId === row.variantId ? { ...item, knownCostIqd: data.costIqd * data.units, costedUnits: data.units, unknownCostUnits: 0, lastCostIqd: data.costIqd } : item));
      setCostDraft(null);
      success(language === 'ar' ? `${row.productName} · ${row.color}: التكلفة صارت ${data.costIqd.toLocaleString('en-US')} د.ع` : `${row.productName} · ${row.color}: cost is now ${data.costIqd.toLocaleString('en-US')} IQD`);
    } catch (error) { fail(error); }
    finally { setBusy(null); }
  }
  async function apply(row: InventoryRow, body: { delta?: number; set?: number }) {
    setBusy(row.variantId);
    try { const data = await api<{ stock: number }>('/api/admin/inventory', { method: 'POST', json: { variantId: row.variantId, reason, ...body } }); setRows(current => current.map(item => item.variantId === row.variantId ? { ...item, stock: data.stock } : item)); setDrafts(current => { const next = { ...current }; delete next[row.variantId]; return next; }); success(language === 'ar' ? `${row.productName} · ${row.color}: صار ${data.stock}` : `${row.productName} · ${row.color} is now ${data.stock} in stock`); router.refresh(); }
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
  const ar = language === 'ar';
  const L = (a: string, e: string) => (ar ? a : e);
  const n = (v: number) => Math.round(v).toLocaleString('en-US');
  const iqd = (v: number) => `${n(v)} ${ar ? 'د.ع' : 'IQD'}`;
  const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
  /** Per-colour figures: average cost of what is on the shelf, margin, value and how long it lasts. */
  const metric = (row: InventoryRow) => {
    const costed = row.costedUnits ?? 0;
    const unitCost = costed > 0 ? row.knownCostIqd / costed : row.lastCostIqd ?? null;
    const price = row.priceIqd || 0;
    const profit = unitCost === null || !price ? null : price - unitCost;
    const margin = profit === null || !price ? null : profit / price;
    const available = Math.max(0, row.stock - (row.reserved ?? 0));
    const perDay = (row.sold30 ?? 0) / 30;
    return { unitCost, price, profit, margin, available, costValue: unitCost === null ? 0 : unitCost * row.stock, saleValue: price * row.stock, days: perDay > 0 ? Math.floor(available / perDay) : null, level: available === 0 ? 'out' : available <= lowStockThreshold ? 'low' : 'ok' };
  };
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<'name' | 'stock' | 'value' | 'margin' | 'sold'>('name');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const categories = useMemo(() => [...new Set(rows.map(r => r.category))].sort(), [rows]);
  const summary = useMemo(() => {
    let units = 0, costValue = 0, saleValue = 0, low = 0, out = 0, noCost = 0;
    for (const row of rows) { const m = metric(row); units += row.stock; costValue += m.costValue; if (m.unitCost !== null) saleValue += m.saleValue; if (m.level === 'low') low++; if (m.level === 'out') out++; if (m.unitCost === null && row.stock > 0) noCost++; }
    return { units, costValue, saleValue, profit: saleValue - costValue, margin: saleValue ? (saleValue - costValue) / saleValue : null, low, out, noCost };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, lowStockThreshold]);
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, InventoryRow[]>();
    for (const row of rows) {
      if (category && row.category !== category) continue;
      if (q && !`${row.productName} ${row.color} ${row.productId} ${row.category}`.toLowerCase().includes(q)) continue;
      const m = metric(row);
      if (filter === 'low' && m.level !== 'low') continue;
      if (filter === 'out' && m.level !== 'out') continue;
      map.set(row.productId, [...(map.get(row.productId) ?? []), row]);
    }
    const list = [...map.values()].map(colors => {
      const ms = colors.map(metric);
      const units = colors.reduce((a, r) => a + r.stock, 0), available = ms.reduce((a, m) => a + m.available, 0);
      const costValue = ms.reduce((a, m) => a + m.costValue, 0), saleValue = ms.reduce((a, m) => a + (m.unitCost !== null ? m.saleValue : 0), 0);
      const costedUnits = colors.reduce((a, r, k) => a + (ms[k].unitCost !== null ? r.stock : 0), 0);
      const avgCost = costedUnits ? costValue / costedUnits : (ms.find(m => m.unitCost !== null)?.unitCost ?? null);
      const prices = ms.map(m => m.price).filter(Boolean);
      const price = prices.length ? Math.min(...prices) : 0;
      const margin = saleValue ? (saleValue - costValue) / saleValue : avgCost !== null && price ? (price - avgCost) / price : null;
      return { id: colors[0].productId, first: colors[0], colors, units, available, costValue, saleValue, avgCost, price, priceVaries: new Set(prices).size > 1, margin, sold: colors.reduce((a, r) => a + (r.sold30 ?? 0), 0), out: ms.filter(m => m.level === 'out').length, low: ms.filter(m => m.level === 'low').length };
    });
    const by: Record<typeof sort, (a: typeof list[number], b: typeof list[number]) => number> = { name: (a, b) => a.first.productName.localeCompare(b.first.productName), stock: (a, b) => a.available - b.available, value: (a, b) => b.costValue - a.costValue, margin: (a, b) => (a.margin ?? 9) - (b.margin ?? 9), sold: (a, b) => b.sold - a.sold };
    return list.sort(by[sort]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, filter, category, sort, lowStockThreshold]);
  const chip = (level: string, available: number) => level === 'out' ? <span className="inv-chip is-out">{L('نافد', 'Sold out')}</span> : level === 'low' ? <span className="inv-chip is-low">{L(`قليل · ${available}`, `Low · ${available}`)}</span> : <span className="inv-chip is-ok">{L('متوفر', 'In stock')}</span>;
  const marginTone = (m: number | null) => (m === null ? '' : m < 0.2 ? ' is-bad' : m < 0.35 ? ' is-mid' : ' is-good');

  return <>{flash}
    <div className="inv-kpis">
      <div className="inv-kpi"><span>{L('القطع بالمخزن', 'Units on hand')}</span><strong>{n(summary.units)}</strong><small>{L(`${rows.length} لون/قياس`, `${rows.length} colours/sizes`)}</small></div>
      <div className="inv-kpi"><span>{L('قيمة المخزون بالتكلفة', 'Stock value at cost')}</span><strong>{iqd(summary.costValue)}</strong><small>{summary.noCost ? L(`${summary.noCost} لون بدون تكلفة`, `${summary.noCost} colours without cost`) : L('كل الألوان بيها تكلفة', 'Every colour has a cost')}</small></div>
      <div className="inv-kpi"><span>{L('قيمته بسعر البيع', 'Value at sale price')}</span><strong>{iqd(summary.saleValue)}</strong><small>{L('للألوان اللي بيها تكلفة', 'Colours with a cost')}</small></div>
      <div className="inv-kpi"><span>{L('الربح المتوقع', 'Expected profit')}</span><strong>{iqd(summary.profit)}</strong><small className={`inv-margin${marginTone(summary.margin)}`}>{L('هامش', 'Margin')} {pct(summary.margin)}</small></div>
      <button type="button" className={`inv-kpi inv-kpi-alert${filter === 'low' ? ' is-on' : ''}`} onClick={() => setFilter(filter === 'low' ? 'all' : 'low')}><span>{L('مخزون قليل', 'Low stock')}</span><strong>{summary.low}</strong><small>{L(`≤ ${lowStockThreshold} قطع · اضغط للعرض`, `≤ ${lowStockThreshold} units · tap to show`)}</small></button>
      <button type="button" className={`inv-kpi inv-kpi-out${filter === 'out' ? ' is-on' : ''}`} onClick={() => setFilter(filter === 'out' ? 'all' : 'out')}><span>{L('نافد', 'Sold out')}</span><strong>{summary.out}</strong><small>{L('لون/قياس · اضغط للعرض', 'colours · tap to show')}</small></button>
    </div>

    <section className="admin-card inv-card">
      <div className="inv-toolbar">
        <label className="admin-search"><Search size={16} /><input placeholder={L('ابحث بالمنتج أو اللون…', 'Search product or colour…')} value={query} onChange={e => setQuery(e.target.value)} aria-label={L('بحث المخزون', 'Search inventory')} /></label>
        <select value={category} onChange={e => setCategory(e.target.value)} aria-label={L('التصنيف', 'Category')}><option value="">{L('كل التصنيفات', 'All categories')}</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)} aria-label={L('الحالة', 'Status')}><option value="all">{L('كل الحالات', 'Every status')}</option><option value="low">{L('قليل', 'Low')}</option><option value="out">{L('نافد', 'Sold out')}</option></select>
        <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} aria-label={L('الترتيب', 'Sort')}><option value="name">{L('ترتيب: الاسم', 'Sort: name')}</option><option value="stock">{L('ترتيب: الأقل متوفر', 'Sort: least available')}</option><option value="value">{L('ترتيب: الأعلى قيمة', 'Sort: highest value')}</option><option value="margin">{L('ترتيب: الأقل ربحاً', 'Sort: lowest margin')}</option><option value="sold">{L('ترتيب: الأكثر بيعاً', 'Sort: best selling')}</option></select>
        <label className="inv-reason"><span>{L('سبب التعديل', 'Adjustment reason')}</span><select value={reason} onChange={e => setReason(e.target.value)}>{[['Stock count', L('جرد', 'Stock count')], ['Damaged', L('تالف', 'Damaged')], ['Returned by customer', L('مرتجع من زبون', 'Returned')], ['Transfer', L('نقل', 'Transfer')], ['Correction', L('تصحيح', 'Correction')]].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      </div>

      <div className="admin-table-wrap"><table className="admin-table inv-table">
        <thead><tr>
          <th>{L('المنتج', 'Product')}</th><th className="num">{L('المتوفر', 'Available')}</th><th className="num">{L('التكلفة/قطعة', 'Cost/unit')}</th><th className="num">{L('سعر البيع', 'Sale price')}</th><th className="num">{L('الربح/قطعة', 'Profit/unit')}</th><th className="num">{L('الهامش', 'Margin')}</th><th className="num">{L('قيمة المخزون', 'Stock value')}</th><th className="num">{L('مبيع 30 يوم', 'Sold 30d')}</th><th>{L('الحالة', 'Status')}</th><th />
        </tr></thead>
        {groups.map(g => { const isOpen = open[g.id] ?? (g.colors.length === 1); const profit = g.avgCost !== null && g.price ? g.price - g.avgCost : null; return <tbody key={g.id} className={`inv-group${isOpen ? ' is-open' : ''}`}>
          <tr className="inv-product" onClick={() => setOpen(o => ({ ...o, [g.id]: !isOpen }))}>
            <td><div className="admin-product-cell"><img src={g.first.image} alt="" /><div><strong>{g.first.productName}</strong><small>{g.first.category} · {L(`${g.colors.length} لون`, `${g.colors.length} colours`)}{!g.first.published && L(' · مسودة', ' · draft')}</small></div></div></td>
            <td className="num"><b>{n(g.available)}</b>{g.units !== g.available && <small>{L(`من ${n(g.units)}`, `of ${n(g.units)}`)}</small>}</td>
            <td className="num">{g.avgCost === null ? <span className="inv-missing">{L('بدون تكلفة', 'No cost')}</span> : iqd(g.avgCost)}</td>
            <td className="num">{g.price ? <>{g.priceVaries && <small>{L('من', 'from')}</small>}{iqd(g.price)}</> : '—'}</td>
            <td className="num">{profit === null ? '—' : iqd(profit)}</td>
            <td className="num"><span className={`inv-margin${marginTone(g.margin)}`}>{pct(g.margin)}</span></td>
            <td className="num">{iqd(g.costValue)}</td>
            <td className="num">{g.sold || '—'}</td>
            <td>{g.out ? <span className="inv-chip is-out">{L(`${g.out} نافد`, `${g.out} out`)}</span> : g.low ? <span className="inv-chip is-low">{L(`${g.low} قليل`, `${g.low} low`)}</span> : <span className="inv-chip is-ok">{L('متوفر', 'In stock')}</span>}</td>
            <td><button type="button" className="inv-toggle" aria-expanded={isOpen} aria-label={L('عرض الألوان', 'Show colours')}><ChevronDown size={17} /></button></td>
          </tr>
          {isOpen && g.colors.map(row => { const m = metric(row); const draft = drafts[row.variantId] ?? ''; return <tr key={row.variantId} className="inv-variant">
            <td><div className="inv-color"><span className="admin-swatch" style={{ background: row.hex }} /><span>{row.color}</span>{row.photos === 0 && <small className="inv-missing">{L('بدون صور', 'No photos')}</small>}</div></td>
            <td className="num"><b>{n(m.available)}</b>{(row.reserved ?? 0) > 0 && <small>{L(`${row.reserved} محجوز`, `${row.reserved} reserved`)}</small>}</td>
            <td className="num">{costDraft?.id === row.variantId
              ? <span className="inv-cost-edit"><input autoFocus type="text" inputMode="numeric" value={costDraft.value} onChange={e => setCostDraft({ id: row.variantId, value: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') void saveCost(row); if (e.key === 'Escape') setCostDraft(null); }} aria-label={L('التكلفة للقطعة بالدينار', 'Cost per unit in IQD')} placeholder="15000" /><button type="button" className="admin-btn admin-btn-primary admin-btn-sm" disabled={busy === row.variantId} onClick={() => void saveCost(row)}>{L('حفظ', 'Save')}</button><button type="button" className="admin-icon-btn" onClick={() => setCostDraft(null)} aria-label={L('إلغاء', 'Cancel')}><X size={14} /></button></span>
              : <button type="button" className={`inv-cost-btn${m.unitCost === null ? ' is-missing' : ''}`} onClick={() => setCostDraft({ id: row.variantId, value: m.unitCost === null ? '' : String(Math.round(m.unitCost)) })} title={L('اضغط لإضافة أو تعديل التكلفة', 'Tap to add or change the cost')}>{m.unitCost === null ? L('+ أضف تكلفة', '+ Add cost') : iqd(m.unitCost)}<Pencil size={12} /></button>}</td>
            <td className="num">{m.price ? iqd(m.price) : '—'}</td>
            <td className="num">{m.profit === null ? '—' : iqd(m.profit)}</td>
            <td className="num"><span className={`inv-margin${marginTone(m.margin)}`}>{pct(m.margin)}</span></td>
            <td className="num">{iqd(m.costValue)}</td>
            <td className="num">{row.sold30 || '—'}{m.days !== null && <small>{L(`يكفي ${m.days} يوم`, `${m.days} days left`)}</small>}</td>
            <td>{chip(m.level, m.available)}</td>
            <td><div className="inv-actions">
              <button type="button" className="admin-icon-btn" aria-label={L('نقص قطعة', 'Remove one')} disabled={busy === row.variantId || row.stock <= 0} onClick={() => void apply(row, { delta: -1 })}><Minus size={14} /></button>
              <input type="number" min="0" inputMode="numeric" value={draft} placeholder={String(row.stock)} onChange={e => setDrafts(d => ({ ...d, [row.variantId]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter' && draft !== '') { void apply(row, { set: Number(draft) }); setDrafts(d => ({ ...d, [row.variantId]: '' })); } }} aria-label={L('العدد الفعلي', 'Exact count')} title={L('اكتب العدد الفعلي واضغط Enter', 'Type the exact count and press Enter')} />
              <button type="button" className="admin-icon-btn" aria-label={L('زيد قطعة', 'Add one')} disabled={busy === row.variantId} onClick={() => void apply(row, { delta: 1 })}><Plus size={14} /></button>
              <button type="button" className="admin-icon-btn" onClick={() => openReceiveBatch(row)} aria-label={L('استلام وجبة جديدة بتكلفتها', 'Receive a new batch with its cost')} title={L('استلام وجبة جديدة بتكلفتها', 'Receive a new batch with its cost')}><PackagePlus size={15} /></button>
              <Link className="admin-icon-btn" href={`/admin/products/${row.productId}`} aria-label={L('تعديل المنتج', 'Edit product')} title={L('تعديل المنتج', 'Edit product')}><Pencil size={14} /></Link>
            </div></td>
          </tr>; })}
        </tbody>; })}
        {!groups.length && <tbody><tr><td colSpan={10}><p className="admin-empty">{L('ماكو منتجات بهذا البحث.', 'No products match.')}</p></td></tr></tbody>}
      </table></div>
      <p className="inv-foot">{L('اضغط على تكلفة أي لون حتى تضيفها أو تعدلها، وتنطبق على القطع الموجودة هسه (القطع المباعة تبقى بتكلفتها القديمة). التكلفة = متوسط تكلفة الشراء للقطع الموجودة (مع الشحن والجمرك إذا انحسبت بالمشتريات). الهامش = الربح ÷ سعر البيع. «يكفي» = المتوفر ÷ معدل البيع اليومي آخر 30 يوم.', 'Tap a colour\'s cost to add or change it; it applies to the units on hand (sold units keep their old cost). Cost = average purchase cost of the units on hand (landed, when entered through purchases). Margin = profit ÷ sale price. "Days left" = available ÷ daily sales over the last 30 days.')}</p>
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
