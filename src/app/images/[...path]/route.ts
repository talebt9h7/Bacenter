import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
};

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const safeSegments = segments.filter(Boolean);
  if (!safeSegments.length || safeSegments.some(segment => segment === '.' || segment === '..' || segment.includes('\\'))) {
    return new NextResponse('Not found', { status: 404 });
  }

  const relative = safeSegments.join('/');
  const filePath = path.join(process.cwd(), 'public', 'images', relative);
  const root = path.resolve(process.cwd(), 'public', 'images');
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(root + path.sep)) return new NextResponse('Not found', { status: 404 });

  try {
    const data = await fs.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    return new NextResponse(data, {
      headers: { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch {
    const placeholder = await fs.readFile(path.join(root, 'placeholder.svg'));
    return new NextResponse(placeholder, {
      status: 200,
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300' },
    });
  }
}
