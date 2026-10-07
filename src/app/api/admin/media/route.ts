import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { db } from '@/db';
import { banners, contentPages, media, productVariants, settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdminSection } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
const MAX_BYTES = 8 * 1024 * 1024;

export async function GET() {
  if (!(await requireAdminSection('storefront', 'view'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const items = await db.select({ id: media.id, filename: media.filename, mimeType: media.mimeType, size: media.size, createdAt: media.createdAt }).from(media).orderBy(media.id);
  return NextResponse.json({ items: items.reverse() });
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
      if (!file.type.startsWith('image/')) return NextResponse.json({ error: `${file.name} is not an image.` }, { status: 400 });
      if (file.size > MAX_BYTES) return NextResponse.json({ error: `${file.name} is larger than 8 MB.` }, { status: 400 });
      const source = Buffer.from(await file.arrayBuffer());
      let data: Buffer; let mimeType: string;
      try { data = await sharp(source, { animated: false }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86 }).toBuffer(); mimeType = 'image/webp'; }
      catch { return NextResponse.json({ error: `${file.name} could not be processed. Please use JPG, PNG, WebP or AVIF.` }, { status: 400 }); }
      const [row] = await db.insert(media).values({ filename: file.name.slice(0, 200), mimeType, size: data.length, data }).returning({ id: media.id });
      urls.push(`/api/media/${row.id}`);
    }
    return NextResponse.json({ urls }, { status: 201 });
  } catch (error) { console.error('Upload failed', error); return NextResponse.json({ error: 'The upload failed. Please try again.' }, { status: 500 }); }
}
