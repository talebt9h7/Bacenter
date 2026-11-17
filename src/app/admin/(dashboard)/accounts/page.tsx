import { redirect } from 'next/navigation';
import { getAccountsSettings, loadAccountsOverview } from '@/lib/accounts';
import { AccountsOverview } from '@/components/admin/accounts-views';
import { accountsAccess, courierDTOs } from './data';

export const metadata = { title: 'الحسابات' };
export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const access = await accountsAccess();
  if (!access) redirect('/admin');
  const [data, couriers, settings] = await Promise.all([loadAccountsOverview(), courierDTOs(), getAccountsSettings()]);
  return <AccountsOverview data={data} couriers={couriers} settings={settings} canManage={access.canManage} />;
}
