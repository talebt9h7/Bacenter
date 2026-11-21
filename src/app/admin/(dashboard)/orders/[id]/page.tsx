import { requireAdminSection } from '@/lib/admin-auth';
import { notFound, redirect } from 'next/navigation';
import { orderWithEvents } from '@/lib/orders';
import { listCouriers } from '@/lib/accounts';
import { costLayersByVariant } from '@/lib/cost-layers';
import { OrderDetail, type OrderEvent, type OrderRow } from '@/components/admin/orders-client';

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) { const { id } = await params; const data = await orderWithEvents(Number(id)); return { title: data ? `Order ${data.order.reference}` : 'Order' }; }
export default async function AdminOrderPage({ params }: Props) {
  const actor = await requireAdminSection('sales', 'view');
  if (!actor) redirect('/admin');
  const { id } = await params;
  if (!Number.isInteger(Number(id))) notFound();
  const data = await orderWithEvents(Number(id));
  if (!data?.order) notFound();
  const order = { ...data.order, createdAt: data.order.createdAt.toISOString(), updatedAt: data.order.updatedAt.toISOString(), paidAt: data.order.paidAt?.toISOString() ?? null, deliveredAt: data.order.deliveredAt?.toISOString() ?? null } as unknown as OrderRow;
  const couriers = (await listCouriers()).map(c => ({ id: c.id, name: c.name, active: c.active, defaultFeeIqd: c.defaultFeeIqd, returnFeeIqd: c.returnFeeIqd, rates: (c.rates ?? {}) as Record<string, number> }));
  const events = data.events.map(event => ({ ...event, createdAt: event.createdAt.toISOString() })) as OrderEvent[];
  const showProfit = actor.type === 'owner' || !!actor.permissions.finance?.view;
  // Before confirmation an order has no cost snapshot yet; its profit is estimated from the stock batches it would use.
  const costLayers = showProfit ? await costLayersByVariant() : {};
  return <OrderDetail key={order.id} initial={order} events={events} couriers={couriers} showProfit={showProfit} costLayers={costLayers} />;
}
