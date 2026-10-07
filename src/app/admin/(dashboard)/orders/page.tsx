import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { orders, productVariants, products } from '@/db/schema';
import { OrdersTable, type OrderRow } from '@/components/admin/orders-client';
import { getSettings } from '@/lib/settings';
import { roundIqd } from '@/lib/iraq';

export const metadata = { title: 'Orders' };
export default async function AdminOrdersPage() {
  const actor = await requireAdminSection('sales', 'view');
  if (!actor) redirect('/admin');
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(500);
  const settings = await getSettings();
  const catalogRows = await db.select({ variantId: productVariants.id, productId: products.id, productName: products.name, color: productVariants.name, stock: productVariants.stock, priceCents: products.priceCents, salePriceIqd: products.salePriceIqd, image: productVariants.images, primaryIndex: productVariants.primaryIndex, published: products.published }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).orderBy(products.name, productVariants.sortOrder);
  const catalog = catalogRows.map(row => ({ ...row, salePriceIqd: row.salePriceIqd || roundIqd(row.priceCents / 100 * settings.exchangeRate), image: row.image?.[row.primaryIndex] ?? row.image?.[0] ?? null }));
  const serialised = rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() })) as unknown as OrderRow[];
  return <main className="admin-page"><div className="admin-page-heading"><div><span className="admin-eyebrow">Sales</span><h1>Orders</h1><p>Confirm by phone, pack, hand to the courier and mark delivered. Cancelling or returning an order puts stock back automatically.</p></div></div><OrdersTable rows={serialised} catalog={catalog} /></main>;
}
