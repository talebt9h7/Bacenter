import { redirect } from 'next/navigation';
import { and, desc, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { expenses } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { loadReports } from '@/lib/reports-data';
import { ProfitView } from '@/components/admin/money-views';

export const metadata = { title: 'Profit' };
export const dynamic = 'force-dynamic';

export default async function ProfitPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const actor = await requireAdminSection('finance', 'view');
  if (!actor) redirect('/admin');
  const { period = '30d' } = await searchParams;
  const data = await loadReports({ period });
  const rows = await db.select().from(expenses).where(and(gte(expenses.expenseDate, new Date(data.from)), lte(expenses.expenseDate, new Date(data.to)))).orderBy(desc(expenses.expenseDate));
  return <ProfitView data={data} expenses={rows.map(e => ({ id: e.id, expenseDate: e.expenseDate.toISOString(), description: e.description, category: e.category, amountIqd: e.amountIqd }))} />;
}
