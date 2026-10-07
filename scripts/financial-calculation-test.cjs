function grossRevenue(items) {
  return items.reduce((s, i) => s + Number(i.unitPrice || 0) * Number(i.quantity || 0), 0);
}
function safeDiscount(items, discount) {
  return Math.min(Math.max(0, Number(discount) || 0), grossRevenue(items));
}
function lineNetRevenue(item, items, discount) {
  const grossOrder = grossRevenue(items);
  const grossLine = Number(item.unitPrice || 0) * Number(item.quantity || 0);
  const d = safeDiscount(items, discount);
  if (!grossOrder || !grossLine) return 0;
  return Math.max(0, grossLine - d * (grossLine / grossOrder));
}
function orderProfit(items, discount) {
  const raw = items.reduce((s, i) => {
    const cost = i.purchaseCostCents == null ? 0 : Number(i.purchaseCostCents) * Number(i.quantity || 0);
    return s + lineNetRevenue(i, items, discount) - cost;
  }, 0);
  return Math.round(raw);
}
function orderNet(items, discount) { return grossRevenue(items) - safeDiscount(items, discount); }
function assertEq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

const cases = [
  {name:'single item, 10k discount', items:[{unitPrice:100000,quantity:1,purchaseCostCents:60000}], discount:10000, net:90000, profit:30000},
  {name:'two items, proportional discount', items:[{unitPrice:100000,quantity:1,purchaseCostCents:60000},{unitPrice:50000,quantity:1,purchaseCostCents:30000}], discount:15000, net:135000, profit:45000},
  {name:'quantities, proportional discount', items:[{unitPrice:100000,quantity:2,purchaseCostCents:60000},{unitPrice:50000,quantity:3,purchaseCostCents:30000}], discount:25000, net:325000, profit:115000},
  {name:'discount cannot exceed gross', items:[{unitPrice:100000,quantity:1,purchaseCostCents:60000}], discount:150000, net:0, profit:-60000},
  {name:'loss remains negative', items:[{unitPrice:50000,quantity:1,purchaseCostCents:60000}], discount:5000, net:45000, profit:-15000},
  {name:'no discount', items:[{unitPrice:100000,quantity:2,purchaseCostCents:60000}], discount:0, net:200000, profit:80000},
];
for (const c of cases) {
  assertEq(orderNet(c.items,c.discount), c.net, `${c.name} net revenue`);
  assertEq(orderProfit(c.items,c.discount), c.profit, `${c.name} profit`);
}
// Fractional allocation must still result in an integer stored order profit.
const fractional = [{unitPrice:100000,quantity:1,purchaseCostCents:60000},{unitPrice:70000,quantity:1,purchaseCostCents:40000}];
const fp = orderProfit(fractional, 10000);
assertEq(Number.isInteger(fp), true, 'fractional allocation stored profit is integer');
assertEq(fp, 60000, 'fractional allocation total profit');
console.log(`PASS: ${cases.length + 1} financial calculation cases`);
