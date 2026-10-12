import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { and, desc, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { expenses, orders, purchases, inventoryBatches } from '@/db/schema';
import FinanceClient from '@/components/admin/finance-client';
import { orderProductProfit } from '@/lib/orders';
import { isRecognizedIn, ordersTouchingRange, reportRange } from '@/lib/report-period';

export const metadata = { title: 'Finance' };
export const dynamic = 'force-dynamic';
const categories = ['marketing','advertising','packaging','salary','rent','software','delivery','photography','operations','other'];
const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:0};
export default async function FinancePage({searchParams}:{searchParams:Promise<{period?:string}>}){
 const actor=await requireAdminSection('finance','view');if(!actor)redirect('/admin');
 const {period='30d'}=await searchParams;const {from,to}=reportRange(period);
 const [rows,orderRows,purchaseRows,batchRows]=await Promise.all([db.select().from(expenses).where(and(gte(expenses.expenseDate,from),lte(expenses.expenseDate,to))).orderBy(desc(expenses.expenseDate)),db.select().from(orders).where(ordersTouchingRange(from,to)).orderBy(desc(orders.createdAt)),db.select().from(purchases).where(and(gte(purchases.purchaseDate,from),lte(purchases.purchaseDate,to))).orderBy(desc(purchases.purchaseDate)),db.select({quantityRemaining:inventoryBatches.quantityRemaining,purchaseCostIqd:inventoryBatches.purchaseCostIqd}).from(inventoryBatches)]);
 // Revenue/profit count orders delivered in the period (recognised on delivery).
 const live=orderRows.filter(o=>isRecognizedIn(o,from,to));
 const revenue=live.reduce((s,o)=>{const gross=Array.isArray(o.items)?(o.items as {unitPrice?:number;quantity:number}[]).reduce((a,i)=>a+num(i.unitPrice)*num(i.quantity),0):0;return s+Math.max(0,gross-num(o.discountCents))},0);
 const productCost=live.reduce((s,o)=>s+(Array.isArray(o.items)?(o.items as {purchaseCostCents?:number|null;quantity:number}[]).reduce((a,i)=>a+(i.purchaseCostCents==null?0:num(i.purchaseCostCents)*num(i.quantity)),0):0),0);
 const totalExpenses=rows.reduce((s,e)=>s+num(e.amountIqd),0);const totalPurchases=purchaseRows.reduce((s,p)=>s+num(p.totalCostIqd),0);const stockValue=batchRows.reduce((s,b)=>s+(b.purchaseCostIqd==null?0:num(b.purchaseCostIqd)*num(b.quantityRemaining)),0);const unknownStockUnits=batchRows.reduce((s,b)=>s+(b.purchaseCostIqd==null?num(b.quantityRemaining):0),0);const grossProfit=live.reduce((sum,o)=>sum+orderProductProfit(Array.isArray(o.items)?o.items as any[]:[],num(o.discountCents)),0);const net=grossProfit-totalExpenses;
 const byCat=categories.map(c=>[c,rows.filter(e=>e.category===c).reduce((s,e)=>s+num(e.amountIqd),0)] as [string,number]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
 return <FinanceClient totalPurchases={totalPurchases} stockValue={stockValue} unknownStockUnits={unknownStockUnits} grossProfit={grossProfit} rows={rows.map(e=>({id:e.id,expenseDate:new Date(e.expenseDate).toISOString(),description:e.description,reference:e.reference,category:e.category,paymentMethod:e.paymentMethod,amountIqd:Number(e.amountIqd)}))} revenue={revenue} productCost={productCost} totalExpenses={totalExpenses} net={net} byCat={byCat} period={period}/>;
}
