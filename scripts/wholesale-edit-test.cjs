// Isolated PostgreSQL tests; never reads DATABASE_URL or contacts a running database.
// Run: node scripts/wholesale-edit-test.cjs
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite'), { getTableConfig, PgDialect } = require('drizzle-orm/pg-core'), { eq } = require('drizzle-orm');
const root = path.resolve(__dirname, '..'), cache = new Map(); let database; let allowSettingsWrite = true;
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const m = new Module(file, module); cache.set(file, m); m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
  m.require = spec => {
    if (spec === '@/db') return { db: database };
    if (spec === '@/lib/settings') return { getSettings: async () => ({ logoUrl: '/images/UR-logo.svg', supportPhone: '07700000000', address: 'Iraq' }) };
    if (spec === '@/lib/admin-auth') return { requireAdminSection: async (_, level) => level === 'manage' && !allowSettingsWrite ? null : { type: 'owner' } };
    if (spec === 'next/cache') return { revalidateTag() {} };
    if (spec.startsWith('@/') || spec.startsWith('.')) { let p = spec.startsWith('@/') ? path.join(root, 'src', spec.slice(2)) : path.resolve(path.dirname(file), spec); if (!path.extname(p)) p += '.ts'; return load(p); }
    return require(spec);
  };
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file); return m.exports;
}
const schema = load(path.join(root, 'src/db/schema.ts')), dialect = new PgDialect();
const quote = s => `"${s.replaceAll('"', '""')}"`;
async function createTable(client, table) {
  const { name, columns } = getTableConfig(table);
  const defs = columns.map(c => {
    let d = `${quote(c.name)} ${c.getSQLType()}` + (c.primary ? ' PRIMARY KEY' : '') + (c.isUnique && !c.primary ? ' UNIQUE' : '') + (c.notNull ? ' NOT NULL' : '');
    if (c.default !== undefined) { const v = c.default; d += ' DEFAULT ' + (v && typeof v.getSQL === 'function' ? dialect.sqlToQuery(v).sql : typeof v === 'string' ? `'${v.replaceAll("'", "''")}'` : typeof v === 'object' ? `'${JSON.stringify(v)}'::jsonb` : String(v)); }
    return d;
  }); await client.exec(`CREATE TABLE ${quote(name)} (${defs.join(', ')})`);
}
(async () => {
  const client = new PGlite(); database = drizzle(client);
  const { orders, customers, products, productVariants, inventoryBatches, inventoryMovements, orderEvents, activityLog, coupons, wholesalePayments, settings } = schema;
  for (const t of [orders, customers, products, productVariants, inventoryBatches, inventoryMovements, orderEvents, activityLog, coupons, wholesalePayments, settings]) await createTable(client, t);
  const { editWholesaleInvoice } = load(path.join(root, 'src/lib/wholesale-edit.ts'));
  const { getWholesale } = load(path.join(root, 'src/lib/wholesale-data.ts'));
  await database.insert(products).values({ id: 'wallet', name: 'Wallet', nameAr: 'محفظة', category: 'wallets', priceCents: 100, salePriceIqd: 30000 });
  const [v] = await database.insert(productVariants).values({ productId: 'wallet', name: 'Brown', nameAr: 'بني', hex: '#654321', stock: 12, images: [] }).returning();
  const [batch] = await database.insert(inventoryBatches).values({ variantId: v.id, batchNumber: 'original', quantityReceived: 10, quantityRemaining: 8, purchaseCostIqd: 10000 }).returning();
  await database.insert(inventoryBatches).values({ variantId: v.id, batchNumber: 'newer', quantityReceived: 4, quantityRemaining: 4, purchaseCostIqd: 20000, receivedAt: new Date(Date.now() + 1000) });
  const date = new Date('2026-10-01T09:00:00Z');
  const [customer] = await database.insert(customers).values({ phone: '07701234567', name: 'Original', ordersCount: 1, totalSpent: 60000, lastOrderAt: date, tags: ['wholesale'] }).returning();
  const [order] = await database.insert(orders).values({ reference: 'UR-W-TEST', sessionId: 'test', customerId: customer.id, email: '', name: 'Original', phone: customer.phone, address: { city: 'Baghdad', line1: 'Shop' }, items: [{ productId: 'wallet', variantId: v.id, name: 'Wallet', color: 'Brown', quantity: 2, unitPrice: 30000, listPrice: 35000, purchaseCostCents: 10000, batchAllocations: [{ batchId: batch.id, quantity: 2 }] }], currency: 'IQD', subtotalCents: 60000, shippingCents: 0, totalCents: 60000, paidCents: 20000, status: 'delivered', source: 'wholesale', paymentMethod: 'credit', paymentStatus: 'partial', createdAt: date, deliveredAt: date, updatedAt: date }).returning();
  await database.insert(wholesalePayments).values({ orderId: order.id, amountIqd: 20000, note: 'Historical receipt' });
  const current = async () => (await database.select().from(orders).where(eq(orders.id, order.id)))[0];
  const stock = async () => (await database.select().from(productVariants).where(eq(productVariants.id, v.id)))[0].stock;
  const input = async (qty = 2, unit = 30000, extra = {}) => ({ name: 'Updated', phone: customer.phone, city: 'Baghdad', shop: 'Updated shop', note: 'Edited', discount: 0, expectedUpdatedAt: (await current()).updatedAt.toISOString(), items: [{ variantId: v.id, quantity: qty, unitPrice: unit, retailPrice: 35000 }], ...extra });
  const edit = async data => editWholesaleInvoice(order.id, data, database);
  let count = 0; async function test(name, fn) { await fn(); console.log(`PASS ${++count}: ${name}`); }
  await test('price-only edit preserves stock, costs, receipts and accounting dates', async () => {
    await edit(await input(2, 32000)); const o = await current(); assert.equal(await stock(), 12); assert.equal(o.items[0].purchaseCostCents, 10000); assert.equal(o.totalCents, 64000); assert.equal(o.profitIqd, 44000); assert.equal(o.paidCents, 20000); assert.equal(o.createdAt.toISOString(), date.toISOString()); assert.equal(o.deliveredAt.toISOString(), date.toISOString()); assert.equal((await database.select().from(wholesalePayments)).length, 1); assert.equal((await database.select().from(inventoryMovements)).length, 0);
  });
  await test('decrease returns only the difference to original batch', async () => {
    await edit(await input(1)); assert.equal(await stock(), 13); const [b] = await database.select().from(inventoryBatches).where(eq(inventoryBatches.id, batch.id)); assert.equal(b.quantityRemaining, 9); assert.equal((await current()).items[0].batchAllocations[0].quantity, 1);
  });
  await test('increase consumes only new units and retains old cost snapshots', async () => {
    await edit(await input(3)); assert.equal(await stock(), 11); const o = await current(); assert.equal(o.items.reduce((s, l) => s + l.quantity, 0), 3); assert.equal(o.items[0].quantity, 1); assert.equal(o.items[0].purchaseCostCents, 10000); const dto = await getWholesale(order.id); assert.equal(dto.updatedAt, o.updatedAt.toISOString()); assert.equal(dto.remaining, 70000);
  });
  await test('stale editor cannot overwrite a newer save', async () => {
    const stale = await input(3); await edit(await input(3, 31000)); await assert.rejects(edit(stale), e => e.status === 409);
  });
  await test('pending reservations block additional sale and rollback all changes', async () => {
    await database.insert(orders).values({ reference: 'HOLD', sessionId: 'hold', email: '', name: 'Other', address: {}, items: [{ variantId: v.id, quantity: 11 }], subtotalCents: 0, shippingCents: 0, totalCents: 0, status: 'pending' }); const before = await current(); await assert.rejects(edit(await input(4)), e => e.status === 409); assert.equal(await stock(), 11); assert.deepEqual((await current()).items, before.items); await database.delete(orders).where(eq(orders.reference, 'HOLD'));
  });
  await test('total below receipts and discount above subtotal are rejected', async () => {
    const before = await stock(); await assert.rejects(edit(await input(1, 10000)), e => e.status === 409); await assert.rejects(edit(await input(3, 30000, { discount: 999999 })), e => e.status === 400); assert.equal(await stock(), before);
  });
  await test('cash invoice increase becomes credit without inventing receipt', async () => {
    await database.update(orders).set({ paidCents: 93000, paymentMethod: 'cash', paymentStatus: 'paid' }).where(eq(orders.id, order.id)); await edit(await input(3, 33000)); const o = await current(); assert.equal(o.paymentMethod, 'credit'); assert.equal(o.paidCents, 93000); assert.equal(o.paymentStatus, 'partial');
  });
  await test('changing trader transfers totals and keeps invoice identity', async () => {
    await edit(await input(3, 33000, { phone: '07801234567', name: 'New trader' })); const old = (await database.select().from(customers).where(eq(customers.id, customer.id)))[0]; assert.equal(old.ordersCount, 0); assert.equal(old.totalSpent, 0); const o = await current(), next = (await database.select().from(customers).where(eq(customers.id, o.customerId)))[0]; assert.equal(next.ordersCount, 1); assert.equal(next.totalSpent, 99000); assert.equal(o.reference, order.reference); assert.equal((await database.select().from(wholesalePayments))[0].orderId, order.id);
  });
  await test('failed product replacement rolls back stock already returned', async () => {
    const [other] = await database.insert(productVariants).values({ productId: 'wallet', name: 'Black', hex: '#111', stock: 1, images: [] }).returning();
    const before = await current(), oldStock = await stock();
    const data = await input(3, 33000, { phone: '07801234567', items: [{ variantId: other.id, quantity: 2, unitPrice: 100000, retailPrice: 100000 }] });
    await assert.rejects(edit(data), e => e.status === 409); assert.equal(await stock(), oldStock); assert.deepEqual((await current()).items, before.items);
    await edit({ ...data, items: [{ variantId: other.id, quantity: 1, unitPrice: 100000, retailPrice: 100000 }] });
    assert.equal(await stock(), oldStock + 3); const o = await current(); assert.equal(o.items[0].variantId, other.id); assert.equal(o.items[0].purchaseCostCents, null); assert.equal(o.profitIqd, 0);
  });
  const { correctWholesalePayment } = load(path.join(root, 'src/lib/wholesale-payment-edit.ts'));
  await test('payment correction reconciles balance and retains original receipt date and stock', async () => {
    const [receipt] = await database.select().from(wholesalePayments);
    // Previous cash-increase fixture set the total paid directly; reconcile that fixture's receipt.
    await database.update(wholesalePayments).set({ amountIqd: 93000 }).where(eq(wholesalePayments.id, receipt.id));
    const before = await current(), beforeStock = await stock();
    await correctWholesalePayment(order.id, { paymentId: receipt.id, amount: 80000, note: 'Correction', expectedUpdatedAt: before.updatedAt.toISOString() }, database);
    const after = await current(), [updated] = await database.select().from(wholesalePayments);
    assert.equal(after.paidCents, 80000); assert.equal(after.totalCents, 100000); assert.equal(after.profitIqd, before.profitIqd); assert.equal(after.paymentStatus, 'partial'); assert.equal(await stock(), beforeStock); assert.equal(updated.id, receipt.id); assert.equal(updated.createdAt.toISOString(), receipt.createdAt.toISOString());
    const events = await database.select().from(orderEvents).where(eq(orderEvents.type, 'payment_corrected')); assert.match(events[0].message, /93000 → 80000/);
    await assert.rejects(correctWholesalePayment(order.id, { paymentId: receipt.id, amount: 70000, expectedUpdatedAt: before.updatedAt.toISOString() }, database), e => e.status === 409);
    await assert.rejects(correctWholesalePayment(order.id, { paymentId: receipt.id, amount: 100001, expectedUpdatedAt: after.updatedAt.toISOString() }, database), e => e.status === 400);
    assert.equal((await current()).paidCents, 80000);
  });
  await test('a mistaken receipt can be zeroed without deleting its audit identity', async () => {
    const [receipt] = await database.select().from(wholesalePayments);
    await correctWholesalePayment(order.id, { paymentId: receipt.id, amount: 0, note: 'Entered in error', expectedUpdatedAt: (await current()).updatedAt.toISOString() }, database);
    assert.equal((await current()).paidCents, 0); assert.equal((await current()).paymentStatus, 'unpaid'); assert.equal((await database.select().from(wholesalePayments)).length, 1);
  });
  await test('receipt settings normalize safe colors, logo URLs, labels and visibility', async () => {
    const { normalizeReceiptSettings, defaultWholesaleReceipt } = load(path.join(root, 'src/lib/wholesale-receipt.ts'));
    const r = normalizeReceiptSettings({ brand: '  My Store  ', accent: 'red; } html { display:none', paper: 'thermal', logoUrl: 'javascript:bad', showImages: false, labels: { total: 'Amount due', date: '' } });
    assert.equal(r.brand, 'My Store'); assert.equal(r.accent, defaultWholesaleReceipt.accent); assert.equal(r.logoUrl, defaultWholesaleReceipt.logoUrl); assert.equal(r.paper, 'thermal'); assert.equal(r.showImages, false); assert.equal(r.labels.total, 'Amount due'); assert.equal(r.labels.date, defaultWholesaleReceipt.labels.date);
    assert.equal(normalizeReceiptSettings({ terms: 'x'.repeat(2000), accent: '#112233' }).terms.length, 1000);
    assert.equal(normalizeReceiptSettings({ accent: '#112233' }).accent, '#112233');
  });
  await test('saved receipt settings survive subsequent API reads and require manage permission', async () => {
    const route = load(path.join(root, 'src/app/api/admin/wholesale/receipt-settings/route.ts'));
    const { NextRequest } = require('next/server');
    const response = await route.PUT(new NextRequest('https://test.local/api/admin/wholesale/receipt-settings', { method: 'PUT', body: JSON.stringify({ brand: 'Test brand', paper: 'thermal', showImages: false, labels: { total: 'المبلغ النهائي' } }) }));
    assert.equal(response.status, 200); const saved = await response.json(); assert.equal(saved.settings.brand, 'Test brand');
    const next = await (await route.GET()).json(); assert.equal(next.settings.brand, 'Test brand'); assert.equal(next.settings.paper, 'thermal'); assert.equal(next.settings.showImages, false); assert.equal(next.settings.labels.total, 'المبلغ النهائي');
    allowSettingsWrite = false;
    const blocked = await route.PUT(new NextRequest('https://test.local/api/admin/wholesale/receipt-settings', { method: 'PUT', body: JSON.stringify({ brand: 'Unauthorized' }) })); assert.equal(blocked.status, 403); assert.equal((await (await route.GET()).json()).settings.brand, 'Test brand');
    allowSettingsWrite = true;
  });
  await test('cancelled and ordinary invoices are not editable through wholesale', async () => {
    await database.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, order.id)); await assert.rejects(edit(await input()), e => e.status === 409); await database.update(orders).set({ status: 'delivered', source: 'website' }).where(eq(orders.id, order.id)); await assert.rejects(edit(await input()), e => e.status === 404);
  });
  await client.close(); console.log(`${count} wholesale edit checks passed; no production access.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
