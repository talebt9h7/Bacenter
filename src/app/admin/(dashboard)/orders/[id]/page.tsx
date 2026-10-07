import { requireAdminSection } from '@/lib/admin-auth';
import { notFound, redirect } from 'next/navigation';
import { orderWithEvents } from '@/lib/orders';
import { OrderDetail, type OrderEvent, type OrderRow } from '@/components/admin/orders-client';

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) { const { id } = await params; const data = await orderWithEvents(Number(id)); return { title: data ? `Order ${data.order.reference}` : 'Order' }; }
export default async function AdminOrderPage({ params }: Props) {
  const actor = await requireAdminSection('sales', 'view');
  if (!actor) redirect('/admin');
  const { id } = await params;
  if (!Number.isInteger(Number(id))) notFound();
  const data = await orderWithEvents(Number(id));
  if (!data) notFound();
  const order = { ...data.order, createdAt: data.order.createdAt.toISOString(), updatedAt: data.order.updatedAt.toISOString() } as unknown as OrderRow;
  const events = data.events.map(event => ({ ...event, createdAt: event.createdAt.toISOString() })) as OrderEvent[];
  return <OrderDetail key={order.id} initial={order} events={events} />;
}
