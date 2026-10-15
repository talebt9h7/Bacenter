/*
 * Procurement checks (local DB only): supplier, multi-line USD purchase with shipping spread over
 * units, ordered → received, payments FIFO, balances, cancel rules.
 *   TEST_BASE_URL=http://localhost:3001 ADMIN_PASSWORD=... node scripts/procurement-check.cjs <localDbUrl>
 */
const assert = require('node:assert/strict');
const { Client } = require('pg');
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
(async () => {
  if (/supabase|amazonaws|neon\.tech/.test(process.argv[2] || '')) throw new Error('Refusing to run against a hosted database.');
  const db = new Client({ connectionString: process.argv[2] }); await db.connect();
  await db.query('delete from admin_login_attempts');
  let cookie = '';
  const call = async (path, { method = 'GET', body } = {}) => { const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', cookie: cookie + '; UR_lang=en' }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; return { status: r.status, ok: r.ok, data: await r.json().catch(() => ({})) }; };
  assert.ok((await call('/api/admin/login', { method: 'POST', body: { password: process.env.ADMIN_PASSWORD } })).ok, 'login');
  const results = [];
  const check = async (name, fn) => { try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
  const { rows: vs } = await db.query('select id, stock from product_variants order by id limit 2');
  const [a, b] = vs;
  let supplierId, purchaseId, ref;

  await check('Supplier: create with terms and opening balance; bad email rejected', async () => {
    const bad = await call('/api/admin/suppliers', { method: 'POST', body: { name: 'X', } }); assert.equal(bad.status, 400);
    const badMail = await call('/api/admin/suppliers', { method: 'POST', body: { name: 'Test Tannery', email: 'nope' } }); assert.equal(badMail.status, 400);
    const r = await call('/api/admin/suppliers', { method: 'POST', body: { name: `Tannery ${Date.now()}`, phone: '07701234567', paymentTermsDays: 30, openingBalanceIqd: 100000 } });
    assert.ok(r.ok, JSON.stringify(r.data)); supplierId = r.data.id;
  });
  await check('Purchase (USD, ordered): landed cost spreads shipping by value; no stock yet', async () => {
    const r = await call('/api/admin/purchases', { method: 'POST', body: { supplierId, currency: 'USD', exchangeRate: 1500, status: 'ordered', extraCostsIqd: 30000, discountIqd: 0, paidNow: 50000, items: [{ variantId: a.id, quantity: 10, unitCost: 1000 }, { variantId: b.id, quantity: 10, unitCost: 2000, salePriceIqd: 90000 }] } });
    assert.ok(r.ok, JSON.stringify(r.data)); purchaseId = r.data.id; ref = r.data.reference;
    // goods: 10*15000 + 10*30000 = 450000; shipping 30000 → a gets 1/3 (10000 → +1000/unit), b 2/3 (+2000/unit)
    const { rows } = await db.query('select variant_id, landed_cost_iqd from purchase_items where purchase_id=$1 order by variant_id', [purchaseId]);
    assert.deepEqual(rows.map(r => r.landed_cost_iqd), [16000, 32000]);
    const { rows: [p] } = await db.query('select total_cost_iqd, status from purchases where id=$1', [purchaseId]);
    assert.equal(p.total_cost_iqd, 480000); assert.equal(p.status, 'ordered');
    const { rows: [s] } = await db.query('select stock from product_variants where id=$1', [a.id]); assert.equal(s.stock, a.stock);
  });
  await check('Receive: batches at landed cost, stock up, sale price updated', async () => {
    const r = await call(`/api/admin/purchases/${purchaseId}`, { method: 'POST', body: { action: 'receive' } }); assert.ok(r.ok, JSON.stringify(r.data));
    const again = await call(`/api/admin/purchases/${purchaseId}`, { method: 'POST', body: { action: 'receive' } }); assert.equal(again.status, 409);
    const { rows: [s] } = await db.query('select stock from product_variants where id=$1', [a.id]); assert.equal(s.stock, a.stock + 10);
    const { rows: batches } = await db.query('select purchase_cost_iqd, quantity_remaining from inventory_batches where batch_number=$1 order by variant_id', [ref]);
    assert.deepEqual(batches.map(x => x.purchase_cost_iqd), [16000, 32000]);
    const { rows: [prod] } = await db.query('select p.sale_price_iqd from products p join product_variants v on v.product_id=p.id where v.id=$1', [b.id]); assert.equal(prod.sale_price_iqd, 90000);
  });
  await check('Balances: opening + received − payments; purchase paid/remaining via FIFO', async () => {
    const { data } = await call('/api/admin/purchases');
    const s = data.suppliers.find(x => x.id === supplierId); const p = data.purchases.find(x => x.id === purchaseId);
    assert.equal(s.balanceIqd, 100000 + 480000 - 50000);
    assert.equal(p.paidIqd, 50000); assert.equal(p.remainingIqd, 430000);
    const pay = await call('/api/admin/supplier-payments', { method: 'POST', body: { supplierId, amountIqd: 150000, method: 'cash' } }); assert.ok(pay.ok);
    const { data: d2 } = await call('/api/admin/purchases');
    const p2 = d2.purchases.find(x => x.id === purchaseId); const s2 = d2.suppliers.find(x => x.id === supplierId);
    assert.equal(s2.balanceIqd, 380000);
    assert.equal(p2.paidIqd, 100000, 'account payment settles the 100,000 opening balance first, then 50,000 to the purchase');
    const del = await call(`/api/admin/supplier-payments/${pay.data.id}`, { method: 'DELETE' }); assert.ok(del.ok);
  });
  await check('Validation: duplicate reference, duplicate line, overpay, unknown supplier', async () => {
    assert.equal((await call('/api/admin/purchases', { method: 'POST', body: { reference: ref, items: [{ variantId: a.id, quantity: 1, unitCost: 1 }] } })).status, 409);
    assert.equal((await call('/api/admin/purchases', { method: 'POST', body: { items: [{ variantId: a.id, quantity: 1, unitCost: 1 }, { variantId: a.id, quantity: 1, unitCost: 1 }] } })).status, 400);
    assert.equal((await call('/api/admin/purchases', { method: 'POST', body: { supplierId, paidNow: 999999, items: [{ variantId: a.id, quantity: 1, unitCost: 1000 }] } })).status, 400);
    assert.equal((await call('/api/admin/purchases', { method: 'POST', body: { supplierId: 99999999, items: [{ variantId: a.id, quantity: 1, unitCost: 1000 }] } })).status, 404);
    assert.equal((await call('/api/admin/purchases', { method: 'POST', body: { items: [{ variantId: a.id, quantity: 0, unitCost: 1000 }] } })).status, 400);
  });
  await check('Cancel: blocked once units sold; allowed otherwise and stock returns', async () => {
    await db.query('update inventory_batches set quantity_remaining = quantity_remaining - 1 where batch_number=$1 and variant_id=$2', [ref, a.id]);
    assert.equal((await call(`/api/admin/purchases/${purchaseId}`, { method: 'POST', body: { action: 'cancel' } })).status, 409);
    await db.query('update inventory_batches set quantity_remaining = quantity_received where batch_number=$1', [ref]);
    const r = await call(`/api/admin/purchases/${purchaseId}`, { method: 'POST', body: { action: 'cancel' } }); assert.ok(r.ok, JSON.stringify(r.data));
    const { rows: [s] } = await db.query('select stock from product_variants where id=$1', [a.id]); assert.equal(s.stock, a.stock);
    const { rows: bt } = await db.query('select count(*)::int n from inventory_batches where batch_number=$1', [ref]); assert.equal(bt[0].n, 0);
    const { data } = await call('/api/admin/purchases'); assert.equal(data.suppliers.find(x => x.id === supplierId).balanceIqd, 100000 - 50000);
  });
  await check('IQD received purchase with discount; pages render', async () => {
    const r = await call('/api/admin/purchases', { method: 'POST', body: { supplierId, currency: 'IQD', status: 'received', discountIqd: 5000, items: [{ variantId: a.id, quantity: 5, unitCost: 20000 }] } });
    assert.ok(r.ok); const { rows: [it] } = await db.query('select landed_cost_iqd from purchase_items where purchase_id=$1', [r.data.id]); assert.equal(it.landed_cost_iqd, 19000);
    for (const path of ['/admin/purchases', `/admin/print/purchase/${r.data.id}`, `/admin/print/supplier/${supplierId}`]) { const res = await fetch(base + path, { headers: { cookie } }); assert.equal(res.status, 200, path); }
    await call(`/api/admin/purchases/${r.data.id}`, { method: 'POST', body: { action: 'cancel' } });
  });
  await check('Supplier edit and archive', async () => {
    assert.ok((await call(`/api/admin/suppliers/${supplierId}`, { method: 'PATCH', body: { name: 'Renamed Tannery', city: 'Erbil', paymentTermsDays: 15 } })).ok);
    assert.ok((await call(`/api/admin/suppliers/${supplierId}`, { method: 'PATCH', body: { active: false } })).ok);
    const { rows: [s] } = await db.query('select name, city, active from suppliers where id=$1', [supplierId]); assert.deepEqual([s.name, s.city, s.active], ['Renamed Tannery', 'Erbil', false]);
  });
  for (const r of results) console.log(r.join(' '));
  console.log(`${results.filter(r => r[0] === 'PASS').length}/${results.length}`);
  await db.end();
  process.exit(results.some(r => r[0] === 'FAIL') ? 1 : 0);
})();
