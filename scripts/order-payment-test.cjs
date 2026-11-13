// Isolated PostgreSQL tests; never reads DATABASE_URL or contacts a running database.
// Run: node scripts/order-payment-test.cjs
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
 const client=new PGlite(); database=drizzle(client);
 const {orders,orderEvents,activityLog,customers,coupons,shippingZones}=schema;
 for(const t of [orders,orderEvents,activityLog,customers,coupons,shippingZones]) await createTable(client,t);
 const {transitionOrder,updateOrderDetails}=load(path.join(root,'src/lib/orders.ts'));
 const {paymentSummary,paymentMethodSummary}=load(path.join(root,'src/lib/payment-summary.ts'));
 const date=new Date('2026-11-10T09:00:00Z');
 async function insert(ref,extra={}){return (await database.insert(orders).values({reference:ref,sessionId:ref,name:'Test',email:'',address:{},items:[],status:'shipped',paymentStatus:'unpaid',subtotalCents:10000,totalCents:12000,shippingCents:2000,createdAt:date,...extra}).returning())[0];}
 async function get(id){return (await database.select().from(orders).where(eq(orders.id,id)))[0];}
 for(const method of ['cod','cash','bank_transfer','electronic']){
  const o=await insert(method,{paymentMethod:method}); await transitionOrder(o.id,'delivered',{paymentStatus:'unpaid'});const delivered=await get(o.id);assert.equal(delivered.paymentStatus,'paid');assert(delivered.deliveredAt);
  await transitionOrder(o.id,'delivered',{adminNote:'note',paymentStatus:'unpaid'});assert.equal((await get(o.id)).deliveredAt.toISOString(),delivered.deliveredAt.toISOString());
 }
 const wholesale=await insert('wholesale',{source:'wholesale',paymentMethod:'credit',paymentStatus:'partial'});await transitionOrder(wholesale.id,'delivered');assert.equal((await get(wholesale.id)).paymentStatus,'partial');
 const returned=await insert('return',{status:'delivered',paymentStatus:'paid'});await transitionOrder(returned.id,'returned');assert.equal((await get(returned.id)).paymentStatus,'refunded');
 await insert('outside',{createdAt:new Date('2026-10-01'),totalCents:999999});await insert('cancelled',{status:'cancelled'});
 const totals=await paymentSummary(new Date('2026-11-01'),new Date('2026-12-01'));const by=Object.fromEntries(totals.map(r=>[r.status,r]));assert.deepEqual(by.paid,{status:'paid',count:4,total:48000});assert.equal(by.partial.total,12000);assert.equal(by.refunded.total,12000);assert.equal(by.unpaid.total,12000);
 await database.insert(shippingZones).values({code:'baghdad',nameEn:'Baghdad',nameAr:'بغداد',rate:2000});
 const editTarget=await insert('edit',{status:'delivered',paymentStatus:'paid'});
 await updateOrderDetails(editTarget.id,{name:'Test',phone:editTarget.phone,governorate:'baghdad',city:'Baghdad',address:'Street',shippingCents:2000,discountCents:0,paymentMethod:'cash',paymentStatus:'unpaid'});assert.equal((await get(editTarget.id)).paymentStatus,'paid');
 const empty=await paymentSummary(new Date('2030-01-01'),new Date('2030-02-01'));assert(empty.every(r=>r.count===0&&r.total===0));
 await insert('cash-1',{paymentStatus:'paid',paymentMethod:'cash',phone:'07701234567'});
 await insert('cash-2',{paymentStatus:'paid',paymentMethod:'cash',phone:'07701234567'});
 await insert('bank-1',{paymentStatus:'paid',paymentMethod:'bank_transfer',phone:'07701234567'});
 await insert('unpaid-cash',{paymentStatus:'unpaid',paymentMethod:'cash',phone:'07709999999',totalCents:999999});
 await insert('refunded-cash',{paymentStatus:'refunded',paymentMethod:'cash',totalCents:999999});
 await insert('partial-cash',{paymentStatus:'partial',paymentMethod:'cash',totalCents:999999});
 await insert('outside-paid',{createdAt:new Date('2026-10-01'),paymentStatus:'paid',paymentMethod:'cash',totalCents:999999});
 await insert('email-1',{paymentStatus:'paid',paymentMethod:'electronic',email:'TEST@example.com'});
 await insert('email-2',{paymentStatus:'paid',paymentMethod:'electronic',email:'test@example.com'});
 const methods=Object.fromEntries((await paymentMethodSummary(new Date('2026-11-01'),new Date('2026-12-01'))).map(r=>[r.method,r]));
 assert.equal(methods.cash.count,4);assert.equal(methods.cash.total,38000);assert.equal(methods.cash.customers,1);
 assert.equal(methods.bank_transfer.count,2);assert.equal(methods.bank_transfer.customers,1);
 assert.equal(methods.electronic.count,3);assert.equal(methods.electronic.customers,1);
 assert.equal(methods.cod.count,1);
 const noMethods=await paymentMethodSummary(new Date('2030-01-01'),new Date('2030-02-01'));assert.equal(noMethods.length,4);assert(noMethods.every(r=>r.total===0&&r.count===0&&r.customers===0));
 console.log('PASS: all payment methods, stale unpaid override, delivery timestamp, wholesale credit, returns, period totals, empty totals');await client.close();
})().catch(e=>{console.error(e);process.exitCode=1});
