import { reservedByVariant } from '@/lib/reservations';
import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { orders, productVariants, products } from '@/db/schema';
import { OrdersHeader, OrdersTable, type OrderRow } from '@/components/admin/orders-client';
import { startOfBaghdadToday } from '@/lib/report-period';
import { getSettings } from '@/lib/settings';
import { roundIqd } from '@/lib/iraq';

export const metadata = { title: 'Orders' };
/** Pending orders waiting more than a day for a confirmation call. */
function countStalePending(list: { status: string; createdAt: Date }[]) { const cutoff = Date.now() - 86_400_000; return list.filter(r => r.status === 'pending' && r.createdAt.getTime() < cutoff).length; }
export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: initialStatus } = await searchParams;
  const actor = await requireAdminSection('sales', 'view');
  if (!actor) redirect('/admin');
  const today = startOfBaghdadToday();
  const [rows, statusRows, todayRows] = await Promise.all([
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(500),
    db.select({ status: orders.status, count: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${orders.totalCents}),0)::bigint` }).from(orders).groupBy(orders.status),
    db.select({ count: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${orders.totalCents}),0)::bigint` }).from(orders).where(sql`${orders.createdAt} >= ${today.toISOString()}::timestamp`),
  ]);
  const stats = { byStatus: Object.fromEntries(statusRows.map(r => [r.status, { count: Number(r.count), total: Number(r.total) }])), today: { count: Number(todayRows[0]?.count ?? 0), total: Number(todayRows[0]?.total ?? 0) }, stalePending: countStalePending(rows) };
  const settings = await getSettings();
  const catalogRows = await db.select({ variantId: productVariants.id, productId: products.id, productName: products.name, color: productVariants.name, stock: productVariants.stock, priceCents: products.priceCents, salePriceIqd: products.salePriceIqd, image: productVariants.images, primaryIndex: productVariants.primaryIndex, published: products.published }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).orderBy(products.name, productVariants.sortOrder);
  const reserved = await reservedByVariant();
  // Products offered for manual orders show what can still be sold (on hand − pending reservations).
  const catalog = catalogRows.map(row => ({ ...row, stock: Math.max(0, row.stock - (reserved.get(row.variantId) ?? 0)), salePriceIqd: row.salePriceIqd || roundIqd(row.priceCents / 100 * settings.exchangeRate), image: row.image?.[row.primaryIndex] ?? row.image?.[0] ?? null }));
  const serialised = rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() })) as unknown as OrderRow[];
  return <main className="admin-page dash"><OrdersHeader stats={stats} /><OrdersTable rows={serialised} catalog={catalog} initialStatus={initialStatus} /></main>;
}
