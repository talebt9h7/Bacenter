import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { and, desc, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { expenses, orders, purchases, inventoryBatches } from '@/db/schema';
import FinanceClient from '@/components/admin/finance-client';
import { inventoryValuation, summarize } from '@/lib/finance';
import { productVariants } from '@/db/schema';
import { isRecognizedIn, ordersTouchingRange, reportRange } from '@/lib/report-period';

export const metadata = { title: 'Finance' };
export const dynamic = 'force-dynamic';
const categories = ['marketing','advertising','packaging','salary','rent','software','delivery','photography','operations','other'];
const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:0};
export default async function FinancePage({searchParams}:{searchParams:Promise<{period?:string}>}){
 const actor=await requireAdminSection('finance','view');if(!actor)redirect('/admin');
 const {period='30d'}=await searchParams;const {from,to}=reportRange(period);
 const [rows,orderRows,purchaseRows,batchRows]=await Promise.all([db.select().from(expenses).where(and(gte(expenses.expenseDate,from),lte(expenses.expenseDate,to))).orderBy(desc(expenses.expenseDate)),db.select().from(orders).where(ordersTouchingRange(from,to)).orderBy(desc(orders.createdAt)),db.select().from(purchases).where(and(gte(purchases.purchaseDate,from),lte(purchases.purchaseDate,to))).orderBy(desc(purchases.purchaseDate)),db.select({variantId:inventoryBatches.variantId,quantityRemaining:inventoryBatches.quantityRemaining,quantityReceived:inventoryBatches.quantityReceived,purchaseCostIqd:inventoryBatches.purchaseCostIqd,receivedAt:inventoryBatches.receivedAt}).from(inventoryBatches)]);
 const variantRows=await db.select({id:productVariants.id,stock:productVariants.stock}).from(productVariants);
 // Revenue/profit count orders delivered in the period (recognised on delivery).
 const live=orderRows.filter(o=>isRecognizedIn(o,from,to));
 const money=summarize(live); const stock=inventoryValuation(variantRows,batchRows);
 const revenue=money.revenue, productCost=money.cogs, grossProfit=money.profit;
 const totalExpenses=rows.reduce((s,e)=>s+num(e.amountIqd),0);// Stock bought in the period, from every receiving path (Purchases page, Inventory batches, product editor).
 void purchaseRows; const totalPurchases=batchRows.filter(b=>b.receivedAt>=from&&b.receivedAt<=to).reduce((s,b)=>s+num(b.purchaseCostIqd)*num(b.quantityReceived),0);const stockValue=stock.knownValue;const unknownStockUnits=stock.unknownCostUnits;const net=grossProfit-totalExpenses;
 const byCat=categories.map(c=>[c,rows.filter(e=>e.category===c).reduce((s,e)=>s+num(e.amountIqd),0)] as [string,number]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
 return <FinanceClient totalPurchases={totalPurchases} stockValue={stockValue} unknownStockUnits={unknownStockUnits} grossProfit={grossProfit} rows={rows.map(e=>({id:e.id,expenseDate:new Date(e.expenseDate).toISOString(),description:e.description,reference:e.reference,category:e.category,paymentMethod:e.paymentMethod,amountIqd:Number(e.amountIqd)}))} revenue={revenue} productCost={productCost} totalExpenses={totalExpenses} net={net} byCat={byCat} period={period}/>;
}
