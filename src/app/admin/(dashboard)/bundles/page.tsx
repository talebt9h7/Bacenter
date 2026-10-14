import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireAdminSection } from '@/lib/admin-auth';
import { listBundles } from '@/lib/bundles';
import { variantCatalog } from '@/lib/admin-catalog';
import { BundlesManager } from '@/components/admin/bundles-manager';

export const metadata = { title: 'Bundles' };
export default async function BundlesPage() {
  if (!(await requireAdminSection('catalog', 'view'))) redirect('/admin');
  const [rows, catalog, perf] = await Promise.all([
    listBundles({ includeInactive: true }),
    variantCatalog(),
    db.execute(sql`select (item->>'bundleId')::int bundle_id, count(distinct o.id)::int orders, coalesce(sum((item->>'unitPrice')::int * (item->>'quantity')::int),0)::int revenue
      from orders o, jsonb_array_elements(o.items) item where item ? 'bundleId' and item->>'bundleId' is not null and o.status not in ('cancelled','returned') group by 1`),
  ]);
  const list = (Array.isArray(perf) ? perf : (perf as { rows: unknown[] }).rows) as { bundle_id: number; orders: number; revenue: number }[];
  const sold = Object.fromEntries(list.map(r => [r.bundle_id, { orders: r.orders, revenue: r.revenue }]));
  return <BundlesManager initial={rows} catalog={catalog} sold={sold} />;
}
