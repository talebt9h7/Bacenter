import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { and, desc, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { expenses, orders } from '@/db/schema';
import ProfitClient from '@/components/admin/profit-client';
import { orderProductProfit } from '@/lib/orders';
import { isRecognizedIn, ordersTouchingRange, reportRange } from '@/lib/report-period';
const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:0};
type Item={quantity?:number;purchaseCostCents?:number|null};
export const metadata={title:'Profit'};export const dynamic='force-dynamic';
export default async function ProfitPage({searchParams}:{searchParams:Promise<{period?:string}>}){
 const actor=await requireAdminSection('finance','view');if(!actor)redirect('/admin');const {period='30d'}=await searchParams;const {from,to}=reportRange(period);
 const [ordersRows,expenseRows]=await Promise.all([db.select().from(orders).where(ordersTouchingRange(from,to)).orderBy(desc(orders.createdAt)),db.select().from(expenses).where(and(gte(expenses.expenseDate,from),lte(expenses.expenseDate,to))).orderBy(desc(expenses.expenseDate))]);
 const live=ordersRows.filter(o=>isRecognizedIn(o,from,to));
 const itemsOf=(o:typeof orders.$inferSelect)=>Array.isArray(o.items)?o.items as Item[]:[];
 const revenue=live.reduce((s,o)=>{const gross=itemsOf(o).reduce((a,i)=>a+num((i as any).unitPrice)*num(i.quantity),0);return s+Math.max(0,gross-num(o.discountCents))},0);
 const cost=live.reduce((s,o)=>s+itemsOf(o).reduce((a,i)=>a+(i.purchaseCostCents==null?0:num(i.purchaseCostCents)*num(i.quantity)),0),0);
 const knownUnitsSold=live.reduce((s,o)=>s+itemsOf(o).reduce((a,i)=>a+(i.purchaseCostCents==null?0:num(i.quantity)),0),0);
 const units=live.reduce((s,o)=>s+itemsOf(o).reduce((a,i)=>a+num(i.quantity),0),0);
 const gross=live.reduce((s,o)=>s+orderProductProfit(itemsOf(o),num(o.discountCents)),0);const operating=expenseRows.reduce((s,e)=>s+num(e.amountIqd),0);const net=gross-operating;
 return <ProfitClient revenue={revenue} cost={cost} operating={operating} net={net} gross={gross} units={units} knownUnitsSold={knownUnitsSold} unknownUnits={units-knownUnitsSold} expenseRows={expenseRows.map(e=>({id:e.id,expenseDate:new Date(e.expenseDate).toISOString(),description:e.description,category:e.category,amountIqd:Number(e.amountIqd)}))} period={period}/>;
}
