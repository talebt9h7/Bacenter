import { redirect } from 'next/navigation';
import { loadLedger, validAccount } from '@/lib/accounts';
import { LedgerView } from '@/components/admin/accounts-views';
import { baghdadDayKey, reportRange } from '@/lib/report-period';
import { accountsAccess, courierDTOs } from '../data';

export const metadata = { title: 'كل الحركات' };
export const dynamic = 'force-dynamic';

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ account?: string; from?: string; to?: string }> }) {
  const access = await accountsAccess();
  if (!access) redirect('/admin');
  const q = await searchParams;
  const account = q.account && validAccount(q.account) ? q.account : '';
  const range = reportRange('30d', q.from, q.to);
  const [{ entries }, couriers] = await Promise.all([loadLedger(), courierDTOs()]);
  const fromIso = range.from.toISOString(), toIso = range.to.toISOString();
  const ofAccount = account ? entries.filter(e => e.account === account) : entries;
  const inRange = ofAccount.filter(e => e.at >= fromIso && e.at <= toIso);
  const opening = account ? ofAccount.filter(e => e.at < fromIso).reduce((s, e) => s + e.amount, 0) : null;
  return <LedgerView entries={inRange} couriers={couriers} account={account} from={baghdadDayKey(range.from)} to={baghdadDayKey(range.to)} opening={opening} canManage={access.canManage} />;
}
