import { variantPriceSql, variantNameSql, variantNameArSql } from '@/lib/variant-sql';
import { reservedByVariant } from '@/lib/reservations';
import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { costLayersByVariant } from '@/lib/cost-layers';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { orders, productVariants, products, shippingZones } from '@/db/schema';
import { GlassScope } from '@/components/admin/dash-glass';
import { OrdersHeader, OrdersTable, type OrderRow } from '@/components/admin/orders-client';
import { baghdadDayKey, placedRange, startOfBaghdadToday } from '@/lib/report-period';
import { getSettings } from '@/lib/settings';
import { orderStatuses, roundIqd } from '@/lib/iraq';
import { searchFilter } from '@/lib/order-search';
import { getAccountsSettings, listCouriers } from '@/lib/accounts';

export const metadata = { title: 'Orders' };
export const dynamic = 'force-dynamic';
const PAGE_SIZE = 40;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const initialStatus = params.status && (orderStatuses as readonly string[]).includes(params.status) ? params.status : undefined;
  const query = (params.q ?? '').trim().slice(0, 80);
  const requestedPage = Math.max(1, Math.floor(Number(params.page) || 1));
  const actor = await requireAdminSection('sales', 'view');
  if (!actor) redirect('/admin');
  const today = startOfBaghdadToday();
  // Optional date filter on the day the order was placed (Baghdad days).
  const day = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
  const fromDay = day(params.from), toDay = day(params.to);
  const range = placedRange(fromDay, toDay);
  const todayKey = baghdadDayKey(startOfBaghdadToday());
  const search = and(searchFilter(query), range ? sql`${orders.createdAt} >= ${range.from.toISOString()}::timestamptz and ${orders.createdAt} <= ${range.to.toISOString()}::timestamptz` : undefined);
  const where = and(search, initialStatus ? eq(orders.status, initialStatus) : undefined);
  const [statusRows, todayRows, staleRows, matchRows] = await Promise.all([
    db.select({ status: orders.status, count: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${orders.totalCents}),0)::bigint` }).from(orders).groupBy(orders.status),
    db.select({ count: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${orders.totalCents}),0)::bigint` }).from(orders).where(sql`${orders.createdAt} >= ${today.toISOString()}::timestamp`),
    db.select({ count: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.status, 'pending'), sql`${orders.createdAt} < now() - interval '24 hours'`)),
    // Per-status counts for the current search, so the tabs show what each filter will return.
    db.select({ status: orders.status, count: sql<number>`count(*)::int` }).from(orders).where(search).groupBy(orders.status),
  ]);
  const matchCounts = Object.fromEntries(matchRows.map(r => [r.status, Number(r.count)]));
  const totalMatches = initialStatus ? (matchCounts[initialStatus] ?? 0) : Object.values(matchCounts).reduce((a, b) => a + b, 0);
  const pages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  const rows = await db.select().from(orders).where(where).orderBy(desc(orders.createdAt), desc(orders.id)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE);
  const stats = { byStatus: Object.fromEntries(statusRows.map(r => [r.status, { count: Number(r.count), total: Number(r.total) }])), today: { count: Number(todayRows[0]?.count ?? 0), total: Number(todayRows[0]?.total ?? 0) }, stalePending: Number(staleRows[0]?.count ?? 0) };
  const settings = await getSettings();
  const catalogRows = await db.select({ variantId: productVariants.id, productId: products.id, productName: products.name, productNameAr: products.nameAr, color: variantNameSql, colorAr: variantNameArSql, stock: productVariants.stock, priceCents: products.priceCents, salePriceIqd: variantPriceSql, image: productVariants.images, primaryIndex: productVariants.primaryIndex, published: products.published }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).orderBy(products.name, productVariants.sortOrder);
  const showProfit = actor.type === 'owner' || !!actor.permissions.finance?.view;
  const [reserved, courierRows, accounts, zones, costLayers] = await Promise.all([reservedByVariant(), listCouriers(), getAccountsSettings(), db.select({ code: shippingZones.code, rate: shippingZones.rate }).from(shippingZones), showProfit ? costLayersByVariant() : Promise.resolve({})]);
  const zoneRates = Object.fromEntries(zones.map(z => [z.code, z.rate]));
  const couriers = courierRows.map(c => ({ id: c.id, name: c.name, active: c.active, defaultFeeIqd: c.defaultFeeIqd, returnFeeIqd: c.returnFeeIqd, rates: (c.rates ?? {}) as Record<string, number> }));
  // Products offered for manual orders show what can still be sold (on hand − pending reservations).
  const catalog = catalogRows.map(row => ({ ...row, stock: Math.max(0, row.stock - (reserved.get(row.variantId) ?? 0)), salePriceIqd: row.salePriceIqd || roundIqd(row.priceCents / 100 * settings.exchangeRate), image: row.image?.[row.primaryIndex] ?? row.image?.[0] ?? null }));
  const serialised = rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), paidAt: row.paidAt?.toISOString() ?? null, deliveredAt: row.deliveredAt?.toISOString() ?? null })) as unknown as OrderRow[];
  return <GlassScope className="admin-page dash gl-page gl-orders" motionKey={`${initialStatus ?? "all"}-${query}-${page}-${fromDay}-${toDay}`}><OrdersHeader stats={stats} /><OrdersTable fromDay={fromDay} toDay={toDay} today={todayKey} rows={serialised} catalog={catalog} costLayers={showProfit ? costLayers : undefined} status={initialStatus ?? 'all'} query={query} page={page} pages={pages} total={totalMatches} counts={matchCounts} pageSize={PAGE_SIZE} couriers={couriers} defaultCourierId={accounts.defaultCourierId} zoneRates={zoneRates} /></GlassScope>;
}
