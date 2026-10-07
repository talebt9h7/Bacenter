import { NextRequest } from 'next/server';
import { and, gte, lte, desc } from 'drizzle-orm';
import { db } from '@/db';
import { orders, products, productVariants, inventoryBatches, expenses } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { lineNetRevenue, lineProductProfit, orderProductProfit } from '@/lib/orders';

const liveStatuses = ['delivered'];
type Item = { productId?: string; variantId?: number; name?: string; color?: string; quantity?: number; unitPrice?: number; profitIqd?: number | null; purchaseCostCents?: number | null };
const n=(v:unknown)=>{const x=Number(v);return Number.isFinite(x)?x:0};
const itemsOf=(o:any)=>Array.isArray(o.items)?o.items as Item[]:[];
const orderProfit=(o:any)=>orderProductProfit(itemsOf(o),n(o.discountCents));
const grossRevenue=(o:any)=>itemsOf(o).reduce((s,i)=>s+n(i.unitPrice)*n(i.quantity),0);
const netRevenue=(o:any)=>Math.max(0,grossRevenue(o)-n(o.discountCents));
function dates(p:string|undefined,fromQ:string|undefined,toQ:string|undefined){
  const now=new Date(); const from=fromQ?new Date(`${fromQ}T00:00:00`):new Date(); const to=toQ?new Date(`${toQ}T23:59:59.999`):new Date();
  if(!fromQ){if(p==='today') from.setHours(0,0,0,0); else if(p==='7d'){from.setDate(from.getDate()-6);from.setHours(0,0,0,0)} else if(p==='90d'){from.setDate(from.getDate()-89);from.setHours(0,0,0,0)} else if(p==='year'){from.setMonth(0,1);from.setHours(0,0,0,0)} else {from.setDate(from.getDate()-29);from.setHours(0,0,0,0)}}
  if(!toQ) to.setHours(23,59,59,999); return {from,to};
}
const esc=(v:unknown)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const cell=(v:unknown)=>`<Cell><Data ss:Type="${typeof v==='number'?'Number':'String'}">${esc(v)}</Data></Cell>`;
const row=(vals:unknown[])=>`<Row>${vals.map(cell).join('')}</Row>`;
const sheet=(name:string,headers:string[],rows:unknown[][])=>`<Worksheet ss:Name="${esc(name)}"><Table><Row>${headers.map(h=>`<Cell ss:StyleID="Header"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('')}</Row>${rows.map(row).join('')}</Table></Worksheet>`;

export async function GET(req:NextRequest){
  const actor=await requireAdminSection('overview','view'); if(!actor) return new Response('Forbidden',{status:403});
  const sp=req.nextUrl.searchParams; const {from,to}=dates(sp.get('period')||'30d',sp.get('from')||undefined,sp.get('to')||undefined);
  const [os,ps,vs,bs,es]=await Promise.all([
    db.select().from(orders).where(and(gte(orders.createdAt,from),lte(orders.createdAt,to))).orderBy(desc(orders.createdAt)).limit(20000),
    db.select().from(products), db.select().from(productVariants), db.select().from(inventoryBatches),
    db.select().from(expenses).where(and(gte(expenses.expenseDate,from),lte(expenses.expenseDate,to))).orderBy(desc(expenses.expenseDate))
  ]);
  const pm=new Map(ps.map(p=>[p.id,p])); const vm=new Map(vs.map(v=>[v.id,v]));
  const live=os.filter(o=>liveStatuses.includes(o.status));
  const agg=new Map<string,{product:string;color:string;units:number;revenue:number;profit:number;orders:Set<number>;lastSale:number}>();
  const orderRows:unknown[][]=[];
  for(const o of live){
    const op=orderProfit(o);
    for(const it of itemsOf(o)){
      const qty=n(it.quantity),sale=n(it.unitPrice),discount=n(o.discountCents),lineRevenue=lineNetRevenue(it,itemsOf(o),discount),lineProfit=lineProductProfit(it,itemsOf(o),discount);
      const key=`${it.productId||it.name||'unknown'}::${it.variantId||it.color||''}`;
      const p=pm.get(it.productId||''); const v=it.variantId?vm.get(it.variantId):undefined;
      const a=agg.get(key)||{product:p?.name||it.name||'Unknown',color:it.color||v?.name||'',units:0,revenue:0,profit:0,orders:new Set<number>(),lastSale:0};
      a.units+=qty; a.revenue+=lineRevenue; a.profit+=lineProfit; a.orders.add(o.id); a.lastSale=sale; agg.set(key,a);
    }
    orderRows.push([o.reference,new Date(o.createdAt).toISOString().slice(0,10),o.name,o.status,netRevenue(o),n(o.shippingCents),n(o.discountCents),op,n(o.totalCents)]);
  }
  const productRows=[...agg.values()].sort((a,b)=>b.units-a.units).map(a=>[a.product,a.color,a.units,a.lastSale,a.revenue,a.profit,a.revenue?a.profit/a.revenue:0,a.orders.size]);
  const inventoryRows=bs.map(b=>{const v=vm.get(b.variantId),p=v?pm.get(v.productId):undefined;return [p?.name||'Unknown',v?.name||'',b.batchNumber,b.quantityReceived,b.quantityRemaining,b.purchaseCostIqd??'',b.purchaseCostIqd==null?'':n(b.purchaseCostIqd)*n(b.quantityRemaining),new Date(b.receivedAt).toISOString().slice(0,10)]});
  const revenue=live.reduce((s,o)=>s+netRevenue(o),0);
  const discounts=live.reduce((s,o)=>s+n(o.discountCents),0);
  const profit=live.reduce((s,o)=>s+orderProfit(o),0);
  const units=live.reduce((s,o)=>s+itemsOf(o).reduce((a,i)=>a+n(i.quantity),0),0);
  const operating=es.reduce((s,e)=>s+n(e.amountIqd),0);
  const summaryRows=[['From',from.toISOString()],['To',to.toISOString()],['Total orders',live.length],['Total units sold',units],['Total revenue',revenue],['Total discounts',discounts],['Total product profit',profit],['Average product profit / delivered order',live.length?profit/live.length:0],['Operating expenses',operating],['Net after operating expenses',profit-operating],['Stock value (purchase basis)',bs.reduce((s,b)=>s+(b.purchaseCostIqd==null?0:n(b.purchaseCostIqd)*n(b.quantityRemaining)),0)]];
  const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1"/></Style></Styles>${sheet('Summary',['Metric','Value'],summaryRows)}${sheet('Orders',['رقم الطلب','التاريخ','العميل','الحالة','إيرادات المنتجات بعد الخصم','التوصيل','الخصم','الربح','إجمالي الطلب'],orderRows)}${sheet('Products',['المنتج','اللون / المتغير','الوحدات المباعة','سعر البيع للوحدة','إجمالي الإيرادات','إجمالي الربح','هامش الربح','عدد الطلبات'],productRows)}${sheet('Inventory',['المنتج','المتغير','الدفعة','المستلم','المتبقي','سعر الشراء للوحدة','قيمة المخزون','تاريخ الاستلام'],inventoryRows)}</Workbook>`;
  return new Response(xml,{headers:{'Content-Type':'application/vnd.ms-excel; charset=utf-8','Content-Disposition':`attachment; filename="UR-profit-report-${new Date().toISOString().slice(0,10)}.xls"`}});
}
