import { and, desc, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { customers, expenses, inventoryBatches, inventoryMovements, orders, productVariants, products, shippingZones } from '@/db/schema';
import { getSettings } from './settings';
import { reservedByVariant } from './reservations';
import { inventoryValuation, lineMoney, orderMoney, summarize } from './finance';
import { baghdadDayKey, isPlacedIn, isRecognizedIn, ordersTouchingRange, recognizedAt, reportRange } from './report-period';

const DAY = 86_400_000;
type OrderRow = typeof orders.$inferSelect;
export const REPORT_SECTIONS = ['overview', 'sales', 'profit', 'products', 'inventory', 'customers', 'orders', 'delivery', 'discounts'] as const;
export type ReportSection = typeof REPORT_SECTIONS[number];

const round = (n: number) => Math.round(n);
const itemsOf = (o: OrderRow) => (Array.isArray(o.items) ? o.items : []) as { productId?: string; variantId?: number; name?: string; color?: string; quantity?: number }[];

/**
 * All report figures for a period. Money is recognised on delivery (finance.ts);
 * operational figures use the date an order was placed. Each money figure also comes with
 * the previous period of the same length for comparison.
 */
export async function loadReports(input: { period?: string; from?: string; to?: string }) {
  const now = new Date();
  const { from, to } = reportRange(input.period, input.from, input.to, now);
  const length = to.getTime() - from.getTime() + 1;
  const prev = { from: new Date(from.getTime() - length), to: new Date(from.getTime() - 1) };
  const velocityFrom = new Date(now.getTime() - 30 * DAY);
  const windowFrom = new Date(Math.min(prev.from.getTime(), velocityFrom.getTime()));

  const [settings, windowOrders, productRows, variantRows, batchRows, reserved, customerRows, zones, expenseRows, movementRows] = await Promise.all([
    getSettings(),
    db.select().from(orders).where(ordersTouchingRange(windowFrom, to)).orderBy(desc(orders.createdAt)).limit(30000),
    db.select({ id: products.id, name: products.name, nameAr: products.nameAr, category: products.category, salePriceIqd: products.salePriceIqd, published: products.published }).from(products),
    db.select({ id: productVariants.id, productId: productVariants.productId, name: productVariants.name, nameAr: productVariants.nameAr, hex: productVariants.hex, stock: productVariants.stock, images: productVariants.images, primaryIndex: productVariants.primaryIndex }).from(productVariants),
    db.select().from(inventoryBatches).orderBy(desc(inventoryBatches.receivedAt)),
    reservedByVariant(),
    db.select({ id: customers.id, name: customers.name, phone: customers.phone, governorate: customers.governorate, ordersCount: customers.ordersCount, totalSpent: customers.totalSpent, lastOrderAt: customers.lastOrderAt, createdAt: customers.createdAt, marketingOptIn: customers.marketingOptIn }).from(customers),
    db.select({ code: shippingZones.code, nameEn: shippingZones.nameEn, nameAr: shippingZones.nameAr, rate: shippingZones.rate, minDays: shippingZones.minDays, maxDays: shippingZones.maxDays, enabled: shippingZones.enabled }).from(shippingZones),
    db.select({ amountIqd: expenses.amountIqd, expenseDate: expenses.expenseDate, category: expenses.category }).from(expenses).where(and(gte(expenses.expenseDate, prev.from), lte(expenses.expenseDate, to))),
    db.select({ variantId: inventoryMovements.variantId, delta: inventoryMovements.delta, reason: inventoryMovements.reason, createdAt: inventoryMovements.createdAt }).from(inventoryMovements).where(and(gte(inventoryMovements.createdAt, from), lte(inventoryMovements.createdAt, to))),
  ]);

  const productMap = new Map(productRows.map(p => [p.id, p]));
  const variantMap = new Map(variantRows.map(v => [v.id, v]));
  const zoneMap = new Map(zones.map(z => [z.code, z]));
  const imageOf = (productId: string) => { const v = variantRows.find(x => x.productId === productId && x.images?.length); return v ? (v.images?.[v.primaryIndex] ?? v.images?.[0] ?? '') : ''; };

  const delivered = windowOrders.filter(o => isRecognizedIn(o, from, to));
  const deliveredPrev = windowOrders.filter(o => isRecognizedIn(o, prev.from, prev.to));
  const placed = windowOrders.filter(o => isPlacedIn(o, from, to));
  const placedPrev = windowOrders.filter(o => isPlacedIn(o, prev.from, prev.to));
  const money = summarize(delivered), moneyPrev = summarize(deliveredPrev);
  const expenseNow = expenseRows.filter(e => e.expenseDate >= from && e.expenseDate <= to);
  const expenseTotal = expenseNow.reduce((s, e) => s + e.amountIqd, 0);
  const expensePrev = expenseRows.filter(e => e.expenseDate >= prev.from && e.expenseDate <= prev.to).reduce((s, e) => s + e.amountIqd, 0);

  // ---- time series (daily, or monthly beyond ~3 months) ----
  const dayCount = Math.max(1, Math.round(length / DAY));
  const byMonth = dayCount > 92;
  const key = (d: Date) => byMonth ? baghdadDayKey(d).slice(0, 7) : baghdadDayKey(d);
  const keys: string[] = [];
  for (let i = 0; i < dayCount; i++) { const k = key(new Date(from.getTime() + i * DAY)); if (keys[keys.length - 1] !== k) keys.push(k); }
  const prevKeys: string[] = [];
  for (let i = 0; i < dayCount; i++) { const k = key(new Date(prev.from.getTime() + i * DAY)); if (prevKeys[prevKeys.length - 1] !== k) prevKeys.push(k); }
  const blank = () => ({ revenue: 0, profit: 0, cogs: 0, delivered: 0, placed: 0, cancelled: 0, units: 0, previousRevenue: 0, expenses: 0 });
  const seriesMap = new Map(keys.map(k => [k, blank()]));
  for (const o of delivered) { const p = seriesMap.get(key(recognizedAt(o))); if (p) { const m = orderMoney(o); p.revenue += m.revenue; p.profit += m.profit; p.cogs += m.cogs; p.delivered++; p.units += m.units; } }
  for (const o of placed) { const p = seriesMap.get(key(o.createdAt)); if (p) { p.placed++; if (o.status === 'cancelled') p.cancelled++; } }
  for (const e of expenseNow) { const p = seriesMap.get(key(e.expenseDate)); if (p) p.expenses += e.amountIqd; }
  const prevMap = new Map(prevKeys.map(k => [k, 0]));
  for (const o of deliveredPrev) { const k = key(recognizedAt(o)); if (prevMap.has(k)) prevMap.set(k, (prevMap.get(k) ?? 0) + orderMoney(o).revenue); }
  const series = keys.map((k, i) => { const p = seriesMap.get(k)!; return { key: k, revenue: round(p.revenue), profit: round(p.profit), cogs: round(p.cogs), net: round(p.profit - p.expenses), delivered: p.delivered, placed: p.placed, cancelled: p.cancelled, units: p.units, previousRevenue: round(prevMap.get(prevKeys[i]) ?? 0) }; });

  // ---- breakdowns of delivered sales ----
  const group = (list: OrderRow[], keyOf: (o: OrderRow) => string) => {
    const map = new Map<string, { orders: number; revenue: number; profit: number; knownRevenue: number; units: number; discounts: number; shipping: number }>();
    for (const o of list) { const m = orderMoney(o); const r = map.get(keyOf(o)) ?? { orders: 0, revenue: 0, profit: 0, knownRevenue: 0, units: 0, discounts: 0, shipping: 0 }; r.orders++; r.revenue += m.revenue; r.profit += m.profit; r.knownRevenue += m.knownCostRevenue; r.units += m.units; r.discounts += m.discounts; r.shipping += m.shipping; map.set(keyOf(o), r); }
    return [...map.entries()].map(([k, r]) => ({ key: k, orders: r.orders, units: r.units, revenue: round(r.revenue), profit: round(r.profit), margin: r.knownRevenue ? r.profit / r.knownRevenue : null, aov: r.orders ? round(r.revenue / r.orders) : 0, discounts: round(r.discounts), shipping: r.shipping })).sort((a, b) => b.revenue - a.revenue);
  };
  const bySource = group(delivered, o => o.source || 'website');
  const byWeekday = Array.from({ length: 7 }, (_, d) => ({ day: d, revenue: 0, orders: 0 }));
  for (const o of delivered) { const d = new Date(recognizedAt(o).getTime() + 3 * 3600_000).getUTCDay(); byWeekday[d].revenue += orderMoney(o).revenue; byWeekday[d].orders++; }
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const o of placed) { const t = new Date(o.createdAt.getTime() + 3 * 3600_000); heatmap[t.getUTCDay()][t.getUTCHours()]++; }

  // ---- products & categories ----
  type Agg = { units: number; orders: Set<number>; revenue: number; cost: number; profit: number; knownRevenue: number; returnedUnits: number };
  const newAgg = (): Agg => ({ units: 0, orders: new Set(), revenue: 0, cost: 0, profit: 0, knownRevenue: 0, returnedUnits: 0 });
  const productAgg = new Map<string, Agg>(), variantAgg = new Map<number, Agg>(), categoryAgg = new Map<string, Agg>();
  for (const o of delivered) for (const line of lineMoney(o)) {
    const pid = line.item.productId || line.item.name || 'unknown';
    const cat = productMap.get(pid)?.category || 'other';
    for (const [map, k] of [[productAgg, pid], [categoryAgg, cat], ...(line.item.variantId ? [[variantAgg, line.item.variantId]] : [])] as [Map<string | number, Agg>, string | number][]) {
      const a = map.get(k) ?? newAgg();
      a.units += line.units; a.orders.add(o.id); a.revenue += line.revenue;
      if (line.cost != null) { a.cost += line.cost; a.profit += line.profit ?? 0; a.knownRevenue += line.revenue; }
      map.set(k, a);
    }
  }
  for (const o of placed.filter(x => x.status === 'returned')) for (const item of itemsOf(o)) { const a = productAgg.get(item.productId || item.name || 'unknown'); if (a) a.returnedUnits += Number(item.quantity || 0); }
  // Units sold in the last 30 days (confirmed or later) drive days-of-cover.
  const velocity = new Map<number, number>();
  for (const o of windowOrders) {
    if (o.createdAt < velocityFrom || ['pending', 'cancelled', 'returned'].includes(o.status)) continue;
    for (const item of itemsOf(o)) if (item.variantId) velocity.set(item.variantId, (velocity.get(item.variantId) ?? 0) + Number(item.quantity || 0));
  }
  const stockOfProduct = (pid: string) => variantRows.filter(v => v.productId === pid).reduce((s, v) => ({ onHand: s.onHand + v.stock, available: s.available + Math.max(0, v.stock - (reserved.get(v.id) ?? 0)), perDay: s.perDay + (velocity.get(v.id) ?? 0) / 30 }), { onHand: 0, available: 0, perDay: 0 });
  const totalProfit = money.profit || 1;
  const productTable = productRows.map(p => {
    const a = productAgg.get(p.id) ?? newAgg(); const st = stockOfProduct(p.id);
    return { id: p.id, name: p.name, nameAr: p.nameAr || p.name, category: p.category, image: imageOf(p.id), published: p.published, units: a.units, orders: a.orders.size, revenue: round(a.revenue), cost: round(a.cost), profit: round(a.profit), margin: a.knownRevenue ? a.profit / a.knownRevenue : null, profitShare: a.profit / totalProfit, returnedUnits: a.returnedUnits, onHand: st.onHand, available: st.available, daysLeft: st.perDay > 0 ? Math.floor(st.available / st.perDay) : null, sellThrough: a.units + st.available ? a.units / (a.units + st.available) : 0 };
  }).sort((a, b) => b.revenue - a.revenue || b.onHand - a.onHand);
  const variantTable = [...variantAgg.entries()].map(([id, a]) => { const v = variantMap.get(id); const p = v ? productMap.get(v.productId) : undefined; return { id, product: p?.name ?? '—', productAr: p?.nameAr || p?.name || '—', color: v?.name ?? '—', colorAr: v?.nameAr || v?.name || '—', hex: v?.hex ?? '#ccc', units: a.units, revenue: round(a.revenue), profit: round(a.profit), available: v ? Math.max(0, v.stock - (reserved.get(id) ?? 0)) : 0 }; }).sort((a, b) => b.units - a.units).slice(0, 15);
  const categoryTable = [...categoryAgg.entries()].map(([k, a]) => ({ key: k, units: a.units, orders: a.orders.size, revenue: round(a.revenue), profit: round(a.profit), margin: a.knownRevenue ? a.profit / a.knownRevenue : null })).sort((a, b) => b.revenue - a.revenue);

  // ---- inventory ----
  const valuation = inventoryValuation(variantRows, batchRows, reserved, v => productMap.get(v.productId ?? '')?.salePriceIqd ?? 0);
  const inventoryTable = variantRows.map(v => { const p = productMap.get(v.productId); const res = Math.min(v.stock, reserved.get(v.id) ?? 0); const available = Math.max(0, v.stock - (reserved.get(v.id) ?? 0)); const perDay = (velocity.get(v.id) ?? 0) / 30; const known = batchRows.filter(b => b.variantId === v.id && b.purchaseCostIqd != null).reduce((s, b) => s + (b.purchaseCostIqd ?? 0) * b.quantityRemaining, 0); return { id: v.id, product: p?.name ?? v.productId, productAr: p?.nameAr || p?.name || v.productId, color: v.name, colorAr: v.nameAr || v.name, hex: v.hex, onHand: v.stock, reserved: res, available, costValue: known, retailValue: v.stock * (p?.salePriceIqd ?? 0), perDay, daysLeft: perDay > 0 ? Math.floor(available / perDay) : null, published: !!p?.published }; }).sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999) || b.onHand - a.onHand);
  const movementSummary = new Map<string, { in: number; out: number }>();
  for (const m of movementRows) { const r = movementSummary.get(m.reason) ?? { in: 0, out: 0 }; if (m.delta > 0) r.in += m.delta; else r.out -= m.delta; movementSummary.set(m.reason, r); }
  const batches = batchRows.slice(0, 80).map(b => { const v = variantMap.get(b.variantId); const p = v ? productMap.get(v.productId) : undefined; return { id: b.id, batch: b.batchNumber, product: p?.name ?? '—', productAr: p?.nameAr || p?.name || '—', color: v?.name ?? '—', received: b.quantityReceived, remaining: b.quantityRemaining, cost: b.purchaseCostIqd, value: b.purchaseCostIqd == null ? null : b.purchaseCostIqd * b.quantityRemaining, receivedAt: b.receivedAt.toISOString() }; });
  const lowThreshold = settings.lowStockThreshold || 5;

  // ---- customers ----
  const buyerAgg = new Map<string, { name: string; phone: string; governorate: string; orders: number; revenue: number; delivered: number; cancelled: number; last: number }>();
  for (const o of placed) { const r = buyerAgg.get(o.phone) ?? { name: o.name, phone: o.phone, governorate: o.governorate, orders: 0, revenue: 0, delivered: 0, cancelled: 0, last: 0 }; r.orders++; if (o.status !== 'cancelled') r.revenue += orderMoney(o).revenue; if (o.status === 'delivered') r.delivered++; if (o.status === 'cancelled') r.cancelled++; r.last = Math.max(r.last, o.createdAt.getTime()); buyerAgg.set(o.phone, r); }
  const phonesBefore = new Set(windowOrders.filter(o => o.createdAt < from && o.status !== 'cancelled').map(o => o.phone));
  const buyers = [...buyerAgg.values()];
  const returningBuyers = buyers.filter(b => phonesBefore.has(b.phone) || b.orders > 1);
  const revenueNew = buyers.filter(b => !returningBuyers.includes(b)).reduce((s, b) => s + b.revenue, 0);
  const revenueReturning = returningBuyers.reduce((s, b) => s + b.revenue, 0);
  const customerStats = { total: customerRows.length, newInPeriod: customerRows.filter(c => c.createdAt >= from && c.createdAt <= to).length, buyers: buyers.length, returning: returningBuyers.length, repeatAllTime: customerRows.filter(c => c.ordersCount >= 2).length, inactive90: customerRows.filter(c => c.lastOrderAt && now.getTime() - c.lastOrderAt.getTime() >= 90 * DAY).length, optIn: customerRows.filter(c => c.marketingOptIn).length, revenueNew: round(revenueNew), revenueReturning: round(revenueReturning), revenuePerBuyer: buyers.length ? round((revenueNew + revenueReturning) / buyers.length) : 0 };
  const topBuyers = buyers.sort((a, b) => b.revenue - a.revenue).slice(0, 15).map(b => ({ ...b, revenue: round(b.revenue), governorateName: zoneMap.get(b.governorate) ? { en: zoneMap.get(b.governorate)!.nameEn, ar: zoneMap.get(b.governorate)!.nameAr } : { en: b.governorate, ar: b.governorate }, last: new Date(b.last).toISOString() }));

  // ---- orders & fulfilment ----
  const statusCounts = Object.fromEntries(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'].map(s => [s, placed.filter(o => o.status === s).length]));
  const reached = (statuses: string[]) => placed.filter(o => statuses.includes(o.status)).length;
  const funnel = [
    { key: 'placed', count: placed.length },
    { key: 'confirmed', count: reached(['confirmed', 'processing', 'shipped', 'delivered', 'returned']) },
    { key: 'shipped', count: reached(['shipped', 'delivered', 'returned']) },
    { key: 'delivered', count: reached(['delivered']) },
  ];
  const deliveryHours = delivered.filter(o => o.deliveredAt).map(o => (o.deliveredAt!.getTime() - o.createdAt.getTime()) / 3600_000).filter(h => h >= 0);
  const avgDeliveryDays = deliveryHours.length ? deliveryHours.reduce((s, h) => s + h, 0) / deliveryHours.length / 24 : 0;
  const deliveredList = delivered.slice(0, 300).map(o => { const m = orderMoney(o); return { id: o.id, reference: o.reference, name: o.name, phone: o.phone, source: o.source, governorate: o.governorate, revenue: round(m.revenue), discount: round(m.discounts), cogs: round(m.cogs), profit: round(m.profit), unknownCost: m.unknownCostUnits > 0, shipping: o.shippingCents, total: o.totalCents, units: m.units, deliveredAt: recognizedAt(o).toISOString(), createdAt: o.createdAt.toISOString() }; });
  const ordersList = placed.slice(0, 250).map(o => { const m = orderMoney(o); return { id: o.id, reference: o.reference, name: o.name, phone: o.phone, source: o.source, status: o.status, governorate: o.governorate, revenue: round(m.revenue), profit: o.status === 'delivered' ? round(m.profit) : null, shipping: o.shippingCents, total: o.totalCents, units: m.units, createdAt: o.createdAt.toISOString() }; });

  // ---- delivery by governorate (placed orders, outcome) ----
  const govAgg = new Map<string, { orders: number; delivered: number; cancelled: number; returned: number; revenue: number; shipping: number; hours: number[] }>();
  for (const o of placed) { const r = govAgg.get(o.governorate || 'unknown') ?? { orders: 0, delivered: 0, cancelled: 0, returned: 0, revenue: 0, shipping: 0, hours: [] }; r.orders++; if (o.status === 'delivered') { r.delivered++; r.revenue += orderMoney(o).revenue; r.shipping += o.shippingCents; if (o.deliveredAt) r.hours.push((o.deliveredAt.getTime() - o.createdAt.getTime()) / 3600_000); } if (o.status === 'cancelled') r.cancelled++; if (o.status === 'returned') r.returned++; govAgg.set(o.governorate || 'unknown', r); }
  const governorates = [...govAgg.entries()].map(([code, r]) => { const z = zoneMap.get(code); return { code, nameEn: z?.nameEn ?? code, nameAr: z?.nameAr ?? code, rate: z?.rate ?? 0, promised: z ? `${z.minDays}–${z.maxDays}` : '—', orders: r.orders, delivered: r.delivered, cancelRate: r.orders ? r.cancelled / r.orders : 0, returnRate: r.orders ? r.returned / r.orders : 0, successRate: r.orders ? r.delivered / r.orders : 0, revenue: round(r.revenue), shipping: r.shipping, avgDays: r.hours.length ? r.hours.reduce((s, h) => s + h, 0) / r.hours.length / 24 : null }; }).sort((a, b) => b.orders - a.orders);

  // ---- coupons & discounts ----
  const couponAgg = new Map<string, { uses: number; discount: number; revenue: number }>();
  for (const o of delivered) { const m = orderMoney(o); if (!m.discounts) continue; const k = o.couponCode || '—'; const r = couponAgg.get(k) ?? { uses: 0, discount: 0, revenue: 0 }; r.uses++; r.discount += m.discounts; r.revenue += m.revenue; couponAgg.set(k, r); }
  const coupons = [...couponAgg.entries()].map(([code, r]) => ({ code, uses: r.uses, discount: round(r.discount), revenue: round(r.revenue), aov: r.uses ? round(r.revenue / r.uses) : 0 })).sort((a, b) => b.discount - a.discount);
  const discountedOrders = delivered.filter(o => orderMoney(o).discounts > 0).length;

  // ---- expenses by category ----
  const expenseByCategory = [...expenseNow.reduce((map, e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amountIqd), new Map<string, number>()).entries()].map(([k, v]) => ({ key: k, value: v })).sort((a, b) => b.value - a.value);

  return {
    period: input.from || input.to ? 'custom' : (input.period || '30d'), from: from.toISOString(), to: to.toISOString(), fromDay: baghdadDayKey(from), toDay: baghdadDayKey(to), previousFrom: prev.from.toISOString(), previousTo: prev.to.toISOString(), byMonth,
    money, moneyPrevious: moneyPrev, expenses: { current: expenseTotal, previous: expensePrev, byCategory: expenseByCategory },
    placed: { count: placed.length, previous: placedPrev.length, cancelRate: placed.length ? statusCounts.cancelled / placed.length : 0, returnRate: placed.length ? statusCounts.returned / placed.length : 0, previousCancelRate: placedPrev.length ? placedPrev.filter(o => o.status === 'cancelled').length / placedPrev.length : 0 },
    series, bySource, byWeekday: byWeekday.map(d => ({ ...d, revenue: round(d.revenue) })), heatmap,
    productTable, variantTable, categoryTable,
    inventory: { ...valuation, lowThreshold, table: inventoryTable, batches, movements: [...movementSummary.entries()].map(([reason, r]) => ({ reason, ...r })).sort((a, b) => (b.in + b.out) - (a.in + a.out)), lowCount: inventoryTable.filter(v => v.published && v.available > 0 && v.available <= lowThreshold).length, soldOutCount: inventoryTable.filter(v => v.published && v.available === 0).length },
    customers: customerStats, topBuyers,
    statusCounts, funnel, avgDeliveryDays, ordersList, deliveredList,
    governorates,
    coupons, discountedOrders,
  };
}

export type ReportsData = Awaited<ReturnType<typeof loadReports>>;
