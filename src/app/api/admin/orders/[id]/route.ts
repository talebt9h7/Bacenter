import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/admin-auth';
import { iraqPhonePattern, normalizeIraqPhone, orderStatuses, statusTransitions, type OrderStatus } from '@/lib/iraq';
import { deleteOrder, orderWithEvents, transitionOrder, updateOrderDetails } from '@/lib/orders';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: NextRequest, { params }: Context) {
  if (!(await requireAdminSection('sales', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params; const data = await orderWithEvents(Number(id));
  return data ? NextResponse.json(data) : NextResponse.json({ error: 'Order not found.' }, { status: 404 });
}
export async function PATCH(request: NextRequest, { params }: Context) {
  if (!(await requireAdminSection('sales', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params; const body = await request.json().catch(() => ({}));
  const current = await orderWithEvents(Number(id));
  if (!current?.order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  const currentStatus = (orderStatuses.includes(current.order.status as OrderStatus) ? current.order.status : 'pending') as OrderStatus;
  const next = typeof body.status === 'string' ? body.status as OrderStatus : currentStatus;
  if (!orderStatuses.includes(next)) return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
  if (next !== currentStatus && !statusTransitions[currentStatus].includes(next) && !body.force) return NextResponse.json({ error: `An order can’t move from ${currentStatus} to ${next}.` }, { status: 400 });
  const hasDetailEdits = ['name','phone','email','governorate','city','address','landmark','source','sourceNote','shipping','discount','paymentMethod','paymentStatus','customerNote','items'].some(key => Object.prototype.hasOwnProperty.call(body, key));
  if (hasDetailEdits && !body.status) {
    const name = typeof body.name === 'string' ? body.name.trim().slice(0,100) : current.order.name;
    const phone = normalizeIraqPhone(typeof body.phone === 'string' ? body.phone.trim().slice(0,30) : current.order.phone);
    const email = typeof body.email === 'string' ? body.email.trim().slice(0,254).toLowerCase() : current.order.email;
    const governorate = typeof body.governorate === 'string' ? body.governorate.trim().toLowerCase() : String(current.order.governorate || '').trim().toLowerCase();
    const address = current.order.address as Record<string, unknown>;
    const city = typeof body.city === 'string' ? body.city.trim().slice(0,120) : String(address.city || '');
    const line1 = typeof body.address === 'string' ? body.address.trim().slice(0,300) : String(address.line1 || '');
    const landmark = typeof body.landmark === 'string' ? body.landmark.trim().slice(0,200) : String(address.landmark || '');
    if (name.length < 2 || !iraqPhonePattern.test(phone) || !city || line1.length < 3) return NextResponse.json({ error: 'Enter valid customer and delivery details.' }, { status: 400 });
    const shipping = Number.isFinite(Number(body.shipping)) ? Math.max(0, Math.round(Number(body.shipping))) : current.order.shippingCents;
    const discount = Number.isFinite(Number(body.discount)) ? Math.max(0, Math.round(Number(body.discount))) : current.order.discountCents;
    const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod : current.order.paymentMethod;
    const editedPaymentStatus = typeof body.paymentStatus === 'string' && ['unpaid','paid','refunded'].includes(body.paymentStatus) ? body.paymentStatus : current.order.paymentStatus;
    const items = Array.isArray(body.items) ? body.items.map((item: any) => ({ variantId: Number(item.variantId), quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) })) : undefined;
    try { await updateOrderDetails(Number(id), { name, phone, email, governorate, city, address: line1, landmark, source: typeof body.source === 'string' ? body.source.trim().slice(0,40) : current.order.source, sourceNote: typeof body.sourceNote === 'string' ? body.sourceNote.trim().slice(0,200) : current.order.sourceNote, shippingCents: shipping, discountCents: discount, paymentMethod, paymentStatus: editedPaymentStatus, customerNote: typeof body.customerNote === 'string' ? body.customerNote.trim().slice(0,500) : current.order.customerNote, items }); return NextResponse.json(await orderWithEvents(Number(id))); }
    catch (error) { console.error('Order details update failed', error); const message = error instanceof Error ? error.message : ''; const known: Record<string,string> = { INVALID_GOVERNORATE: 'Invalid governorate.', INVALID_ITEMS: 'Add at least one valid product.', PRODUCT_NOT_FOUND: 'One of the selected products no longer exists.', CANNOT_EDIT_DELIVERED_ITEMS: 'Delivered order products cannot be changed.', BATCH_STOCK_MISMATCH: 'Inventory batches do not match current stock.' }; if (message.startsWith('INSUFFICIENT_STOCK:')) return NextResponse.json({ error: `${message.slice(19)} does not have enough stock.` }, { status: 409 }); return NextResponse.json({ error: known[message] || 'The order details could not be updated.' }, { status: 400 }); }
  }
  const paymentStatus = typeof body.paymentStatus === 'string' && ['unpaid', 'paid', 'refunded'].includes(body.paymentStatus) ? body.paymentStatus : undefined;
  try {
    await transitionOrder(Number(id), next, { trackingNumber: typeof body.trackingNumber === 'string' ? body.trackingNumber.trim().slice(0, 80) : undefined, courier: typeof body.courier === 'string' ? body.courier.trim().slice(0, 80) : undefined, adminNote: typeof body.adminNote === 'string' ? body.adminNote.trim().slice(0, 2000) : undefined, paymentStatus });
    return NextResponse.json(await orderWithEvents(Number(id)));
  } catch (error) { console.error('Order update failed', error); return NextResponse.json({ error: 'The order could not be updated.' }, { status: 500 }); }
}


export async function DELETE(request: NextRequest, { params }: Context) {
  if (!(await requireAdminSection('sales', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  try { await deleteOrder(Number(id)); return NextResponse.json({ ok: true }); }
  catch (error) { const message = error instanceof Error ? error.message : ''; if (message === 'NOT_FOUND') return NextResponse.json({ error: 'Order not found.' }, { status: 404 }); if (message === 'CANNOT_DELETE_DELIVERED') return NextResponse.json({ error: 'Delivered orders cannot be deleted. Mark the order as returned first.' }, { status: 409 }); console.error('Order delete failed', error); return NextResponse.json({ error: 'The order could not be deleted.' }, { status: 500 }); }
}
