import { redirect } from 'next/navigation';
import { and, desc, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { expenses, inventoryBatches } from '@/db/schema';
import { getAdminActor, requireAdminSection } from '@/lib/admin-auth';
import { loadReports } from '@/lib/reports-data';
import { FinanceView } from '@/components/admin/money-views';

export const metadata = { title: 'Finance' };
export const dynamic = 'force-dynamic';

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const actor = await requireAdminSection('finance', 'view');
  if (!actor) redirect('/admin');
  const { period = '30d' } = await searchParams;
  const data = await loadReports({ period });
  const from = new Date(data.from), to = new Date(data.to);
  const [rows, received] = await Promise.all([
    db.select().from(expenses).where(and(gte(expenses.expenseDate, from), lte(expenses.expenseDate, to))).orderBy(desc(expenses.expenseDate)),
    // Stock bought in the period, from every receiving path (Purchases page, Inventory batches, product editor).
    db.select({ quantityReceived: inventoryBatches.quantityReceived, purchaseCostIqd: inventoryBatches.purchaseCostIqd }).from(inventoryBatches).where(and(gte(inventoryBatches.receivedAt, from), lte(inventoryBatches.receivedAt, to))),
  ]);
  const purchases = received.reduce((s, b) => s + (b.purchaseCostIqd ?? 0) * b.quantityReceived, 0);
  const canManage = !!(await requireAdminSection('finance', 'manage')) || (await getAdminActor())?.type === 'owner';
  return <FinanceView data={data} purchases={purchases} canManage={canManage} rows={rows.map(e => ({ id: e.id, expenseDate: e.expenseDate.toISOString(), description: e.description, reference: e.reference, category: e.category, paymentMethod: e.paymentMethod, amountIqd: e.amountIqd }))} />;
}
