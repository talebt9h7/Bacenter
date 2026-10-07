import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { normalizeLanguage, catalogT } from '@/lib/i18n';
import { requireAdminSection } from '@/lib/admin-auth';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { products, productVariants, purchases, purchaseItems, suppliers } from '@/db/schema';
import { createPurchase, createSupplier } from './actions';
import { iqd, when } from '@/lib/format';

export const metadata = { title: 'Purchases & Suppliers' };
export default async function PurchasesPage() {
  const language = normalizeLanguage((await cookies()).get('bellroy_lang')?.value);
  const actor = await requireAdminSection('catalog', 'view');
  if (!actor) redirect('/admin');
  const [supplierRows, purchaseRows, variantRows] = await Promise.all([
    db.select().from(suppliers).orderBy(suppliers.name),
    db.select({ id: purchases.id, reference: purchases.reference, status: purchases.status, totalCostIqd: purchases.totalCostIqd, purchaseDate: purchases.purchaseDate, supplierName: suppliers.name })
      .from(purchases).leftJoin(suppliers, eq(purchases.supplierId, suppliers.id)).orderBy(desc(purchases.purchaseDate)).limit(100),
    db.select({ id: productVariants.id, name: productVariants.name, productName: products.name, stock: productVariants.stock, priceCents: products.priceCents })
      .from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).orderBy(products.name, productVariants.sortOrder),
  ]);
  return <main className="admin-page">
    <div className="admin-page-heading"><div><span className="admin-eyebrow">{catalogT('Procurement', language)}</span><h1>{catalogT('Purchases & Suppliers', language)}</h1><p>{catalogT('Record purchases, create inventory batches, and keep supplier history connected to stock.', language)}</p></div></div>
    <div className="admin-grid-2">
      <section className="admin-card"><div className="admin-card-heading"><div><span className="admin-eyebrow">{catalogT('New supplier', language)}</span><h2>{catalogT('Add supplier', language)}</h2></div></div><form action={createSupplier} className="admin-form-grid"><label>{catalogT('Name', language)}<input name="name" required placeholder={catalogT('Supplier name', language)} /></label><label>{catalogT('Phone', language)}<input name="phone" /></label><label>{catalogT('Email', language)}<input name="email" type="email" /></label><label>{catalogT('Country', language)}<input name="country" /></label><label className="full">{catalogT('Address', language)}<input name="address" /></label><label className="full">{catalogT('Notes', language)}<textarea name="notes" rows={3} /></label><div className="full"><button className="admin-btn" type="submit">{catalogT('Add supplier', language)}</button></div></form></section>
      <section className="admin-card"><div className="admin-card-heading"><div><span className="admin-eyebrow">{catalogT('Receive stock', language)}</span><h2>{catalogT('New purchase', language)}</h2></div></div><form action={createPurchase} className="admin-form-grid"><label>{catalogT('Reference', language)}<input name="reference" placeholder="PUR-001" /></label><label>{catalogT('Supplier', language)}<select name="supplierId"><option value="">{catalogT('No supplier', language)}</option>{supplierRows.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="full">{catalogT('Product / variant', language)}<select name="variantId" required><option value="">{catalogT('Select variant', language)}</option>{variantRows.map(v=><option key={v.id} value={v.id}>{v.productName} · {v.name} · stock {v.stock}</option>)}</select></label><label>{catalogT('Quantity', language)}<input name="quantity" type="number" min="1" required /></label><label>{catalogT('Purchase cost / unit (USD)', language)}<input name="purchaseCostUsd" type="number" min="0" required /></label><label>{catalogT('Sale price (IQD)', language)}<input name="salePriceIqd" type="number" min="0" placeholder="Optional" /></label><label>{catalogT('Purchase date', language)}<input name="purchaseDate" type="datetime-local" /></label><label className="full">{catalogT('Notes', language)}<textarea name="notes" rows={3} /></label><div className="full"><button className="admin-btn" type="submit">{catalogT('Receive purchase', language)}</button></div></form></section>
    </div>
    <section className="admin-card"><div className="admin-card-heading"><div><span className="admin-eyebrow">{catalogT('History', language)}</span><h2>{catalogT('Recent purchases', language)}</h2></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{catalogT('Reference', language)}</th><th>{catalogT('Supplier', language)}</th><th>{catalogT('Date', language)}</th><th>{catalogT('Status', language)}</th><th className="num">{catalogT('Total', language)}</th></tr></thead><tbody>{purchaseRows.map(p=><tr key={p.id}><td><strong>{p.reference}</strong></td><td>{p.supplierName ?? '—'}</td><td><small>{when(p.purchaseDate)}</small></td><td><span className="admin-badge success">{p.status}</span></td><td className="num">{iqd(p.totalCostIqd)}</td></tr>)}{!purchaseRows.length&&<tr><td colSpan={5}><p className="admin-empty">No purchases yet.</p></td></tr>}</tbody></table></div></section>
    <section className="admin-card"><div className="admin-card-heading"><div><span className="admin-eyebrow">{catalogT('Suppliers', language)}</span><h2>{catalogT('Supplier directory', language)}</h2></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{catalogT('Name', language)}</th><th>{catalogT('Phone', language)}</th><th>{catalogT('Country', language)}</th><th>{catalogT('Status', language)}</th></tr></thead><tbody>{supplierRows.map(s=><tr key={s.id}><td><strong>{s.name}</strong></td><td>{s.phone ?? '—'}</td><td>{s.country ?? '—'}</td><td><span className="admin-badge">{s.active ? catalogT('Active', language) : catalogT('Inactive', language)}</span></td></tr>)}</tbody></table></div></section>
  </main>;
}
