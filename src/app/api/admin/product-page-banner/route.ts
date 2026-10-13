import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSection } from '@/lib/admin-auth';
import { cleanProductPageBanner, getProductPageBanner, saveProductPageBanner } from '@/lib/product-page-banner';
import { logActivity } from '@/lib/orders';

export const dynamic = 'force-dynamic';
export async function GET() {
  if (!(await requireAdminSection('storefront', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ banner: await getProductPageBanner() });
}
export async function PUT(request: NextRequest) {
  if (!(await requireAdminSection('storefront', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const banner = cleanProductPageBanner(await request.json().catch(() => ({})));
  if (banner.enabled && !banner.image) return NextResponse.json({ error: 'Upload an image first.' }, { status: 400 });
  await saveProductPageBanner(banner);
  await logActivity('update', 'content', 'product-page-banner', banner.enabled ? 'Product page image on' : 'Product page image off');
  return NextResponse.json({ banner });
}
