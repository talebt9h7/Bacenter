import { NextRequest, NextResponse } from 'next/server';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { customers, inventoryBatches, productVariants, products, shippingZones } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { reservedByVariant } from '@/lib/reservations';
import { variantLabel } from '@/lib/variants';

export const dynamic = 'force-dynamic';
const cell = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (name: string, header: string[], rows: unknown[][]) => new NextResponse('﻿' + [header, ...rows].map(r => r.map(cell).join(',')).join('\r\n'), {
  headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' },
});

/** Excel-ready CSV exports: customers and inventory (stock, reserved, value at cost and at sale price). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (kind === 'customers') {
    if (!(await requireAdminSection('sales', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const [rows, zones] = await Promise.all([db.select().from(customers).orderBy(desc(customers.lastOrderAt)).limit(50000), db.select({ code: shippingZones.code, nameAr: shippingZones.nameAr }).from(shippingZones)]);
    const zone = new Map(zones.map(z => [z.code, z.nameAr]));
    return csv('customers', ['الاسم', 'الهاتف', 'البريد', 'المحافظة', 'عدد الطلبات', 'مجموع المشتريات (د.ع)', 'آخر طلب', 'أول تسجيل', 'الوسوم', 'يقبل التسويق', 'ملاحظة'],
      rows.map(c => [c.name, c.phone, c.email ?? '', c.governorate ? zone.get(c.governorate) ?? c.governorate : '', c.ordersCount, c.totalSpent, c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' }) : '', new Date(c.createdAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' }), (c.tags ?? []).join(' | '), c.marketingOptIn ? 'نعم' : 'لا', c.note ?? '']));
  }
  if (kind === 'inventory') {
    if (!(await requireAdminSection('catalog', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const [rows, batches, reserved] = await Promise.all([
      db.select({ id: productVariants.id, product: products.name, productAr: products.nameAr, color: productVariants.name, colorAr: productVariants.nameAr, size: productVariants.size, sizeAr: productVariants.sizeAr, stock: productVariants.stock, price: productVariants.priceIqd, productPrice: products.salePriceIqd, published: products.published })
        .from(productVariants).innerJoin(products, eq(products.id, productVariants.productId)).orderBy(asc(products.sortOrder), asc(productVariants.sortOrder)),
      db.select({ variantId: inventoryBatches.variantId, remaining: inventoryBatches.quantityRemaining, cost: inventoryBatches.purchaseCostIqd }).from(inventoryBatches),
      reservedByVariant(),
    ]);
    // Value of stock on hand at purchase cost, from the remaining units of each batch.
    const costByVariant = new Map<number, number>();
    for (const b of batches) if (b.remaining > 0 && b.cost) costByVariant.set(b.variantId, (costByVariant.get(b.variantId) ?? 0) + b.remaining * b.cost);
    return csv('inventory', ['المنتج', 'اللون / القياس', 'المخزون الفعلي', 'محجوز لطلبات', 'المتاح للبيع', 'سعر البيع (د.ع)', 'قيمة المخزون بسعر البيع', 'قيمة المخزون بالكلفة', 'منشور'],
      rows.map(r => { const price = r.price || r.productPrice; const res = reserved.get(r.id) ?? 0; return [r.productAr || r.product, variantLabel(r.colorAr || r.color, r.size ? r.sizeAr || r.size : null), r.stock, res, Math.max(0, r.stock - res), price, price * r.stock, costByVariant.get(r.id) ?? '', r.published ? 'نعم' : 'لا']; }));
  }
  return NextResponse.json({ error: 'Unknown export' }, { status: 404 });
}
