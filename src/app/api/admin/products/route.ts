import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/admin-auth';
import { getAllProducts, getProductById } from '@/lib/products';
import { saveProduct, validateProductInput } from '@/lib/admin-products';

export const dynamic = 'force-dynamic';
export async function GET() {
  if (!(await requireAdminSection('catalog', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    return NextResponse.json({ products: await getAllProducts({ includeUnpublished: true }) });
  } catch (err) {
    console.error('Product list failed', err);
    const message = process.env.NODE_ENV === 'development' && err instanceof Error ? err.message : 'Products could not be loaded.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('catalog', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { data, error } = validateProductInput(await request.json().catch(() => null));
  if (!data) return NextResponse.json({ error }, { status: 400 });
  try { await saveProduct(data, { create: true }); return NextResponse.json({ product: await getProductById(data.id, { includeUnpublished: true }) }, { status: 201 }); }
  catch (err) {
    if (err instanceof Error && err.message === 'PURCHASE_PRICE_REQUIRED') return NextResponse.json({ error: 'Purchase cost is required when initial stock is greater than zero.' }, { status: 400 });
    if (err instanceof Error && err.message === 'INVALID_CATEGORY') return NextResponse.json({ error: 'Please choose a valid category.' }, { status: 400 });
    if (err instanceof Error && err.message === 'DUPLICATE') return NextResponse.json({ error: 'A product with that URL handle already exists.' }, { status: 409 });
    console.error('Product create failed', err); return NextResponse.json({ error: 'The product could not be created.' }, { status: 500 });
  }
}
