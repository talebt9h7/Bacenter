import { redirect } from 'next/navigation';
import { listSettlements, settlementCandidates } from '@/lib/accounts';
import { CouriersView } from '@/components/admin/accounts-views';
import { accountsAccess, courierDTOs } from '../data';

export const metadata = { title: 'شركات التوصيل' };
export const dynamic = 'force-dynamic';

export default async function CouriersPage({ searchParams }: { searchParams: Promise<{ courier?: string }> }) {
  const access = await accountsAccess();
  if (!access) redirect('/admin');
  const { courier } = await searchParams;
  const couriers = await courierDTOs();
  const wanted = Number(courier);
  const selected = couriers.find(c => c.id === wanted)?.id ?? couriers.find(c => c.active)?.id ?? couriers[0]?.id ?? null;
  const [candidates, settlements] = await Promise.all([selected ? settlementCandidates(selected) : Promise.resolve([]), listSettlements()]);
  return <CouriersView key={selected ?? 0} couriers={couriers} selected={selected} candidates={candidates} settlements={settlements.map(s => ({ ...s, settledAt: s.settledAt.toISOString() }))} canManage={access.canManage} />;
}
