import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { media } from '@/db/schema';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) return new NextResponse('Not found', { status: 404 });
  const [row] = await db.select().from(media).where(eq(media.id, numericId));
  if (!row) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(new Uint8Array(row.data), { headers: { 'Content-Type': row.mimeType, 'Content-Length': String(row.size), 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
}
