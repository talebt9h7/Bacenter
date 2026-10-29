import { variantNameSql, variantNameArSql } from '@/lib/variant-sql';
import { and, count, desc, gte, inArray, lte, eq } from 'drizzle-orm';
import { db } from '@/db';
import { activityLog, customers, expenses, inventoryBatches, newsletterSubscribers, orders, productVariants, products, shippingZones, supportMessages } from '@/db/schema';
import { getSettings } from './settings';
import { reservedByVariant } from './reservations';
import { inventoryValuation, lineMoney, orderMoney, summarize, type MoneySummary } from './finance';
import { baghdadDayKey, isPlacedIn, isRecognizedIn, ordersTouchingRange, recognizedAt, reportRange, startOfBaghdadToday } from './report-period';

const DAY = 86_400_000;
const OPEN = ['pending', 'confirmed', 'processing', 'shipped'] as const;
export const DASHBOARD_PERIODS = ['today', '7d', '30d', '90d', 'year'] as const;
export type DashboardPeriod = typeof DASHBOARD_PERIODS[number];
type OrderRow = typeof orders.$inferSelect;

function previousRange(from: Date, to: Date) {
  const length = to.getTime() - from.getTime() + 1;
  return { from: new Date(from.getTime() - length), to: new Date(from.getTime() - 1) };
}
const imageOf = (images: string[] | null, primary: number) => images?.[primary] ?? images?.[0] ?? '';
const baghdadHour = (date: Date) => (date.getUTCHours() + 3) % 24;
const baghdadWeekday = (date: Date) => new Date(date.getTime() + 3 * 3600_000).getUTCDay();

/**
 * Everything the admin dashboard shows, computed on the server from live data.
 * Money follows finance.ts (revenue/profit recognised on delivery, delivery fees excluded).
 * Operational figures (orders placed, cancellations, heatmap) use the date an order was placed.
 */
export async function loadDashboard(period: DashboardPeriod, { finance }: { finance: boolean }) {
  const now = new Date();
  const { from, to } = reportRange(period, undefined, undefined, now);
  const prev = previousRange(from, to);
  const today = startOfBaghdadToday(now);
  const velocityFrom = new Date(today.getTime() - 29 * DAY);
  const windowFrom = new Date(Math.min(prev.from.getTime(), today.getTime() - 60 * DAY));

  const [settings, windowOrders, openOrders, variantRows, productRows, batchRows, reserved, expenseRows, customerTotals, newCustomers, subscribers, openMessages, activity, zones] = await Promise.all([
    getSettings(),
    db.select().from(orders).where(ordersTouchingRange(windowFrom, to)).orderBy(desc(orders.createdAt)).limit(20000),
    db.select().from(orders).where(inArray(orders.status, [...OPEN])).orderBy(desc(orders.createdAt)).limit(5000),
    db.select({ id: productVariants.id, productId: productVariants.productId, name: variantNameSql, nameAr: variantNameArSql, hex: productVariants.hex, stock: productVariants.stock, images: productVariants.images, primaryIndex: productVariants.primaryIndex }).from(productVariants),
    db.select({ id: products.id, name: products.name, nameAr: products.nameAr, category: products.category, salePriceIqd: products.salePriceIqd, published: products.published }).from(products),
    db.select({ variantId: inventoryBatches.variantId, quantityRemaining: inventoryBatches.quantityRemaining, purchaseCostIqd: inventoryBatches.purchaseCostIqd }).from(inventoryBatches),
    reservedByVariant(),
    finance ? db.select({ amountIqd: expenses.amountIqd, expenseDate: expenses.expenseDate, category: expenses.category }).from(expenses).where(and(gte(expenses.expenseDate, prev.from), lte(expenses.expenseDate, to))) : Promise.resolve([]),
    db.select({ total: count() }).from(customers),
    db.select({ total: count() }).from(customers).where(and(gte(customers.createdAt, from), lte(customers.createdAt, to))),
    db.select({ total: count() }).from(newsletterSubscribers),
    db.select({ total: count() }).from(supportMessages).where(eq(supportMessages.status, 'open')),
    db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(8),
    db.select({ code: shippingZones.code, nameEn: shippingZones.nameEn, nameAr: shippingZones.nameAr, enabled: shippingZones.enabled }).from(shippingZones),
  ]);

  const productMap = new Map(productRows.map(p => [p.id, p]));
  const variantMap = new Map(variantRows.map(v => [v.id, v]));
  const zoneName = new Map(zones.map(z => [z.code, { en: z.nameEn, ar: z.nameAr }]));

  // ---- Money (recognised on delivery) ----
  const delivered = windowOrders.filter(o => isRecognizedIn(o, from, to));
  const deliveredPrev = windowOrders.filter(o => isRecognizedIn(o, prev.from, prev.to));
  const money = summarize(delivered);
  const moneyPrev = summarize(deliveredPrev);
  const expenseTotal = expenseRows.filter(e => e.expenseDate >= from && e.expenseDate <= to).reduce((s, e) => s + e.amountIqd, 0);
  const expensePrev = expenseRows.filter(e => e.expenseDate >= prev.from && e.expenseDate <= prev.to).reduce((s, e) => s + e.amountIqd, 0);

  // ---- Orders placed (operations) ----
  const placed = windowOrders.filter(o => isPlacedIn(o, from, to));
  const placedPrev = windowOrders.filter(o => isPlacedIn(o, prev.from, prev.to));
  const placedValue = (list: OrderRow[]) => list.filter(o => o.status !== 'cancelled').reduce((s, o) => s + orderMoney(o).revenue, 0);
  const rate = (list: OrderRow[], status: string) => list.length ? list.filter(o => o.status === status).length / list.length : 0;

  // ---- Daily series: revenue/profit by delivery day, orders by placed day ----
  const dayCount = Math.max(1, Math.round((to.getTime() - from.getTime() + 1) / DAY));
  const byMonth = dayCount > 92;
  const bucketKey = (date: Date) => byMonth ? baghdadDayKey(date).slice(0, 7) : baghdadDayKey(date);
  const buckets: string[] = [];
  for (let i = 0; i < dayCount; i++) { const key = bucketKey(new Date(from.getTime() + i * DAY)); if (buckets[buckets.length - 1] !== key) buckets.push(key); }
  const series = new Map(buckets.map(key => [key, { revenue: 0, profit: 0, orders: 0, previousRevenue: 0 }]));
  for (const o of delivered) { const point = series.get(bucketKey(recognizedAt(o))); if (point) { const m = orderMoney(o); point.revenue += m.revenue; point.profit += m.profit; } }
  for (const o of placed) { const point = series.get(bucketKey(o.createdAt)); if (point) point.orders += 1; }
  const prevBuckets: string[] = [];
  for (let i = 0; i < dayCount; i++) { const key = bucketKey(new Date(prev.from.getTime() + i * DAY)); if (prevBuckets[prevBuckets.length - 1] !== key) prevBuckets.push(key); }
  const prevSeries = new Map(prevBuckets.map(key => [key, 0]));
  for (const o of deliveredPrev) { const key = bucketKey(recognizedAt(o)); if (prevSeries.has(key)) prevSeries.set(key, (prevSeries.get(key) ?? 0) + orderMoney(o).revenue); }
  prevBuckets.forEach((key, index) => { const target = buckets[index]; const point = target ? series.get(target) : undefined; if (point) point.previousRevenue = prevSeries.get(key) ?? 0; });
  const daily = buckets.map(key => ({ key, ...series.get(key)!, revenue: Math.round(series.get(key)!.revenue), profit: Math.round(series.get(key)!.profit), previousRevenue: Math.round(series.get(key)!.previousRevenue) }));

  // ---- Pipeline (all open orders, any date) ----
  const pipeline = OPEN.map(status => {
    const list = openOrders.filter(o => o.status === status);
    return { status, orders: list.length, value: Math.round(list.reduce((s, o) => s + orderMoney(o).revenue, 0)), collect: list.reduce((s, o) => s + o.totalCents, 0), oldestHours: list.length ? Math.round((now.getTime() - Math.min(...list.map(o => o.createdAt.getTime()))) / 3600_000) : 0 };
  });
  const openMoney = summarize(openOrders.filter(o => o.status !== 'pending'));
  const deliveredPeriodCount = { delivered: windowOrders.filter(o => isRecognizedIn(o, from, to)).length };

  // ---- Breakdowns of delivered sales ----
  const group = <K extends string>(list: OrderRow[], keyOf: (o: OrderRow) => K) => {
    const map = new Map<K, { orders: number; revenue: number; profit: number }>();
    for (const o of list) { const key = keyOf(o); const m = orderMoney(o); const row = map.get(key) ?? { orders: 0, revenue: 0, profit: 0 }; row.orders++; row.revenue += m.revenue; row.profit += m.profit; map.set(key, row); }
    return [...map.entries()].map(([key, v]) => ({ key, orders: v.orders, revenue: Math.round(v.revenue), profit: Math.round(v.profit) })).sort((a, b) => b.revenue - a.revenue);
  };
  const bySource = group(delivered, o => (o.source || 'website') as string);
  const byGovernorate = group(delivered, o => (o.governorate || 'unknown') as string).map(row => ({ ...row, nameEn: zoneName.get(row.key)?.en ?? row.key, nameAr: zoneName.get(row.key)?.ar ?? row.key }));

  // ---- Products ----
  const productAgg = new Map<string, { units: number; revenue: number; cost: number; profit: number; knownRevenue: number; orders: Set<number> }>();
  for (const o of delivered) for (const line of lineMoney(o)) {
    const id = line.item.productId || line.item.name || 'unknown';
    const row = productAgg.get(id) ?? { units: 0, revenue: 0, cost: 0, profit: 0, knownRevenue: 0, orders: new Set<number>() };
    row.units += line.units; row.revenue += line.revenue; row.orders.add(o.id);
    if (line.cost != null) { row.cost += line.cost; row.profit += line.profit ?? 0; row.knownRevenue += line.revenue; }
    productAgg.set(id, row);
  }
  const firstImage = (productId: string) => { const v = variantRows.find(x => x.productId === productId && x.images?.length); return v ? imageOf(v.images, v.primaryIndex) : ''; };
  const topProducts = [...productAgg.entries()].map(([id, v]) => {
    const p = productMap.get(id);
    return { id, name: p?.name ?? id, nameAr: p?.nameAr || p?.name || id, image: firstImage(id), units: v.units, orders: v.orders.size, revenue: Math.round(v.revenue), profit: Math.round(v.profit), margin: v.knownRevenue ? v.profit / v.knownRevenue : null };
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  // ---- Inventory health ----
  const valuation = inventoryValuation(variantRows, batchRows, reserved, v => productMap.get(v.productId ?? '')?.salePriceIqd ?? 0);
  const soldUnits = new Map<number, number>();
  const lastSale = new Map<number, number>();
  for (const o of windowOrders) {
    if (o.status === 'cancelled' || o.status === 'returned' || o.status === 'pending') continue;
    for (const item of (Array.isArray(o.items) ? o.items : []) as { variantId?: number; quantity?: number }[]) {
      if (!item.variantId) continue;
      if (o.createdAt >= velocityFrom) soldUnits.set(item.variantId, (soldUnits.get(item.variantId) ?? 0) + Number(item.quantity || 0));
      lastSale.set(item.variantId, Math.max(lastSale.get(item.variantId) ?? 0, o.createdAt.getTime()));
    }
  }
  const variantView = variantRows.map(v => {
    const p = productMap.get(v.productId);
    const res = Math.min(v.stock, reserved.get(v.id) ?? 0);
    const available = Math.max(0, v.stock - (reserved.get(v.id) ?? 0));
    const perDay = (soldUnits.get(v.id) ?? 0) / 30;
    return { id: v.id, productId: v.productId, product: p?.name ?? v.productId, productAr: p?.nameAr || p?.name || v.productId, color: v.name, colorAr: v.nameAr || v.name, hex: v.hex, image: imageOf(v.images, v.primaryIndex), onHand: v.stock, reserved: res, available, perDay, daysLeft: perDay > 0 ? Math.floor(available / perDay) : null, lastSaleDays: lastSale.has(v.id) ? Math.floor((now.getTime() - lastSale.get(v.id)!) / DAY) : null, published: !!p?.published, photos: v.images?.length ?? 0 };
  });
  const lowThreshold = settings.lowStockThreshold || 5;
  const stockAlerts = variantView.filter(v => v.published && (v.available <= lowThreshold || (v.daysLeft != null && v.daysLeft <= 14))).sort((a, b) => a.available - b.available || (a.daysLeft ?? 999) - (b.daysLeft ?? 999)).slice(0, 8);
  const deadStock = variantView.filter(v => v.onHand > 0 && (v.lastSaleDays == null || v.lastSaleDays >= 60)).sort((a, b) => b.onHand - a.onHand).slice(0, 6);

  // ---- Customers in the period ----
  const customerAgg = new Map<string, { name: string; phone: string; orders: number; revenue: number; firstOrder: number }>();
  for (const o of placed) {
    if (o.status === 'cancelled') continue;
    const row = customerAgg.get(o.phone) ?? { name: o.name, phone: o.phone, orders: 0, revenue: 0, firstOrder: o.createdAt.getTime() };
    row.orders++; row.revenue += orderMoney(o).revenue; row.firstOrder = Math.min(row.firstOrder, o.createdAt.getTime()); customerAgg.set(o.phone, row);
  }
  const phonesBefore = new Set(windowOrders.filter(o => o.createdAt < from && o.status !== 'cancelled').map(o => o.phone));
  const buyers = [...customerAgg.values()];
  const returning = buyers.filter(b => phonesBefore.has(b.phone) || b.orders > 1).length;
  const topCustomers = buyers.sort((a, b) => b.revenue - a.revenue).slice(0, 5).map(c => ({ ...c, revenue: Math.round(c.revenue) }));

  // ---- When orders come in (Baghdad time) ----
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const o of placed) heatmap[baghdadWeekday(o.createdAt)][baghdadHour(o.createdAt)]++;

  // ---- Things that need attention ----
  const stalePending = openOrders.filter(o => o.status === 'pending' && now.getTime() - o.createdAt.getTime() > DAY).length;
  const lateShipments = openOrders.filter(o => o.status === 'shipped' && now.getTime() - o.updatedAt.getTime() > 7 * DAY).length;
  const reservedButOut = variantView.filter(v => v.reserved > 0 && v.onHand < (reserved.get(v.id) ?? 0)).length;
  const noPhotos = variantView.filter(v => v.published && v.photos === 0).length;

  const recentOrders = openOrders.concat(windowOrders).filter((o, i, all) => all.findIndex(x => x.id === o.id) === i).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 8).map(o => ({ id: o.id, reference: o.reference, name: o.name, governorate: o.governorate, status: o.status, total: o.totalCents, items: ((Array.isArray(o.items) ? o.items : []) as { quantity?: number }[]).reduce((s, i) => s + Number(i.quantity || 0), 0), createdAt: o.createdAt.toISOString(), source: o.source }));

  const hideMoney = (m: MoneySummary) => finance ? m : { ...m, cogs: 0, profit: 0, margin: 0, knownCostRevenue: 0 };
  return {
    period, from: from.toISOString(), to: to.toISOString(), previousFrom: prev.from.toISOString(), previousTo: prev.to.toISOString(), generatedAt: now.toISOString(), finance,
    money: hideMoney(money), moneyPrevious: hideMoney(moneyPrev),
    expenses: finance ? { current: expenseTotal, previous: expensePrev } : null,
    placed: { count: placed.length, previous: placedPrev.length, value: Math.round(placedValue(placed)), previousValue: Math.round(placedValue(placedPrev)), cancelRate: rate(placed, 'cancelled'), returnRate: rate(placed, 'returned'), previousCancelRate: rate(placedPrev, 'cancelled'), deliveredCount: deliveredPeriodCount.delivered },
    daily, byMonth,
    pipeline, expectedRevenue: Math.round(openMoney.revenue), expectedProfit: finance ? Math.round(openMoney.profit) : 0, toCollect: pipeline.find(p => p.status === 'shipped')?.collect ?? 0,
    bySource, byGovernorate: byGovernorate.slice(0, 8), governoratesLive: zones.filter(z => z.enabled).length,
    topProducts: finance ? topProducts : topProducts.map(p => ({ ...p, profit: 0, margin: null })),
    inventory: { ...valuation, knownValue: finance ? valuation.knownValue : 0, variants: variantRows.length, products: productRows.length, published: productRows.filter(p => p.published).length, soldOut: variantView.filter(v => v.published && v.available === 0).length, low: variantView.filter(v => v.published && v.available > 0 && v.available <= lowThreshold).length, lowThreshold },
    stockAlerts, deadStock,
    customers: { total: customerTotals[0]?.total ?? 0, newInPeriod: newCustomers[0]?.total ?? 0, buyers: buyers.length, returning, top: topCustomers, subscribers: subscribers[0]?.total ?? 0 },
    heatmap,
    attention: { stalePending, lateShipments, reservedButOut, unknownCostUnits: valuation.unknownCostUnits, noPhotos, openMessages: openMessages[0]?.total ?? 0 },
    recentOrders,
    activity: activity.map(a => ({ id: a.id, action: a.action, entity: a.entity, details: a.details, createdAt: a.createdAt.toISOString() })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
