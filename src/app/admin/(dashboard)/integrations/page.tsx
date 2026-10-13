import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { getIntegrations } from '@/lib/integrations';
import { IntegrationsManager } from '@/components/admin/integrations-manager';

export const metadata = { title: 'Notifications & tracking' };
export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const actor = await requireAdminSection('configuration', 'view');
  if (!actor) redirect('/admin');
  const canManage = !!(await requireAdminSection('configuration', 'manage'));
  const i = await getIntegrations();
  // Secrets stay on the server: the page only learns whether they are set.
  const initial = { ...i, telegram: { ...i.telegram, botToken: i.telegram.botToken ? `${i.telegram.botToken.slice(0, 6)}••••••` : '' }, whatsapp: { ...i.whatsapp, apiKey: i.whatsapp.apiKey ? '••••••' : '' } };
  return <IntegrationsManager initial={initial} canManage={canManage} />;
}
