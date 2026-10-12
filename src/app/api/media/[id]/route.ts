import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { db } from '@/db';
import { media } from '@/db/schema';
import { MEDIA_WIDTHS } from '@/lib/types';

export const runtime = 'nodejs';

// Uploaded media never changes under the same id (a new upload gets a new id),
// so browsers and the Vercel CDN may keep every response for a year. The CDN
// copy means the database is read once per image size, not once per visitor.
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
  'X-Content-Type-Options': 'nosniff',
};
const RESIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

function requestedWidth(request: NextRequest) {
  const raw = Number(request.nextUrl.searchParams.get('w'));
  if (!Number.isFinite(raw) || raw <= 0) return null;
  // Snap to a fixed set of widths so the CDN only ever stores a few variants per image.
  return MEDIA_WIDTHS.find(width => width >= raw) ?? MEDIA_WIDTHS[MEDIA_WIDTHS.length - 1];
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) return new NextResponse('Not found', { status: 404 });
  const [row] = await db.select().from(media).where(eq(media.id, numericId));
  if (!row) return new NextResponse('Not found', { status: 404 });

  const width = requestedWidth(request);
  if (width && RESIZABLE.has(row.mimeType)) {
    try {
      const resized = await sharp(row.data, { failOn: 'none' })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      return new NextResponse(new Uint8Array(resized), {
        headers: { ...CACHE_HEADERS, 'Content-Type': 'image/webp', 'Content-Length': String(resized.length) },
      });
    } catch (error) {
      console.error(`Resizing media ${numericId} failed; serving the original`, error);
    }
  }
  return new NextResponse(new Uint8Array(row.data), {
    headers: { ...CACHE_HEADERS, 'Content-Type': row.mimeType, 'Content-Length': String(row.size) },
  });
}
