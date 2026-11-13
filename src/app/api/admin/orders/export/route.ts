import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { orderStatuses } from '@/lib/iraq';
import { searchFilter } from '@/lib/order-search';

export const dynamic = 'force-dynamic';
const STATUS_AR: Record<string, string> = { pending: 'قيد الانتظار', confirmed: 'مؤكد', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التوصيل', cancelled: 'ملغي', returned: 'مرتجع' };
const PAY_AR: Record<string, string> = { cod: 'الدفع عند الاستلام', electronic: 'دفع إلكتروني', cash: 'نقداً', bank_transfer: 'تحويل مصرفي' };
const cell = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** Orders as a CSV that opens in Excel (UTF-8 with BOM), using the same status filter and search as the list. */
export async function GET(request: NextRequest) {
  if (!(await requireAdminSection('sales', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const p = request.nextUrl.searchParams;
  const status = p.get('status') && (p.get('status')==='preparing'||(orderStatuses as readonly string[]).includes(p.get('status')!)) ? p.get('status')! : undefined;
  const ids = (p.get('ids') ?? '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0);
  const where = ids.length ? undefined : and(searchFilter(p.get('q') ?? ''), status==='preparing'?inArray(orders.status,['confirmed','processing']):status ? eq(orders.status, status) : undefined);
  let rows = await db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(10000);
  if (ids.length) { const set = new Set(ids); rows = rows.filter(r => set.has(r.id)); }
  const header = ['رقم الطلب', 'التاريخ', 'الحالة', 'الاسم', 'الهاتف', 'هاتف بديل', 'المحافظة', 'المدينة', 'العنوان', 'أقرب نقطة دالة', 'المنتجات', 'عدد القطع', 'المجموع الفرعي', 'التوصيل', 'الخصم', 'الإجمالي', 'طريقة الدفع', 'حالة الدفع', 'الكوبون', 'شركة التوصيل', 'رقم التتبع', 'المصدر', 'ملاحظة الزبون', 'ملاحظة داخلية'];
  const lines = rows.map(o => {
    const a = (o.address ?? {}) as { governorateAr?: string; governorate?: string; city?: string; line1?: string; landmark?: string; altPhone?: string };
    const items = (Array.isArray(o.items) ? o.items : []) as { name: string; color?: string; quantity: number }[];
    return [o.reference, new Date(o.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Baghdad' }), STATUS_AR[o.status] ?? o.status, o.name, o.phone, a.altPhone ?? '', a.governorateAr || a.governorate || o.governorate, a.city ?? '', a.line1 ?? '', a.landmark ?? '',
      items.map(i => `${i.name}${i.color ? ` (${i.color})` : ''} × ${i.quantity}`).join(' | '), items.reduce((s, i) => s + i.quantity, 0),
      o.subtotalCents, o.shippingCents, o.discountCents, o.totalCents, PAY_AR[o.paymentMethod] ?? o.paymentMethod, o.paymentStatus === 'paid' ? 'مدفوع' : o.paymentStatus === 'refunded' ? 'مسترجع' : 'غير مدفوع',
      o.couponCode ?? '', o.courier ?? '', o.trackingNumber ?? '', o.source, o.customerNote ?? '', o.adminNote ?? ''].map(cell).join(',');
  });
  const csv = '﻿' + [header.join(','), ...lines].join('\r\n');
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="orders-${date}.csv"`, 'Cache-Control': 'no-store' } });
}
