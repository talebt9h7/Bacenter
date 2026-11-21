/**
 * Profit preview while an order or a wholesale invoice is being written (safe in the browser).
 * Cost follows the same FIFO rule as the real sale (consumeInventoryBatches): oldest purchase
 * batch first; units beyond the batches, or a batch with no recorded cost, have an unknown cost.
 */
export type CostLayer = [quantity: number, unitCost: number | null];

/** Purchase cost of the next `quantity` units of one colour, and how many of them have no known cost. */
export function fifoCost(layers: CostLayer[] | undefined, quantity: number) {
  let left = Math.max(0, Math.floor(quantity)), cost = 0, unknown = 0;
  for (const [qty, unit] of layers ?? []) {
    if (left <= 0) break;
    const take = Math.min(left, qty);
    if (unit == null) unknown += take; else cost += unit * take;
    left -= take;
  }
  return { cost, unknown: unknown + left };
}

export type ProfitLine = { variantId: number; quantity: number; unitPrice: number; /** Known cost per unit (an existing order's snapshot); otherwise the FIFO layers are used. */ unitCost?: number | null };

/** Revenue, cost and profit of the products after the discount, plus the most discount that still avoids a loss. */
export function estimateProfit(lines: ProfitLine[], layers: Record<number, CostLayer[]>, discount: number) {
  const taken = new Map<number, number>();
  let revenue = 0, cost = 0, unknown = 0, unknownRevenue = 0;
  for (const l of lines) {
    const qty = Math.max(0, Math.floor(Number(l.quantity) || 0)), price = Math.max(0, Number(l.unitPrice) || 0);
    revenue += qty * price;
    if (l.unitCost != null) { cost += l.unitCost * qty; continue; }
    const before = taken.get(l.variantId) ?? 0;
    // Earlier lines of the same colour use the oldest units first.
    const all = fifoCost(layers[l.variantId], before + qty), prev = fifoCost(layers[l.variantId], before);
    cost += all.cost - prev.cost;
    const u = all.unknown - prev.unknown; unknown += u; unknownRevenue += u * price;
    taken.set(l.variantId, before + qty);
  }
  const safeDiscount = Math.min(Math.max(0, Number(discount) || 0), revenue);
  // Units with no recorded cost are left out of the profit (as in the reports) rather than counted as free.
  // The whole discount still comes off what is known, so the "most discount" never exceeds the known profit.
  const knownRevenue = revenue - unknownRevenue;
  const profitBefore = knownRevenue - cost;
  const profit = profitBefore - safeDiscount;
  const maxDiscount = Math.max(0, Math.floor(profitBefore));
  return { revenue, cost, unknown, profitBefore, profit, maxDiscount, discount: safeDiscount };
}
