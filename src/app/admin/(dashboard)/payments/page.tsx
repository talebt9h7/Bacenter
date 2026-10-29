import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { desc, eq } from 'drizzle-orm';
import { requireAdminSection } from '@/lib/admin-auth';
import { db } from '@/db';
import { orders, payments } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { getPaymentSettings, maskedPaymentSettings } from '@/lib/payments/config';
import { PaymentsManager, type PaymentListRow } from '@/components/admin/payments-manager';

export const metadata = { title: 'Electronic payments' };
export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const actor = await requireAdminSection('configuration', 'view');
  if (!actor) redirect('/admin');
  const canManage = !!(await requireAdminSection('configuration', 'manage'));
  const [config, settings, list] = await Promise.all([
    getPaymentSettings(),
    getSettings(),
    db.select({ id: payments.id, orderId: payments.orderId, reference: orders.reference, provider: payments.provider, mode: payments.mode, status: payments.status, amount: payments.amountIqd, error: payments.error, createdAt: payments.createdAt, paidAt: payments.paidAt })
      .from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).orderBy(desc(payments.id)).limit(50),
  ]);
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const siteUrl = settings.canonicalBaseUrl || (host ? `https://${host}` : '');
  const rows: PaymentListRow[] = list.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), paidAt: r.paidAt ? r.paidAt.toISOString() : null }));
  return <PaymentsManager initial={maskedPaymentSettings(config)} rows={rows} siteUrl={siteUrl} canManage={canManage} />;
}
