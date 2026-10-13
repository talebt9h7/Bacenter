// Tests the real money module used by every admin page:
//   node --experimental-strip-types scripts/financial-calculation-test.mjs
import assert from 'node:assert/strict';
import { orderMoney, summarize, inventoryValuation } from '../src/lib/finance.ts';

const order = (items, discount = 0, extra = {}) => ({ items, discountCents: discount, shippingCents: 5000, codFeeCents: 0, totalCents: 0, ...extra });
const cases = [
  ['single item, 10k discount', [{ unitPrice: 100000, quantity: 1, purchaseCostCents: 60000 }], 10000, 90000, 30000],
  ['two items, proportional discount', [{ unitPrice: 100000, quantity: 1, purchaseCostCents: 60000 }, { unitPrice: 50000, quantity: 1, purchaseCostCents: 30000 }], 15000, 135000, 45000],
  ['quantities, proportional discount', [{ unitPrice: 100000, quantity: 2, purchaseCostCents: 60000 }, { unitPrice: 50000, quantity: 3, purchaseCostCents: 30000 }], 25000, 325000, 115000],
  ['discount cannot exceed gross', [{ unitPrice: 100000, quantity: 1, purchaseCostCents: 60000 }], 150000, 0, -60000],
  ['loss stays negative', [{ unitPrice: 50000, quantity: 1, purchaseCostCents: 60000 }], 5000, 45000, -15000],
  ['no discount', [{ unitPrice: 100000, quantity: 2, purchaseCostCents: 60000 }], 0, 200000, 80000],
];
for (const [name, items, discount, revenue, profit] of cases) {
  const m = summarize([order(items, discount)]);
  assert.equal(m.revenue, revenue, `${name}: revenue`);
  assert.equal(m.profit, profit, `${name}: profit`);
  assert.equal(m.shipping, 5000, `${name}: delivery is kept apart from revenue`);
}

// Unknown purchase cost: its revenue is counted, but it is excluded from COGS, profit and margin.
const mixed = summarize([order([{ unitPrice: 100000, quantity: 1, purchaseCostCents: 60000 }, { unitPrice: 100000, quantity: 1, purchaseCostCents: null }], 20000)]);
assert.equal(mixed.revenue, 180000);
assert.equal(mixed.knownCostRevenue, 90000);
assert.equal(mixed.unknownCostRevenue, 90000);
assert.equal(mixed.cogs, 60000);
assert.equal(mixed.profit, 30000);
assert.equal(mixed.unknownCostUnits, 1);
assert.equal(Math.round(mixed.margin * 100), 33, 'margin is on known-cost revenue');
assert.equal(mixed.revenue - mixed.unknownCostRevenue - mixed.cogs, mixed.profit, 'profit bridge adds up');

// Totals across orders and averages.
const many = summarize([order([{ unitPrice: 30000, quantity: 1, purchaseCostCents: 10000 }]), order([{ unitPrice: 70000, quantity: 1, purchaseCostCents: 20000 }])]);
assert.equal(many.orders, 2); assert.equal(many.revenue, 100000); assert.equal(many.averageOrder, 50000); assert.equal(many.profit, 70000);

// Fractional discount shares round once, to an integer.
const fractional = orderMoney(order([{ unitPrice: 100000, quantity: 1, purchaseCostCents: 60000 }, { unitPrice: 70000, quantity: 1, purchaseCostCents: 40000 }], 10000));
assert.equal(Math.round(fractional.profit), 60000);

// Stock valuation: unbatched units have unknown cost; reserved never exceeds stock.
const v = inventoryValuation([{ id: 1, stock: 10 }, { id: 2, stock: 3 }], [{ variantId: 1, quantityRemaining: 6, purchaseCostIqd: 5000 }, { variantId: 2, quantityRemaining: 3, purchaseCostIqd: null }], new Map([[1, 4], [2, 9]]));
assert.equal(v.onHand, 13); assert.equal(v.knownValue, 30000); assert.equal(v.unknownCostUnits, 7); assert.equal(v.reserved, 7); assert.equal(v.available, 6);
console.log('PASS: financial calculations');
