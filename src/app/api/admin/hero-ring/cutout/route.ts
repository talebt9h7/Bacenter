import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { media } from '@/db/schema';
import { requireAdminSection } from '@/lib/admin-auth';
import { getAllProducts } from '@/lib/products';
import { primaryImage } from '@/lib/types';
import { cutoutImage, loadStoreImage, type CutoutFailure } from '@/lib/cutout';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const REASONS: Record<CutoutFailure | 'load', { ar: string; en: string }> = {
  'busy-background': { ar: 'خلفية الصورة مزدحمة (مو لون واحد)، فما انقصت تلقائياً. ارفع صورة على خلفية سادة أو صورة مقصوصة.', en: 'The photo’s background is busy (not one plain colour), so it couldn’t be cut automatically. Upload a photo on a plain background, or a cut-out.' },
  'no-background': { ar: 'المنتج مالي الصورة كلها وما بيها خلفية تنشال.', en: 'The product fills the whole photo; there is no background to remove.' },
  'no-subject': { ar: 'ما لكينا المنتج بالصورة.', en: 'Couldn’t find the product in the photo.' },
  load: { ar: 'ما كدرنا نفتح الصورة.', en: 'Couldn’t open the photo.' },
};

/**
 * Admin → Homepage → Product ring: removes the background of a product photo (or of a picture
 * the admin uploaded) and stores the transparent result in the media library.
 * Body: { productId, source? } — without a source, the product's first photo is used.
 */
export async function POST(request: NextRequest) {
  const actor = await requireAdminSection('storefront', 'manage');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null) as { productId?: unknown; source?: unknown } | null;
  const productId = typeof body?.productId === 'string' ? body.productId.slice(0, 120) : '';
  const ar = (request.cookies.get('UR_lang')?.value ?? 'ar') !== 'en';
  let source = typeof body?.source === 'string' ? body.source.trim().slice(0, 500) : '';
  if (!source) {
    const product = (await getAllProducts({ includeUnpublished: true })).find(p => p.id === productId);
    if (!product) return NextResponse.json({ error: ar ? 'المنتج مو موجود.' : 'Product not found.' }, { status: 404 });
    const color = product.colors.find(c => c.images.length);
    source = color ? primaryImage(color) : '';
    if (!source) return NextResponse.json({ error: ar ? 'هذا المنتج ما بي صور.' : 'This product has no photos.' }, { status: 422 });
  }
  const input = await loadStoreImage(source, request.nextUrl.origin);
  if (!input) return NextResponse.json({ error: REASONS.load[ar ? 'ar' : 'en'], reason: 'load' }, { status: 422 });
  try {
    const result = await cutoutImage(input);
    if (!result.ok) return NextResponse.json({ error: REASONS[result.reason][ar ? 'ar' : 'en'], reason: result.reason }, { status: 422 });
    const [row] = await db.insert(media).values({ filename: `ring-${productId || 'picture'}.webp`.slice(0, 200), mimeType: 'image/webp', size: result.webp.length, data: result.webp }).returning({ id: media.id });
    return NextResponse.json({ image: `/api/media/${row.id}`, cut: true, width: result.width, height: result.height }, { status: 201 });
  } catch (error) {
    console.error('Ring cut-out failed', error);
    return NextResponse.json({ error: REASONS.load[ar ? 'ar' : 'en'], reason: 'load' }, { status: 422 });
  }
}
