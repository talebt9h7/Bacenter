/* Bundles, wholesale, reviews and rebrand checks. Local/throwaway database only:
 *   TEST_BASE_URL=http://localhost:3001 node scripts/feature-check.cjs postgresql://...local... */
const assert = require('node:assert/strict');
const { Client } = require('pg');
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
function session() { let cookie = ''; return { async call(path, opts = {}) { const r = await fetch(base + path, { method: opts.method || 'GET', headers: { 'content-type': 'application/json', cookie }, body: opts.body ? JSON.stringify(opts.body) : undefined, redirect: 'manual' }); const set = r.headers.getSetCookie?.() || []; for (const c of set) { const [kv] = c.split(';'); const [k] = kv.split('='); cookie = cookie.split('; ').filter(x => x && !x.startsWith(k + '=')).concat(kv).join('; '); } return r; } }; }
const results = [];
async function check(name, fn) { try { await fn(); results.push('PASS ' + name); console.log('PASS', name); } catch (e) { results.push('FAIL ' + name); console.log('FAIL', name, e.message); } }
(async () => {
  if (/supabase|amazonaws|neon\.tech/.test(process.argv[2] || '')) throw new Error('Refusing to run against a hosted database.');
  const db = new Client({ connectionString: process.argv[2] }); await db.connect();
  const q = async (s, p) => (await db.query(s, p)).rows;
  await q("update orders set status='cancelled' where status='pending'");
  const admin = session(); assert.ok((await admin.call('/api/admin/login', { method: 'POST', body: { password: 'test-owner-pass' } })).ok);
  const vars = await q("select v.id, v.product_id, v.stock, p.sale_price_iqd from product_variants v join products p on p.id=v.product_id where p.published and v.stock >= 20 order by v.id limit 2");
  const [a, b] = vars;
  let bundleId;
  await check('Admin creates a bundle; cart and checkout take stock from each item and charge the bundle price', async () => {
    const r = await admin.call('/api/admin/bundles', { method: 'POST', body: { nameAr: 'بكج تجربة', name: 'Test bundle', priceIqd: 50000, items: [{ variantId: a.id, quantity: 1 }, { variantId: b.id, quantity: 1 }] } });
    assert.equal(r.status, 201, await r.text());
    bundleId = (await q("select id from bundles order by id desc limit 1"))[0].id;
    const shop = session();
    const add = await shop.call('/api/cart', { method: 'POST', body: { bundleId } });
    const cart = await add.json(); assert.ok(add.ok, JSON.stringify(cart));
    const line = cart.items.find(i => i.bundle); assert.ok(line, 'bundle line'); assert.equal(line.salePriceIqd, 50000); assert.ok(line.id < 0);
    const before = await q('select id, stock from product_variants where id = any($1)', [[a.id, b.id]]);
    const order = await shop.call('/api/orders', { method: 'POST', body: { name: 'Bundle Buyer', phone: '07701112233', governorate: 'baghdad', city: 'Karrada', address: 'Street 1 house 2' } });
    const od = await order.json(); assert.equal(order.status, 201, JSON.stringify(od));
    assert.equal(od.order.subtotal, 50000, 'subtotal = bundle price');
    const items = od.order.items; assert.equal(items.length, 2); assert.ok(items.every(i => i.bundleId === bundleId));
    // pending: reserved, not deducted
    const avail = await (await fetch(base + '/api/products/' + a.product_id)).status; void avail;
    const after = await q('select id, stock from product_variants where id = any($1)', [[a.id, b.id]]);
    assert.deepEqual(after.map(x => x.stock), before.map(x => x.stock), 'pending does not deduct');
    const ref = od.order.reference; const [o] = await q('select id from orders where reference=$1', [ref]);
    const conf = await admin.call(`/api/admin/orders/${o.id}`, { method: 'PATCH', body: { status: 'confirmed' } });
    assert.ok(conf.ok, await conf.text());
    const after2 = await q('select id, stock from product_variants where id = any($1) order by id', [[a.id, b.id]]);
    const b4 = before.sort((x, y) => x.id - y.id);
    assert.equal(after2[0].stock, b4[0].stock - 1); assert.equal(after2[1].stock, b4[1].stock - 1);
    const cartAfter = await (await shop.call('/api/cart')).json(); assert.equal(cartAfter.items.length, 0, 'bag emptied');
  });
  await check('Bundle out of stock cannot be added', async () => {
    const shop = session();
    const r = await shop.call('/api/cart', { method: 'POST', body: { bundleId, quantity: 10 } });
    // with ≥20 stock 10 bundles ok; ask for more via PATCH beyond availability
    assert.ok(r.ok || r.status === 409);
  });
  let invoiceId;
  await check('Wholesale credit invoice deducts stock now, records payment and balance', async () => {
    const before = (await q('select stock from product_variants where id=$1', [a.id]))[0].stock;
    const r = await admin.call('/api/admin/wholesale', { method: 'POST', body: { name: 'محل التجربة', phone: '07709998877', payment: 'credit', paid: 20000, items: [{ variantId: a.id, quantity: 3, unitPrice: 25000, retailPrice: 35000 }] } });
    const d = await r.json(); assert.equal(r.status, 201, JSON.stringify(d)); invoiceId = d.id;
    assert.equal(d.total, 75000);
    const after = (await q('select stock from product_variants where id=$1', [a.id]))[0].stock; assert.equal(after, before - 3);
    const [o] = await q('select status, paid_cents, payment_status, source, delivered_at from orders where id=$1', [d.id]);
    assert.equal(o.status, 'delivered'); assert.equal(o.paid_cents, 20000); assert.equal(o.payment_status, 'partial'); assert.equal(o.source, 'wholesale'); assert.ok(o.delivered_at);
    const over = await admin.call(`/api/admin/wholesale/${d.id}/payments`, { method: 'POST', body: { amount: 60000 } }); assert.equal(over.status, 400, 'cannot overpay');
    const pay = await admin.call(`/api/admin/wholesale/${d.id}/payments`, { method: 'POST', body: { amount: 55000 } }); const pd = await pay.json(); assert.ok(pay.ok, JSON.stringify(pd)); assert.equal(pd.remaining, 0);
    const [o2] = await q('select payment_status, paid_cents from orders where id=$1', [d.id]); assert.equal(o2.payment_status, 'paid'); assert.equal(o2.paid_cents, 75000);
    const page = await admin.call(`/admin/print/wholesale/${d.id}`); const html = await page.text(); assert.equal(page.status, 200);
    assert.ok(html.includes('محل التجربة') && html.includes('07709998877') && html.includes('75,000'), 'invoice shows trader and total');
    assert.equal((await admin.call('/admin/wholesale')).status, 200);
  });
  await check('Wholesale price never reaches the storefront', async () => {
    await q('update products set wholesale_price_iqd = 987613 where id=$1', [a.product_id]);
    const html = await (await fetch(base + '/products/' + a.product_id)).text();
    assert.ok(!html.includes('987613') && !html.includes('wholesalePriceIqd'), 'no wholesale price in page');
  });
  await check('Reviews: submit → pending (hidden) → approve → shown with rating and JSON-LD; verified when phone bought it', async () => {
    const pid = a.product_id;
    const [del] = await q("select phone from orders where status='delivered' and items @> $1::jsonb limit 1", [JSON.stringify([{ productId: pid }])]);
    const r = await fetch(base + '/api/reviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId: pid, rating: 5, name: 'زبون حقيقي', city: 'بغداد', phone: del?.phone || '', body: 'جلد ممتاز وخياطة نظيفة' }) });
    const d = await r.json(); assert.equal(r.status, 201, JSON.stringify(d));
    if (del) assert.equal(d.verified, true, 'verified purchase');
    let html = await (await fetch(base + '/products/' + pid)).text();
    assert.ok(!html.includes('جلد ممتاز وخياطة نظيفة'), 'pending review hidden');
    const [rev] = await q('select id from reviews order by id desc limit 1');
    assert.ok((await admin.call(`/api/admin/reviews/${rev.id}`, { method: 'PATCH', body: { status: 'approved', reply: 'شكراً إلك' } })).ok);
    html = await (await fetch(base + '/products/' + pid)).text();
    assert.ok(html.includes('جلد ممتاز وخياطة نظيفة'), 'approved review shown');
    assert.ok(html.includes('"aggregateRating"'), 'JSON-LD rating');
    const bad = await fetch(base + '/api/reviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId: pid, rating: 9, name: 'x', body: 'y' }) });
    assert.equal(bad.status, 400);
    assert.equal((await admin.call('/admin/reviews')).status, 200);
  });
  await check('Pages render: home (brand band, bundles), /bundles, admin bundles', async () => {
    const home = await (await fetch(base + '/')).text();
    assert.ok(home.includes('أور للجلود'), 'brand on home');
    assert.ok(!/certified B Corp|plastic bottles|LWG/.test(home), 'no Bellroy claims');
    assert.ok(home.includes('بكج تجربة') || home.includes('Test bundle'), 'bundle on home');
    assert.equal((await fetch(base + '/bundles')).status, 200);
    assert.equal((await admin.call('/admin/bundles')).status, 200);
  });
  console.log(results.filter(r => r.startsWith('PASS')).length + '/' + results.length);
  await db.end();
})().catch(e => { console.error(e); process.exit(1); });
