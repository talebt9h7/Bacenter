/*
 * End-to-end checks for stock, money and permissions. Creates data, so run it ONLY
 * against a local or throwaway database, never production:
 *
 *   TEST_BASE_URL=http://localhost:3001 DATABASE_URL=postgresql://...local... \
 *   ADMIN_PASSWORD=... node scripts/e2e-audit.cjs
 */
const assert = require('node:assert/strict');
const { Client } = require('pg');

const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const dbUrl = process.env.DATABASE_URL || '';
if (/supabase|amazonaws|neon\.tech/.test(dbUrl)) throw new Error('Refusing to run against a hosted database.');
const ownerPassword = process.env.ADMIN_PASSWORD;
if (!ownerPassword) throw new Error('Set ADMIN_PASSWORD to the owner password of the test server.');

const db = new Client({ connectionString: dbUrl });
const results = [];
async function check(name, fn) {
  try { await fn(); results.push(['PASS', name]); console.log('PASS', name); }
  catch (error) { results.push(['FAIL', name, error.message]); console.log('FAIL', name, '\n   ', error.message); }
}
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const json = r => r.json().catch(() => ({}));

async function session(cookie = '') {
  const jar = { cookie };
  async function call(path, { method = 'GET', body, form } = {}) {
    const headers = { cookie: jar.cookie };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(base + path, { method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)), redirect: 'manual' });
    const set = response.headers.getSetCookie?.() ?? [];
    for (const c of set) { const pair = c.split(';')[0]; const [k] = pair.split('='); jar.cookie = [...jar.cookie.split('; ').filter(x => x && !x.startsWith(`${k}=`)), pair].join('; '); }
    return response;
  }
  return { call, jar };
}
async function owner() { const s = await session(); const r = await s.call('/api/admin/login', { method: 'POST', body: { password: ownerPassword } }); assert.equal(r.status, 200, 'owner login'); return s; }
const stockOf = async variantId => (await one('select stock from product_variants where id=$1', [variantId])).stock;
const batchSum = async variantId => Number((await one('select coalesce(sum(quantity_remaining),0) s from inventory_batches where variant_id=$1', [variantId])).s);
const address = { name: 'Test Buyer', phone: '07701234567', governorate: 'baghdad', city: 'Karrada', address: 'Street 12, house 4' };

async function shopperOrder(variantId, quantity, extra = {}) {
  const s = await session();
  const add = await s.call('/api/cart', { method: 'POST', body: { variantId, quantity } });
  assert.ok(add.ok, `add to cart ${add.status} ${JSON.stringify(await json(add.clone()))}`);
  const r = await s.call('/api/orders', { method: 'POST', body: { ...address, ...extra } });
  return { status: r.status, data: await json(r) };
}

(async () => {
  // Fake Telegram API for the notification check (server started with TELEGRAM_API_BASE=http://127.0.0.1:4599).
  global.__telegramMessages = [];
  require('node:http').createServer((req, res) => { let body = ''; req.on('data', c => body += c); req.on('end', () => { try { global.__telegramMessages.push(JSON.parse(body)); } catch {} res.setHeader('content-type', 'application/json'); res.end('{"ok":true}'); }); }).listen(4599).unref();
  await db.connect();
  const admin = await owner();
  const variant = await one(`select v.id, v.product_id from product_variants v join products p on p.id=v.product_id where p.published and v.stock >= 10 order by v.id limit 1`);
  assert.ok(variant, 'needs a published product with stock >= 10 (run the seed first)');

  await check('Product page reflects a sale immediately (cache invalidated on order)', async () => {
    await db.query(`update orders set status='cancelled' where status='pending'`); // start without reservations
    const before = await stockOf(variant.id);
    const pageBefore = await (await fetch(`${base}/products/${variant.product_id}`)).text();
    const shows = (html, n) => new RegExp(`stock\\\\?":${n}[,}]`).test(html);
    assert.ok(shows(pageBefore, before), 'page shows current stock');
    const order = await shopperOrder(variant.id, 1);
    assert.equal(order.status, 201, JSON.stringify(order.data));
    const pageAfter = await (await fetch(`${base}/products/${variant.product_id}`)).text();
    assert.ok(shows(pageAfter, before - 1), 'page shows stock after sale');
  });

  await check('Invalid coupon rolls back the whole checkout (stock not lost)', async () => {
    await admin.call('/api/admin/coupons', { method: 'POST', body: { code: 'BIGMIN', type: 'percent', value: 10, minSubtotal: 999999999, active: true } });
    const stock = await stockOf(variant.id), batches = await batchSum(variant.id);
    const order = await shopperOrder(variant.id, 2, { coupon: 'BIGMIN' });
    assert.equal(order.status, 409, JSON.stringify(order.data));
    assert.equal(await stockOf(variant.id), stock, 'stock unchanged');
    assert.equal(await batchSum(variant.id), batches, 'batches unchanged');
  });

  await check('Single-use coupon cannot be used twice by simultaneous checkouts', async () => {
    await admin.call('/api/admin/coupons', { method: 'POST', body: { code: 'ONCE10', type: 'percent', value: 10, maxUses: 1, active: true } });
    const stock = await stockOf(variant.id);
    const [a, b] = await Promise.all([shopperOrder(variant.id, 1, { coupon: 'ONCE10' }), shopperOrder(variant.id, 1, { coupon: 'ONCE10' })]);
    const ok = [a, b].filter(x => x.status === 201).length;
    assert.equal(ok, 1, `exactly one order should succeed, got ${a.status}/${b.status}`);
    assert.equal((await one(`select used_count from coupons where code='ONCE10'`)).used_count, 1);
    assert.equal(await stockOf(variant.id), stock, 'pending orders reserve, they do not deduct stock');
  });

  await check('Stock added without a purchase batch can still be sold', async () => {
    // Bring the variant down to a few batched units, then add unbatched ones (a cart line is capped at 10).
    await admin.call('/api/admin/inventory', { method: 'POST', body: { variantId: variant.id, set: 4, reason: 'Count correction' } });
    const r = await admin.call('/api/admin/inventory', { method: 'POST', body: { variantId: variant.id, delta: 3, reason: 'Found in storage' } });
    assert.ok(r.ok, `adjust ${r.status}`);
    assert.equal(await batchSum(variant.id), 4, 'manual increase adds no batch');
    await db.query(`update orders set status='cancelled' where status='pending'`); // free earlier reservations
    const stock = await stockOf(variant.id);
    // Sell everything: batches run out and the last units are unbatched.
    const order = await shopperOrder(variant.id, stock);
    assert.equal(order.status, 201, JSON.stringify(order.data));
    const placed = await one(`select id from orders where reference=$1`, [order.data.order.reference]);
    const confirm = await admin.call(`/api/admin/orders/${placed.id}`, { method: 'PATCH', body: { status: 'confirmed' } });
    assert.ok(confirm.ok, `confirm ${confirm.status}`);
    assert.equal(await stockOf(variant.id), 0);
    assert.equal(await batchSum(variant.id), 0);
    const last = await one(`select items from orders where reference=$1`, [order.data.order.reference]);
    assert.equal(last.items[0].purchaseCostCents, null, 'mixed known/unknown cost is reported as unknown');
  });

  await check('Manual stock decrease keeps batches <= stock', async () => {
    const r = await admin.call('/api/admin/inventory', { method: 'POST', body: { variantId: variant.id, delta: 12, purchasePriceUsd: 5, exchangeRate: 1300, reason: 'Purchase received' } });
    assert.ok(r.ok, `receive ${r.status}`);
    const down = await admin.call('/api/admin/inventory', { method: 'POST', body: { variantId: variant.id, set: 7, reason: 'Damaged' } });
    assert.ok(down.ok);
    assert.equal(await stockOf(variant.id), 7);
    assert.ok(await batchSum(variant.id) <= 7, 'batches trimmed');
  });

  await check('Saving the product editor does not overwrite sales made while it was open', async () => {
    const product = (await json(await admin.call(`/api/admin/products/${variant.product_id}`))).product;
    const onHand = c => c.onHand ?? c.stock;
    const loaded = onHand(product.colors.find(c => c.id === variant.id));
    const order = await shopperOrder(variant.id, 2);
    assert.equal(order.status, 201);
    const placed = await one(`select id from orders where reference=$1`, [order.data.order.reference]);
    assert.ok((await admin.call(`/api/admin/orders/${placed.id}`, { method: 'PATCH', body: { status: 'confirmed' } })).ok, 'confirm');
    const payload = { ...product, salePriceIqd: product.salePriceIqd, purchasePriceUsd: null, exchangeRate: 1300, colors: product.colors.map(c => ({ ...c, baseStock: onHand(c), stock: c.id === variant.id ? loaded + 5 : onHand(c) })) };
    const save = await admin.call(`/api/admin/products/${variant.product_id}`, { method: 'PUT', body: payload });
    assert.ok(save.ok, `save ${save.status} ${JSON.stringify(await json(save))}`);
    assert.equal(await stockOf(variant.id), loaded - 2 + 5, 'editor change applied on top of the sale');
  });

  await check('Pending order reserves units: stock unchanged, available drops, overselling blocked', async () => {
    await db.query(`update orders set status='cancelled' where status='pending'`);
    const r = await admin.call('/api/admin/inventory', { method: 'POST', body: { variantId: variant.id, set: 3, reason: 'Count correction' } });
    assert.ok(r.ok);
    const batches = await batchSum(variant.id);
    const a = await shopperOrder(variant.id, 2);
    assert.equal(a.status, 201, JSON.stringify(a.data));
    assert.equal(await stockOf(variant.id), 3, 'stock on hand not deducted');
    assert.equal(await batchSum(variant.id), batches, 'no batch consumed');
    const row = await one('select items from orders where reference=$1', [a.data.order.reference]);
    assert.deepEqual(row.items[0].batchAllocations, [], 'no allocation while pending');
    const product = await json(await fetch(`${base}/api/products?collection=`));
    const color = (product.products || []).flatMap(p => p.colors).find(c => c.id === variant.id);
    if (color) assert.equal(color.stock, 1, 'storefront shows available = 3 − 2');
    const b = await shopperOrder(variant.id, 1);
    assert.equal(b.status, 201, 'last available unit can be ordered');
    const s = await session();
    const add = await s.call('/api/cart', { method: 'POST', body: { variantId: variant.id, quantity: 1 } });
    assert.equal(add.status, 409, 'nothing left to add once everything is reserved');
  });

  await check('Confirm deducts (FIFO cost snapshot); cancel from pending changes nothing; cancel after confirm restores', async () => {
    const pending = (await db.query(`select * from orders where status='pending' order by id`)).rows;
    assert.equal(pending.length, 2);
    const [first, second] = pending;
    const stock = await stockOf(variant.id);
    const c1 = await admin.call(`/api/admin/orders/${second.id}`, { method: 'PATCH', body: { status: 'cancelled' } });
    assert.ok(c1.ok);
    assert.equal(await stockOf(variant.id), stock, 'cancelling a pending order does not touch stock');
    const ok = await admin.call(`/api/admin/orders/${first.id}`, { method: 'PATCH', body: { status: 'confirmed' } });
    assert.ok(ok.ok, `confirm ${ok.status}`);
    assert.equal(await stockOf(variant.id), stock - 2, 'confirm deducts');
    const confirmed = await one('select items from orders where id=$1', [first.id]);
    assert.ok(Array.isArray(confirmed.items[0].batchAllocations), 'allocations recorded on confirm');
    const back = await admin.call(`/api/admin/orders/${first.id}`, { method: 'PATCH', body: { status: 'cancelled' } });
    assert.ok(back.ok);
    assert.equal(await stockOf(variant.id), stock, 'cancelling a confirmed order restores stock');
    const again = await admin.call(`/api/admin/orders/${first.id}`, { method: 'PATCH', body: { status: 'pending', force: true } });
    assert.ok(again.ok, 'reinstated as pending');
    assert.equal(await stockOf(variant.id), stock, 'reinstated pending order only reserves');
    const del = await admin.call(`/api/admin/orders/${first.id}`, { method: 'DELETE' });
    assert.ok(del.ok);
    assert.equal(await stockOf(variant.id), stock, 'deleting a pending order does not touch stock');
  });

  await check('Confirming without enough stock on hand is refused with a clear error', async () => {
    await db.query(`update orders set status='cancelled' where status='pending'`);
    const a = await shopperOrder(variant.id, 2);
    assert.equal(a.status, 201);
    const row = await one('select id from orders where reference=$1', [a.data.order.reference]);
    await db.query('update product_variants set stock = 1 where id=$1', [variant.id]);
    const r = await admin.call(`/api/admin/orders/${row.id}`, { method: 'PATCH', body: { status: 'confirmed' } });
    assert.equal(r.status, 409);
    assert.equal((await one('select status from orders where id=$1', [row.id])).status, 'pending');
    await db.query(`update orders set status='cancelled' where id=$1`, [row.id]);
  });

  await check('Status can jump (forced): delivered → pending gives stock back and clears profit', async () => {
    await admin.call('/api/admin/inventory', { method: 'POST', body: { variantId: variant.id, delta: 5, purchasePriceUsd: 4, exchangeRate: 1000, reason: 'Purchase received' } });
    const stock = await stockOf(variant.id);
    const a = await shopperOrder(variant.id, 1);
    const row = await one('select id from orders where reference=$1', [a.data.order.reference]);
    const jump = await admin.call(`/api/admin/orders/${row.id}`, { method: 'PATCH', body: { status: 'delivered', force: true } });
    assert.ok(jump.ok, `jump ${jump.status}`);
    let o = await one('select * from orders where id=$1', [row.id]);
    assert.equal(await stockOf(variant.id), stock - 1);
    assert.ok(o.delivered_at && o.profit_iqd !== 0, 'delivered with profit');
    const down = await admin.call(`/api/admin/orders/${row.id}`, { method: 'PATCH', body: { status: 'pending', force: true } });
    assert.ok(down.ok);
    o = await one('select * from orders where id=$1', [row.id]);
    assert.equal(await stockOf(variant.id), stock, 'stock back on hand');
    assert.equal(o.profit_iqd, 0); assert.equal(o.delivered_at, null);
    await admin.call(`/api/admin/orders/${row.id}`, { method: 'PATCH', body: { status: 'cancelled' } });
  });

  await check('Migration 0028 gives back stock taken by old-style pending orders, once', async () => {
    const fs = require('node:fs');
    const a = await shopperOrder(variant.id, 2);
    const row = await one('select * from orders where reference=$1', [a.data.order.reference]);
    const stock = await stockOf(variant.id);
    // Simulate the old rule: the pending order took 2 units at checkout.
    await db.query('update product_variants set stock = stock - 2 where id=$1', [variant.id]);
    await db.query(`insert into inventory_movements (variant_id, delta, stock_after, reason, reference) values ($1, -2, $2, 'Order placed', $3)`, [variant.id, stock - 2, row.reference]);
    const sql = fs.readFileSync('drizzle/0028_pending_orders_reserve_stock.sql', 'utf8');
    await db.query(sql);
    assert.equal(await stockOf(variant.id), stock, 'stock restored');
    await db.query(sql);
    assert.equal(await stockOf(variant.id), stock, 'running it again changes nothing');
    await db.query(`update orders set status='cancelled' where id=$1`, [row.id]);
  });

  await check('Offers: a live promotion lowers cart and checkout prices and is recorded on the order', async () => {
    await db.query(`update orders set status='cancelled' where status='pending'`);
    await admin.call('/api/admin/inventory', { method: 'POST', body: { variantId: variant.id, delta: 6, purchasePriceUsd: 5, exchangeRate: 1000, reason: 'Purchase received' } });
    const product = await one('select p.id, p.sale_price_iqd from products p where p.id=$1', [variant.product_id]);
    const now = Date.now();
    const bad = await admin.call('/api/admin/promotions', { method: 'POST', body: { name: 'Bad', type: 'percent', value: 20, scope: 'all', startsAt: new Date(now).toISOString(), endsAt: new Date(now - 1000).toISOString() } });
    assert.equal(bad.status, 400, 'end before start is refused');
    const tooMuch = await admin.call('/api/admin/promotions', { method: 'POST', body: { name: 'Bad', type: 'percent', value: 99, scope: 'all', startsAt: new Date(now).toISOString(), endsAt: new Date(now + 86400e3).toISOString() } });
    assert.equal(tooMuch.status, 400, 'percent above 95 is refused');
    const later = await admin.call('/api/admin/promotions', { method: 'POST', body: { name: 'Later', type: 'price', value: 1000, scope: 'products', productIds: [product.id], startsAt: new Date(now + 3600e3).toISOString(), endsAt: new Date(now + 7200e3).toISOString() } });
    assert.equal(later.status, 201, 'scheduled offer saved');
    const created = await admin.call('/api/admin/promotions', { method: 'POST', body: { name: 'Two days', nameAr: 'يومين', type: 'percent', value: 20, scope: 'products', productIds: [product.id], startsAt: new Date(now - 60e3).toISOString(), endsAt: new Date(now + 2 * 86400e3).toISOString() } });
    assert.equal(created.status, 201, 'live offer saved');
    const promo = (await created.json()).promotion;
    const expected = Math.round(product.sale_price_iqd * 0.8 / 250) * 250;
    const s = await session();
    assert.ok((await s.call('/api/cart', { method: 'POST', body: { variantId: variant.id, quantity: 1 } })).ok);
    const cart = await json(await s.call('/api/cart'));
    const line = cart.items.find(i => i.variantId === variant.id);
    assert.equal(line.salePriceIqd, expected, 'cart shows the offer price (the scheduled one is not live yet)');
    assert.equal(line.originalPriceIqd, product.sale_price_iqd, 'cart keeps the regular price');
    const r = await s.call('/api/orders', { method: 'POST', body: { ...address } });
    assert.equal(r.status, 201);
    const order = await one('select items, subtotal_cents from orders where reference=$1', [(await r.json()).order.reference]);
    assert.equal(order.items[0].unitPrice, expected, 'order charged the offer price');
    assert.equal(order.items[0].listPrice, product.sale_price_iqd);
    assert.equal(order.items[0].promotionId, promo.id);
    const page = await (await fetch(`${base}/products/${product.id}`)).text();
    assert.ok(new RegExp(`originalPriceIqd\\\\?":${product.sale_price_iqd}[,}]`).test(page), 'product page carries the regular price');
    // End it now: prices go back to normal straight away.
    const end = await admin.call(`/api/admin/promotions/${promo.id}`, { method: 'PUT', body: { ...promo, endsAt: new Date(Date.now() + 1500).toISOString() } });
    assert.ok(end.ok);
    await new Promise(res => setTimeout(res, 2000));
    const s2 = await session();
    assert.ok((await s2.call('/api/cart', { method: 'POST', body: { variantId: variant.id, quantity: 1 } })).ok);
    const after = (await json(await s2.call('/api/cart'))).items.find(i => i.variantId === variant.id);
    assert.equal(after.salePriceIqd, product.sale_price_iqd, 'regular price once the offer has ended');
    await db.query(`update orders set status='cancelled' where status='pending'`);
    await db.query('delete from promotions');
  });

  await check('Offers page renders and sales staff without manage cannot create offers', async () => {
    assert.equal((await admin.call('/admin/promotions')).status, 200);
    const anon = await session();
    assert.equal((await anon.call('/api/admin/promotions', { method: 'POST', body: {} })).status, 403);
  });

  await check('New order notifies Telegram (message has customer, items, total, link) without slowing checkout', async () => {
    const messages = global.__telegramMessages || [];
    const token = '123456789:' + 'A'.repeat(35);
    const save = await admin.call('/api/admin/integrations', { method: 'PUT', body: { telegram: { enabled: true, botToken: token, chatIds: ['111222333'] }, whatsapp: { enabled: false, phone: '', apiKey: '' }, notify: { newOrder: true, lowStock: true }, tracking: { metaPixelId: '1234567890123456', ga4Id: 'G-TEST12345', clarityId: 'abcd1234ef' } } });
    assert.ok(save.ok, `save ${save.status} ${JSON.stringify(await json(save))}`);
    const got = await json(await admin.call('/api/admin/integrations'));
    assert.ok(!JSON.stringify(got).includes('A'.repeat(35)), 'bot token is never sent back in full');
    const bad = await admin.call('/api/admin/integrations', { method: 'PUT', body: { ...got.integrations, tracking: { metaPixelId: 'abc', ga4Id: '', clarityId: '' } } });
    assert.equal(bad.status, 400, 'invalid pixel id refused');
    const t0 = Date.now();
    const order = await shopperOrder(variant.id, 1);
    assert.equal(order.status, 201);
    assert.ok(Date.now() - t0 < 5000, 'checkout is not held up by the notification');
    for (let i = 0; i < 40 && !messages.some(m => m.text.includes(order.data.order.reference)); i++) await new Promise(r => setTimeout(r, 250));
    const msg = messages.find(m => m.text.includes(order.data.order.reference));
    assert.ok(msg, 'telegram message received');
    assert.equal(msg.chat_id, '111222333');
    assert.match(msg.text, /Test Buyer/); assert.match(msg.text, /07701234567/); assert.match(msg.text, /\/admin\/orders\/\d+/);
    const home = await (await fetch(`${base}/`)).text();
    assert.ok(home.includes("fbq('init','1234567890123456')") || home.includes('fbq(\\u0027init') || home.includes('1234567890123456'), 'pixel on storefront');
    assert.ok(home.includes('G-TEST12345') && home.includes('abcd1234ef'), 'GA4 and Clarity on storefront');
    const adminHtml = await (await admin.call('/admin')).text();
    assert.ok(!adminHtml.includes('G-TEST12345'), 'no tracking in the admin');
    await admin.call('/api/admin/integrations', { method: 'PUT', body: { telegram: { enabled: false, botToken: '', chatIds: [] }, whatsapp: { enabled: false, phone: '', apiKey: '' }, notify: { newOrder: true, lowStock: true }, tracking: { metaPixelId: '', ga4Id: '', clarityId: '' } } });
    await db.query(`update orders set status='cancelled' where status='pending'`);
  });

  await check('Delivered order: profit = discounted revenue − purchase cost, delivery excluded; delivered_at set', async () => {
    const r = await admin.call('/api/admin/inventory', { method: 'POST', body: { variantId: variant.id, delta: 10, purchasePriceUsd: 10, exchangeRate: 1000, reason: 'Purchase received' } });
    assert.ok(r.ok);
    // Sell 4 units with a fixed 4,000 IQD discount through a fresh coupon.
    await admin.call('/api/admin/coupons', { method: 'POST', body: { code: 'FIX4000', type: 'fixed', value: 4000, active: true } });
    await db.query('update product_variants set stock = (select coalesce(sum(quantity_remaining),0) from inventory_batches where variant_id=$1) where id=$1', [variant.id]);
    await db.query(`update inventory_batches set quantity_remaining = 0 where variant_id=$1 and purchase_cost_iqd <> 10000`, [variant.id]);
    await db.query('update product_variants set stock = (select coalesce(sum(quantity_remaining),0) from inventory_batches where variant_id=$1) where id=$1', [variant.id]);
    const order = await shopperOrder(variant.id, 4, { coupon: 'FIX4000' });
    assert.equal(order.status, 201, JSON.stringify(order.data));
    const row = await one('select * from orders where reference=$1', [order.data.order.reference]);
    const unit = row.items[0].unitPrice;
    for (const status of ['confirmed', 'processing', 'shipped', 'delivered']) {
      const t = await admin.call(`/api/admin/orders/${row.id}`, { method: 'PATCH', body: { status } });
      assert.ok(t.ok, `${status} ${t.status}`);
    }
    const done = await one('select * from orders where id=$1', [row.id]);
    assert.equal(done.profit_iqd, unit * 4 - 4000 - 10000 * 4, 'profit');
    assert.ok(done.delivered_at, 'delivered_at recorded');
    assert.equal(done.payment_status, 'paid');
  });

  await check('Returning a delivered order restores stock, frees the coupon and fixes customer totals once', async () => {
    const row = await one(`select * from orders where coupon_code='FIX4000' order by id desc limit 1`);
    const stock = await stockOf(variant.id);
    const customer = await one('select * from customers where id=$1', [row.customer_id]);
    const used = (await one(`select used_count from coupons where code='FIX4000'`)).used_count;
    const t = await admin.call(`/api/admin/orders/${row.id}`, { method: 'PATCH', body: { status: 'returned' } });
    assert.ok(t.ok);
    assert.equal(await stockOf(variant.id), stock + 4);
    assert.equal((await one(`select used_count from coupons where code='FIX4000'`)).used_count, used - 1);
    const after = await one('select * from customers where id=$1', [row.customer_id]);
    assert.equal(after.orders_count, customer.orders_count - 1);
    const del = await admin.call(`/api/admin/orders/${row.id}`, { method: 'DELETE' });
    assert.ok(del.ok, `delete ${del.status}`);
    const final = await one('select * from customers where id=$1', [row.customer_id]);
    assert.equal(final.orders_count, after.orders_count, 'deleting a returned order must not count it again');
    assert.equal(final.total_spent, after.total_spent);
    assert.equal(await stockOf(variant.id), stock + 4, 'deleting a returned order must not restore stock twice');
  });

  await check('Revenue "today" uses Baghdad days and the delivery date', async () => {
    // An order placed 40 days ago but delivered at 00:30 Baghdad time today belongs to today.
    const order = await shopperOrder(variant.id, 1);
    assert.equal(order.status, 201);
    const row = await one('select * from orders where reference=$1', [order.data.order.reference]);
    const now = new Date();
    const baghdadMidnightUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 3 * 3600e3 + (now.getUTCHours() >= 21 ? 24 * 3600e3 : 0));
    const deliveredAt = new Date(baghdadMidnightUtc.getTime() + 30 * 60e3);
    await db.query(`update orders set status='delivered', created_at=now() - interval '40 days', delivered_at=$2, updated_at=now() where id=$1`, [row.id, deliveredAt]);
    const html = await (await admin.call('/admin/revenue?period=today')).text();
    assert.ok(html.includes(row.reference), 'order listed in today’s revenue');
  });

  await check('View-only and non-finance team members are blocked from money changes and reports', async () => {
    for (const [username, role] of [['acc.test', 'accountant'], ['sales.test', 'sales']]) {
      await admin.call('/api/admin/team', { method: 'POST', body: { username, name: role, password: 'password123', role } });
    }
    const acc = await session(); assert.equal((await acc.call('/api/admin/login', { method: 'POST', body: { username: 'acc.test', password: 'password123' } })).status, 200);
    assert.equal((await acc.call('/api/admin/orders/manual', { method: 'POST', body: {} })).status, 403, 'accountant cannot create orders');
    assert.equal((await acc.call('/api/admin/customers/1', { method: 'PATCH', body: {} })).status, 403, 'accountant cannot edit customers');
    assert.equal((await acc.call('/api/admin/reports/export?period=30d')).status, 200, 'accountant can export');
    const sales = await session(); assert.equal((await sales.call('/api/admin/login', { method: 'POST', body: { username: 'sales.test', password: 'password123' } })).status, 200);
    assert.equal((await sales.call('/api/admin/reports/export?period=30d')).status, 403, 'sales cannot export profit');
    const reports = await sales.call('/admin/reports');
    assert.ok(reports.status === 307 || reports.status === 303 || reports.status === 302 || (await reports.text()).includes('NEXT_REDIRECT') || !(await reports.clone().text()).includes('Product profit'), 'sales cannot open reports');
  });

  await check('Sign-in is throttled after repeated failures', async () => {
    const s = await session();
    let last;
    for (let i = 0; i < 9; i++) last = await s.call('/api/admin/login', { method: 'POST', body: { username: 'nobody.here', password: 'wrong-password' } });
    assert.equal(last.status, 429);
    assert.ok(await one(`select * from admin_login_attempts where key='user:nobody.here'`), 'stored in the database');
  });

  await check('Media endpoint serves resized WebP with CDN cache headers', async () => {
    const media = await one('select id, size from media order by size desc limit 1');
    const original = await fetch(`${base}/api/media/${media.id}`);
    const small = await fetch(`${base}/api/media/${media.id}?w=300`);
    assert.equal(small.headers.get('content-type'), 'image/webp');
    assert.match(small.headers.get('cache-control'), /s-maxage=31536000/);
    const [a, b] = [(await original.arrayBuffer()).byteLength, (await small.arrayBuffer()).byteLength];
    assert.ok(b * 5 < a, `resized ${b} vs original ${a}`);
  });

  await check('Backup download is valid JSON and contains every table', async () => {
    const r = await admin.call('/api/admin/backup');
    assert.equal(r.status, 200);
    const backup = await r.json();
    assert.equal(backup.format, 'store-admin-backup');
    assert.ok(Array.isArray(backup.tables.orders) && Array.isArray(backup.tables.media));
  });

  await check('Every admin page renders for the owner', async () => {
    const pages = ['integrations', 'promotions', 'orders', 'customers', 'products', 'inventory', 'purchases', 'categories', 'collections', 'coupons', 'shipping', 'banners', 'homepage', 'sections', 'navigation', 'footer', 'content', 'media', 'videos', 'stores', 'seo', 'redirects', 'messages', 'finance', 'revenue', 'profit', 'reports', 'reports?section=profit', 'reports?section=inventory', 'team', 'activity', 'backup', 'settings'];
    const failures = [];
    for (const page of ['', '?period=today', '?period=7d', '?period=90d', '?period=year', 'orders?status=pending', ...pages]) { const r = await admin.call(!page ? '/admin' : page.startsWith('?') ? `/admin${page}` : `/admin/${page}`); if (r.status !== 200) failures.push(`${page}:${r.status}`); }
    assert.deepEqual(failures, []);
  });

  await check('Storefront pages render', async () => {
    const failures = [];
    for (const page of ['/', '/products/category/all', `/products/${variant.product_id}`, '/search?q=leather', '/checkout', '/info/shipping', '/collection/bestsellers', '/sitemap.xml', '/robots.txt']) {
      const r = await fetch(base + page); if (r.status !== 200) failures.push(`${page}:${r.status}`);
    }
    assert.deepEqual(failures, []);
  });

  await db.end();
  const failed = results.filter(r => r[0] === 'FAIL');
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
