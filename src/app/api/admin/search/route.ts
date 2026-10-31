import { NextRequest, NextResponse } from 'next/server';
import { desc, ilike, or } from 'drizzle-orm';
import { db } from '@/db';
import { customers, orders, products } from '@/db/schema';
import { getAdminActor, type AdminActor, type AdminSection } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
const can = (actor: AdminActor, section: AdminSection) => actor.type === 'owner' || !!actor.permissions[section]?.view;

/** Global admin search (⌘K): orders by number, phone or name; products; customers. */
export async function GET(request: NextRequest) {
  const actor = await getAdminActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ orders: [], products: [], customers: [] });
  const like = `%${q.replace(/[%_\\]/g, m => `\\${m}`)}%`;
  // Phone numbers are stored as 07…; "770…" or "+964770…" should still match.
  const digits = q.replace(/\D/g, '').replace(/^964/, '').replace(/^0/, '');
  const phoneLike = digits.length >= 4 ? `%${digits}%` : like;
  const [orderRows, productRows, customerRows] = await Promise.all([
    can(actor, 'sales') ? db.select({ id: orders.id, reference: orders.reference, name: orders.name, phone: orders.phone, status: orders.status, total: orders.totalCents, createdAt: orders.createdAt })
      .from(orders).where(or(ilike(orders.reference, like), ilike(orders.name, like), ilike(orders.phone, phoneLike))).orderBy(desc(orders.id)).limit(6) : [],
    can(actor, 'catalog') ? db.select({ id: products.id, name: products.name, nameAr: products.nameAr, price: products.salePriceIqd, published: products.published })
      .from(products).where(or(ilike(products.id, like), ilike(products.name, like), ilike(products.nameAr, like))).limit(6) : [],
    can(actor, 'sales') ? db.select({ id: customers.id, name: customers.name, phone: customers.phone, ordersCount: customers.ordersCount })
      .from(customers).where(or(ilike(customers.name, like), ilike(customers.phone, phoneLike))).orderBy(desc(customers.lastOrderAt)).limit(5) : [],
  ]);
  return NextResponse.json({ orders: orderRows, products: productRows, customers: customerRows }, { headers: { 'Cache-Control': 'no-store' } });
}
