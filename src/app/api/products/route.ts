import { NextRequest, NextResponse } from 'next/server';
import { getProductsFor, matchesQuery } from '@/lib/products';
import { getCategories } from '@/lib/categories';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const query = (params.get('q') || '').trim().toLowerCase().slice(0, 100);
    let result = await getProductsFor(params.get('category') || undefined, params.get('collection') || undefined);
    const categoryText = new Map((query ? await getCategories() : []).map(c => [c.id, `${c.name} ${c.nameAr}`]));
    if (query) result = result.filter(product => matchesQuery(product, query, categoryText.get(product.category)));
    return NextResponse.json({ products: result, total: result.length });
  } catch (error) { console.error('Product search failed', error); return NextResponse.json({ error: 'Products could not be loaded.' }, { status: 500 }); }
}
