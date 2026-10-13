import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { and, desc, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { expenses, orders } from '@/db/schema';
import ProfitClient from '@/components/admin/profit-client';
import { summarize } from '@/lib/finance';
import { isRecognizedIn, ordersTouchingRange, reportRange } from '@/lib/report-period';
const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:0};
export const metadata={title:'Profit'};export const dynamic='force-dynamic';
export default async function ProfitPage({searchParams}:{searchParams:Promise<{period?:string}>}){
 const actor=await requireAdminSection('finance','view');if(!actor)redirect('/admin');const {period='30d'}=await searchParams;const {from,to}=reportRange(period);
 const [ordersRows,expenseRows]=await Promise.all([db.select().from(orders).where(ordersTouchingRange(from,to)).orderBy(desc(orders.createdAt)),db.select().from(expenses).where(and(gte(expenses.expenseDate,from),lte(expenses.expenseDate,to))).orderBy(desc(expenses.expenseDate))]);
 const live=ordersRows.filter(o=>isRecognizedIn(o,from,to));
 const money=summarize(live);
 // Gross profit and COGS cover lines with a known purchase cost; revenue of unknown-cost lines is shown apart so the bridge adds up.
 const revenue=money.revenue, cost=money.cogs, units=money.units, knownUnitsSold=money.knownCostUnits, gross=money.profit; const operating=expenseRows.reduce((s,e)=>s+num(e.amountIqd),0);const net=gross-operating;
 return <ProfitClient revenue={revenue} cost={cost} operating={operating} net={net} gross={gross} units={units} knownUnitsSold={knownUnitsSold} unknownUnits={money.unknownCostUnits} unknownRevenue={money.unknownCostRevenue} knownRevenue={money.knownCostRevenue} expenseRows={expenseRows.map(e=>({id:e.id,expenseDate:new Date(e.expenseDate).toISOString(),description:e.description,category:e.category,amountIqd:Number(e.amountIqd)}))} period={period}/>;
}
