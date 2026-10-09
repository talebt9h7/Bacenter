import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { banners, contentPages, media, productVariants, settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdminSection } from '@/lib/admin-auth';

// Deployment refresh: keep the media route rebuild explicit for the production deployment.
export const dynamic = 'force-dynamic';
const MAX_BYTES = 8 * 1024 * 1024;

export async function GET() {
  try {
    if (!(await requireAdminSection('storefront', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const items = await db.select({ id: media.id, filename: media.filename, mimeType: media.mimeType, size: media.size, createdAt: media.createdAt }).from(media).orderBy(media.id);
    return NextResponse.json({ items: items.reverse() });
  } catch (error) {
    console.error('Media library GET failed', error);
    return NextResponse.json({ error: 'Could not load the media library. Check the server logs for the underlying database error.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdminSection('storefront', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid media id.' }, { status: 400 });
  const url = `/api/media/${id}`;
  const [variantRows, bannerRows, pageRows, settingRows] = await Promise.all([
    db.select({ images: productVariants.images }).from(productVariants),
    db.select({ image: banners.image, mobileImage: banners.mobileImage }).from(banners),
    db.select({ image: contentPages.image, sections: contentPages.sections }).from(contentPages),
    db.select({ value: settings.value }).from(settings),
  ]);
  const used = variantRows.some(r => (r.images ?? []).includes(url)) || bannerRows.some(r => r.image === url || r.mobileImage === url) || pageRows.some(r => r.image === url || JSON.stringify(r.sections ?? []).includes(url)) || settingRows.some(r => JSON.stringify(r.value ?? {}).includes(url));
  if (used) return NextResponse.json({ error: 'This image is currently used by storefront content. Remove its references before deleting it.' }, { status: 409 });
  const deleted = await db.delete(media).where(eq(media.id,id)).returning({ id: media.id });
  if (!deleted.length) return NextResponse.json({ error: 'Media not found.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  if (!(await requireAdminSection('storefront', 'manage'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const form = await request.formData();
    const files = form.getAll('files').filter((entry): entry is File => entry instanceof File);
    if (!files.length) return NextResponse.json({ error: 'Choose at least one image to upload.' }, { status: 400 });
    if (files.length > 12) return NextResponse.json({ error: 'Upload up to 12 images at a time.' }, { status: 400 });
    const urls: string[] = [];
    for (const file of files) {
      const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
      if (!allowedTypes.has(file.type)) return NextResponse.json({ error: `${file.name} is not a supported image. Please use JPG, PNG, WebP, AVIF or GIF.` }, { status: 400 });
      if (file.size > MAX_BYTES) return NextResponse.json({ error: `${file.name} is larger than 8 MB.` }, { status: 400 });
      const data = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type;
      const [row] = await db.insert(media).values({ filename: file.name.slice(0, 200), mimeType, size: data.length, data }).returning({ id: media.id });
      urls.push(`/api/media/${row.id}`);
    }
    return NextResponse.json({ urls }, { status: 201 });
  } catch (error) { console.error('Upload failed', error); return NextResponse.json({ error: 'The upload failed. Please try again.' }, { status: 500 }); }
}
