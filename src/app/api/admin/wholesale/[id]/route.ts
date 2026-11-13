import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/admin-auth';
import { getWholesale } from '@/lib/wholesale-data';
import { editWholesaleInvoice, WholesaleEditError } from '@/lib/wholesale-edit';
import { invalidateCatalog } from '@/lib/cache-tags';
import { clearMemo } from '@/lib/memo-cache';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  if (!(await requireAdminSection('sales', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid invoice.' }, { status: 400 });
  const invoice = await getWholesale(id);
  return invoice ? NextResponse.json({ invoice }, { headers: { 'Cache-Control': 'no-store' } }) : NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
}

export async function PUT(request: NextRequest, { params }: Context) {
  if (!(await requireAdminSection('sales', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const result = await editWholesaleInvoice(Number((await params).id), await request.json().catch(() => null));
    invalidateCatalog(); clearMemo('stats:');
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WholesaleEditError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Wholesale invoice edit failed', error);
    return NextResponse.json({ error: 'تعذر حفظ التعديل. لم يتم تغيير الفاتورة، حاول مرة أخرى.' }, { status: 500 });
  }
}
