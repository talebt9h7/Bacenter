import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/admin-auth';
import { getProductById } from '@/lib/products';
import { deleteProducts, saveProduct, validateProductInput } from '@/lib/admin-products';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: NextRequest, { params }: Context) {
  if (!(await requireAdminSection('catalog', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const product = await getProductById(id, { includeUnpublished: true });
  return product ? NextResponse.json({ product }) : NextResponse.json({ error: 'Product not found.' }, { status: 404 });
}
export async function PUT(request: NextRequest, { params }: Context) {
  if (!(await requireAdminSection('catalog', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const { data, error } = validateProductInput({ ...(body ?? {}), id });
  if (!data) return NextResponse.json({ error }, { status: 400 });
  try { await saveProduct(data); return NextResponse.json({ product: await getProductById(id, { includeUnpublished: true }) }); }
  catch (err) {
    if (err instanceof Error && err.message === 'INVALID_CATEGORY') return NextResponse.json({ error: 'Please choose a valid category.' }, { status: 400 });
    if (err instanceof Error && err.message === 'NOT_FOUND') return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    console.error('Product update failed', err); return NextResponse.json({ error: 'The product could not be saved.' }, { status: 500 });
  }
}
export async function DELETE(_request: NextRequest, { params }: Context) {
  if (!(await requireAdminSection('catalog', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  try { await deleteProducts([id]); return NextResponse.json({ ok: true }); }
  catch (err) { console.error('Product delete failed', err); return NextResponse.json({ error: 'The product could not be deleted.' }, { status: 500 }); }
}
