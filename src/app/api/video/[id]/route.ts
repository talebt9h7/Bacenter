import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { media } from '@/db/schema';

export const runtime = 'nodejs';

/**
 * Serves an uploaded video with byte ranges (iPhone Safari refuses to play a video without them).
 * A video never changes under the same id, so it may be cached for a year.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new NextResponse('Not found', { status: 404 });
  const [row] = await db.select().from(media).where(eq(media.id, id));
  if (!row || !row.mimeType.startsWith('video/')) return new NextResponse('Not found', { status: 404 });
  const data = Buffer.from(row.data), total = data.length;
  const base = { 'Content-Type': row.mimeType, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' };
  const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
  if (!match || (!match[1] && !match[2])) return new NextResponse(new Uint8Array(data), { headers: { ...base, 'Content-Length': String(total) } });
  let start = match[1] ? Number(match[1]) : Math.max(0, total - Number(match[2]));
  let end = match[1] && match[2] ? Number(match[2]) : total - 1;
  if (start >= total) return new NextResponse(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${total}` } });
  end = Math.min(end, total - 1); start = Math.min(start, end);
  return new NextResponse(new Uint8Array(data.subarray(start, end + 1)), { status: 206, headers: { ...base, 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': String(end - start + 1) } });
}
