import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/admin-auth';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { customers, orders, products, shippingZones } from '@/db/schema';
import { CustomersClient } from '@/components/admin/customers-client';

export const metadata = { title: 'Customers' };
type Item = { productId?:string; name:string; quantity:number };
export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; segment?: string }> }) {
  const actor = await requireAdminSection('sales', 'view');
  if (!actor) redirect('/admin');
  const { q = '', segment = 'all' } = await searchParams;
  const [rows, zones, productRows, orderRows] = await Promise.all([
    db.select().from(customers).orderBy(desc(customers.lastOrderAt)).limit(1000),
    db.select().from(shippingZones),
    db.select({id:products.id,category:products.category}).from(products),
    db.select({customerId:orders.customerId, phone:orders.phone, status:orders.status, items:orders.items, createdAt:orders.createdAt}).from(orders).orderBy(desc(orders.createdAt)).limit(5000),
  ]);
  const productMap = new Map(productRows.map(p=>[p.id,p.category]));
  const profile = new Map<number,{categories:Set<string>; last:Date|null}>();
  for (const order of orderRows) {
    if (!order.customerId || ['cancelled','returned'].includes(order.status)) continue;
    const data = profile.get(order.customerId) ?? {categories:new Set<string>(),last:null};
    for (const item of order.items as Item[]) if (item.productId) { const cat=productMap.get(item.productId); if(cat) data.categories.add(cat); }
    if (!data.last || new Date(order.createdAt)>data.last) data.last=new Date(order.createdAt);
    profile.set(order.customerId,data);
  }
  const rowsForClient = rows.map(row => ({
    id: row.id, name: row.name, phone: row.phone, email: row.email, governorate: row.governorate,
    ordersCount: row.ordersCount, totalSpent: row.totalSpent, lastOrderAt: row.lastOrderAt ? new Date(row.lastOrderAt).toISOString() : null,
    createdAt: new Date(row.createdAt).toISOString(), tags: row.tags ?? [], categories: [...(profile.get(row.id)?.categories ?? new Set<string>())],
  }));
  return <CustomersClient rows={rowsForClient} zones={zones.map(z=>({code:z.code,nameEn:z.nameEn,nameAr:(z as any).nameAr ?? null}))} initialQuery={q} initialSegment={segment} />;
}
