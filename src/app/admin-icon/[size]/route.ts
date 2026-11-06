import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { getSettings } from '@/lib/settings';
import { loadStoreImage } from '@/lib/cutout';

export const runtime = 'nodejs';
export const revalidate = 86400;

const SIZES: Record<string, { size: number; pad: number }> = { '180': { size: 180, pad: 0.16 }, '192': { size: 192, pad: 0.16 }, '512': { size: 512, pad: 0.16 }, 'maskable-512': { size: 512, pad: 0.26 } };

/** Home-screen icon of the admin app (public/admin.webmanifest): the store logo on the brand cream. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ size: string }> }) {
  const spec = SIZES[(await params).size];
  if (!spec) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const settings = await getSettings().catch(() => null);
  const source = settings?.logoUrl || '/images/UR-logo.svg';
  const logo = await loadStoreImage(source, request.nextUrl.origin).catch(() => null) ?? await loadStoreImage('/images/UR-logo.svg', request.nextUrl.origin).catch(() => null);
  const inner = Math.round(spec.size * (1 - spec.pad * 2));
  const layers = [];
  if (logo) {
    // Trim the logo's empty margins first so it fills the icon.
    const trimmed = await sharp(logo, { density: 600 }).trim({ threshold: 10 }).toBuffer().catch(() => logo);
    layers.push({ input: await sharp(trimmed, { density: 600 }).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), gravity: 'center' });
  }
  const png = await sharp({ create: { width: spec.size, height: spec.size, channels: 4, background: '#f6f1ea' } }).composite(layers).png().toBuffer();
  return new NextResponse(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800' } });
}
