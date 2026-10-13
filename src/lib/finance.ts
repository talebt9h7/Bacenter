/**
 * One place for every money figure shown in the admin, so the dashboard, revenue, profit,
 * finance, reports and the Excel export can never disagree.
 *
 * Definitions (all IQD):
 * - Gross sales      = Σ unit sale price × quantity.
 * - Discount         = order discount, capped at gross sales.
 * - Product revenue  = gross sales − discount. Delivery and cash-handling fees are NOT revenue.
 * - The discount is shared across lines in proportion to each line's gross value.
 * - COGS             = Σ FIFO purchase cost snapshot × quantity, for lines whose cost is known.
 * - Product profit   = revenue of known-cost lines − COGS. Lines with unknown cost are reported
 *                      separately (revenue and units) instead of being given an invented cost.
 * - Margin           = product profit ÷ revenue of known-cost lines.
 * Revenue and profit are recognised on delivery (see report-period.ts).
 */

export type MoneyItem = { productId?: string; variantId?: number; name?: string; color?: string; quantity?: number; unitPrice?: number; purchaseCostCents?: number | null };
export type MoneyOrder = { items: unknown; discountCents?: number | null; shippingCents?: number | null; codFeeCents?: number | null; totalCents?: number | null };

const num = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? n : 0; };
export const itemsOf = (order: { items: unknown }) => (Array.isArray(order.items) ? order.items : []) as MoneyItem[];

export type LineMoney = { item: MoneyItem; units: number; gross: number; discount: number; revenue: number; cost: number | null; profit: number | null };

export function lineMoney(order: MoneyOrder): LineMoney[] {
  const items = itemsOf(order);
  const gross = items.reduce((sum, item) => sum + num(item.unitPrice) * num(item.quantity), 0);
  const discount = Math.min(Math.max(0, num(order.discountCents)), gross);
  return items.map(item => {
    const units = num(item.quantity);
    const lineGross = num(item.unitPrice) * units;
    const lineDiscount = gross > 0 ? discount * (lineGross / gross) : 0;
    const revenue = Math.max(0, lineGross - lineDiscount);
    const cost = item.purchaseCostCents == null ? null : num(item.purchaseCostCents) * units;
    return { item, units, gross: lineGross, discount: lineDiscount, revenue, cost, profit: cost == null ? null : revenue - cost };
  });
}

export type MoneySummary = {
  orders: number; units: number; grossSales: number; discounts: number; revenue: number;
  shipping: number; codFees: number; collected: number;
  cogs: number; knownCostRevenue: number; knownCostUnits: number; unknownCostRevenue: number; unknownCostUnits: number;
  profit: number; margin: number; averageOrder: number;
};

export function orderMoney(order: MoneyOrder): MoneySummary {
  const lines = lineMoney(order);
  const sum = (pick: (line: LineMoney) => number) => lines.reduce((total, line) => total + pick(line), 0);
  const known = lines.filter(line => line.cost != null);
  const revenue = sum(line => line.revenue);
  const knownCostRevenue = known.reduce((total, line) => total + line.revenue, 0);
  const cogs = known.reduce((total, line) => total + (line.cost ?? 0), 0);
  const profit = knownCostRevenue - cogs;
  return {
    orders: 1, units: sum(line => line.units), grossSales: sum(line => line.gross), discounts: sum(line => line.discount), revenue,
    shipping: num(order.shippingCents), codFees: num(order.codFeeCents), collected: num(order.totalCents),
    cogs, knownCostRevenue, knownCostUnits: known.reduce((total, line) => total + line.units, 0),
    unknownCostRevenue: revenue - knownCostRevenue, unknownCostUnits: lines.filter(line => line.cost == null).reduce((total, line) => total + line.units, 0),
    profit, margin: knownCostRevenue ? profit / knownCostRevenue : 0, averageOrder: revenue,
  };
}

const EMPTY: MoneySummary = { orders: 0, units: 0, grossSales: 0, discounts: 0, revenue: 0, shipping: 0, codFees: 0, collected: 0, cogs: 0, knownCostRevenue: 0, knownCostUnits: 0, unknownCostRevenue: 0, unknownCostUnits: 0, profit: 0, margin: 0, averageOrder: 0 };

export function summarize(orders: MoneyOrder[]): MoneySummary {
  const total = orders.reduce<MoneySummary>((acc, order) => {
    const m = orderMoney(order);
    return { ...acc, orders: acc.orders + 1, units: acc.units + m.units, grossSales: acc.grossSales + m.grossSales, discounts: acc.discounts + m.discounts, revenue: acc.revenue + m.revenue, shipping: acc.shipping + m.shipping, codFees: acc.codFees + m.codFees, collected: acc.collected + m.collected, cogs: acc.cogs + m.cogs, knownCostRevenue: acc.knownCostRevenue + m.knownCostRevenue, knownCostUnits: acc.knownCostUnits + m.knownCostUnits, unknownCostRevenue: acc.unknownCostRevenue + m.unknownCostRevenue, unknownCostUnits: acc.unknownCostUnits + m.unknownCostUnits, profit: acc.profit + m.profit };
  }, { ...EMPTY });
  // Totals are rounded once, at the end, so proportional discount shares don't drift.
  for (const key of ['grossSales', 'discounts', 'revenue', 'cogs', 'knownCostRevenue', 'unknownCostRevenue', 'profit'] as const) total[key] = Math.round(total[key]);
  total.margin = total.knownCostRevenue ? total.profit / total.knownCostRevenue : 0;
  total.averageOrder = total.orders ? Math.round(total.revenue / total.orders) : 0;
  return total;
}

/** Stock valuation. Unbatched units (stock beyond purchase batches) have no known cost. */
export function inventoryValuation(
  variants: { id: number; stock: number; productId?: string }[],
  batches: { variantId: number; quantityRemaining: number; purchaseCostIqd: number | null }[],
  reserved: Map<number, number> = new Map(),
  salePriceOf: (variant: { id: number; productId?: string }) => number = () => 0,
) {
  let onHand = 0, reservedUnits = 0, knownValue = 0, knownUnits = 0, retailValue = 0;
  const batchUnits = new Map<number, number>();
  for (const batch of batches) {
    if (batch.quantityRemaining <= 0) continue;
    batchUnits.set(batch.variantId, (batchUnits.get(batch.variantId) ?? 0) + batch.quantityRemaining);
    if (batch.purchaseCostIqd != null) { knownValue += batch.purchaseCostIqd * batch.quantityRemaining; knownUnits += batch.quantityRemaining; }
  }
  for (const variant of variants) {
    onHand += variant.stock;
    reservedUnits += Math.min(variant.stock, reserved.get(variant.id) ?? 0);
    retailValue += variant.stock * salePriceOf(variant);
  }
  return { onHand, reserved: reservedUnits, available: onHand - reservedUnits, knownValue, knownUnits, unknownCostUnits: Math.max(0, onHand - knownUnits), retailValue };
}

export const percent = (part: number, whole: number) => (whole ? part / whole : 0);
