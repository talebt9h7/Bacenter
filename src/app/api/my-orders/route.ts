import { NextRequest, NextResponse } from 'next/server';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { orders, products, productVariants } from '@/db/schema';
import { iraqPhonePattern, normalizeIraqPhone } from '@/lib/iraq';
import { APPENDABLE_STATUSES, type OrderItem } from '@/lib/orders';
import { trackPath, verifyTrackToken } from '@/lib/order-track';
import { variantNameArSql } from '@/lib/variant-sql';

export const dynamic = 'force-dynamic';

type Row = typeof orders.$inferSelect;

/** What a shopper sees about their own orders: no admin notes, costs or profit. */
async function present(rows: Row[]) {
  const all = rows.flatMap(r => (r.items as OrderItem[]) ?? []);
  const productIds = [...new Set(all.map(i => i.productId).filter(Boolean))] as string[];
  const variantIds = [...new Set(all.map(i => Number(i.variantId)).filter(Boolean))];
  const [names, colors] = await Promise.all([
    productIds.length ? db.select({ id: products.id, nameAr: products.nameAr }).from(products).where(inArray(products.id, productIds)) : [],
    variantIds.length ? db.select({ id: productVariants.id, colorAr: variantNameArSql }).from(productVariants).where(inArray(productVariants.id, variantIds)) : [],
  ]);
  const nameAr = new Map(names.map(n => [n.id, n.nameAr]));
  const colorAr = new Map(colors.map(c => [c.id, c.colorAr]));
  return rows.map(r => {
    const address = (r.address ?? {}) as Record<string, string>;
    const paid = r.paymentStatus === 'paid' ? r.totalCents : Math.min(r.totalCents, r.paidCents ?? 0);
    return {
      reference: r.reference,
      createdAt: r.createdAt,
      status: r.status,
      paymentMethod: r.paymentMethod,
      paymentStatus: r.paymentStatus,
      subtotal: r.subtotalCents, shipping: r.shippingCents, discount: r.discountCents, codFee: r.codFeeCents, total: r.totalCents,
      paid, due: Math.max(0, r.totalCents - paid),
      governorate: address.governorate || r.governorate, governorateAr: address.governorateAr || '', city: address.city || '',
      trackingNumber: r.trackingNumber,
      canAdd: (APPENDABLE_STATUSES as readonly string[]).includes(r.status),
      link: trackPath(r.reference),
      items: ((r.items as OrderItem[]) ?? []).map(i => ({
        name: i.name, nameAr: nameAr.get(i.productId ?? "") || i.bundleName || i.name,
        color: i.color, colorAr: colorAr.get(Number(i.variantId)) || i.color,
        quantity: i.quantity, unitPrice: Number(i.unitPrice ?? 0), image: i.image ?? null, productId: i.productId,
      })),
    };
  });
}

async function byPhone(phone: string) {
  return db.select().from(orders).where(eq(orders.phone, phone)).orderBy(desc(orders.createdAt)).limit(20);
}

/** Orders placed with a phone number (no PIN: the shop accepts that anyone with the number can see them). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { phone?: string } | null;
  const phone = normalizeIraqPhone(String(body?.phone ?? ''));
  if (!iraqPhonePattern.test(phone)) return NextResponse.json({ error: 'رقم الهاتف غير صحيح' }, { status: 400 });
  const rows = (await byPhone(phone)).filter(r => r.source !== 'wholesale');
  return NextResponse.json({ phone, orders: await present(rows) });
}

/** One order from the signed link on the confirmation page, plus the other orders on the same phone. */
export async function GET(request: NextRequest) {
  const ref = (request.nextUrl.searchParams.get('ref') ?? '').toUpperCase().slice(0, 30);
  const token = request.nextUrl.searchParams.get('t') ?? '';
  if (!ref || !verifyTrackToken(ref, token)) return NextResponse.json({ error: 'الرابط غير صالح' }, { status: 404 });
  const [order] = await db.select().from(orders).where(eq(orders.reference, ref));
  if (!order) return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
  const rows = order.phone ? (await byPhone(order.phone)).filter(r => r.source !== 'wholesale') : [order];
  if (!rows.some(r => r.id === order.id)) rows.unshift(order);
  return NextResponse.json({ phone: order.phone, focus: order.reference, orders: await present(rows) });
}
