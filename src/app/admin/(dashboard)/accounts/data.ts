import { getAdminActor, requireAdminSection } from '@/lib/admin-auth';
import { listCouriers } from '@/lib/accounts';
import type { CourierDTO } from '@/components/admin/accounts-views';

export async function accountsAccess() {
  const actor = await requireAdminSection('finance', 'view');
  if (!actor) return null;
  const canManage = !!(await requireAdminSection('finance', 'manage')) || (await getAdminActor())?.type === 'owner';
  return { actor, canManage };
}
export async function courierDTOs(): Promise<CourierDTO[]> {
  return (await listCouriers()).map(c => ({ id: c.id, name: c.name, phone: c.phone, defaultFeeIqd: c.defaultFeeIqd, returnFeeIqd: c.returnFeeIqd, rates: (c.rates ?? {}) as Record<string, number>, active: c.active }));
}
