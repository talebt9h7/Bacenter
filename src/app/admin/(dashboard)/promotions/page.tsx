import { redirect } from 'next/navigation';
import { desc, gte } from 'drizzle-orm';
import { db } from '@/db';
import { orders, promotions } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { getAllProducts } from '@/lib/products';
import { getCategories } from '@/lib/categories';
import { serializePromotion } from '@/lib/promotions';
import { primaryImage } from '@/lib/types';
import { PromotionsManager } from '@/components/admin/promotions-manager';

export const metadata = { title: 'Offers & Sales' };
export const dynamic = 'force-dynamic';
const earliestStart = (rows: { startsAt: Date }[]) => rows.reduce((min, r) => Math.min(min, r.startsAt.getTime()), Date.now());

export default async function PromotionsPage() {
  const actor = await requireAdminSection('sales', 'view');
  if (!actor) redirect('/admin');
  const canManage = !!(await requireAdminSection('sales', 'manage'));
  const [rows, products, categories] = await Promise.all([
    db.select().from(promotions).orderBy(desc(promotions.startsAt)),
    getAllProducts({ includeUnpublished: true }),
    getCategories({ includeInactive: true }),
  ]);
  // Sales made under each offer, read from the order lines (promotionId is saved at checkout).
  const earliest = earliestStart(rows);
  const orderRows = rows.length ? await db.select({ status: orders.status, items: orders.items }).from(orders).where(gte(orders.createdAt, new Date(earliest))) : [];
  const performance: Record<number, { orders: number; units: number; revenue: number; saved: number }> = {};
  for (const order of orderRows) {
    if (order.status === 'cancelled') continue;
    const seen = new Set<number>();
    for (const item of (Array.isArray(order.items) ? order.items : []) as { promotionId?: number | null; quantity?: number; unitPrice?: number; listPrice?: number }[]) {
      if (!item.promotionId) continue;
      const p = performance[item.promotionId] ??= { orders: 0, units: 0, revenue: 0, saved: 0 };
      const qty = Number(item.quantity || 0);
      p.units += qty; p.revenue += Number(item.unitPrice || 0) * qty; p.saved += Math.max(0, Number(item.listPrice || 0) - Number(item.unitPrice || 0)) * qty;
      if (!seen.has(item.promotionId)) { p.orders++; seen.add(item.promotionId); }
    }
  }
  return <PromotionsManager
    canManage={canManage}
    promotions={rows.map(serializePromotion)}
    performance={performance}
    categories={categories.map(c => ({ id: c.id, name: c.name, nameAr: c.nameAr || c.name }))}
    products={products.map(p => ({ id: p.id, name: p.name, nameAr: p.nameAr || p.name, category: p.category, price: p.salePriceIqd, image: primaryImage(p.colors[0]), published: p.published }))}
  />;
}
