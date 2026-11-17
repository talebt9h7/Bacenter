import { notFound, redirect } from 'next/navigation';
import { settlementDetail } from '@/lib/accounts';
import { SettlementView } from '@/components/admin/accounts-views';
import { accountsAccess } from '../../data';

export const metadata = { title: 'كشف شركة التوصيل' };
export const dynamic = 'force-dynamic';

export default async function SettlementPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await accountsAccess())) redirect('/admin');
  const data = await settlementDetail(Number((await params).id));
  if (!data) notFound();
  const s = data.settlement;
  return <SettlementView data={{ settlement: { id: s.id, expectedIqd: s.expectedIqd, receivedIqd: s.receivedIqd, account: s.account, settledAt: s.settledAt.toISOString(), note: s.note }, courierName: data.courier?.name ?? '', orders: data.orders }} />;
}
