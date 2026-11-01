import { NextResponse } from 'next/server';
import { getAdminActor } from '@/lib/admin-auth';
import { openAutoBackup, parseBackup, restoreBackup, RestoreError } from '@/lib/backup';
export const dynamic = 'force-dynamic'; export const runtime = 'nodejs'; export const maxDuration = 300;

/**
 * Restores either an uploaded backup file (multipart: file + confirmation) or one of the stored
 * automatic copies (JSON: { pathname, confirmation }) — the latter avoids upload size limits.
 */
export async function POST(request: Request) {
  const actor = await getAdminActor(); if (!actor || actor.type !== 'owner') return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  try {
    let text: string, source: string;
    if ((request.headers.get('content-type') || '').includes('application/json')) {
      const body = await request.json().catch(() => ({})) as { pathname?: string; confirmation?: string };
      if (body.confirmation !== 'RESTORE') return NextResponse.json({ error: 'Type RESTORE to confirm' }, { status: 400 });
      const stream = body.pathname ? await openAutoBackup(body.pathname) : null;
      if (!stream) return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
      text = await new Response(stream).text(); source = `automatic copy ${body.pathname}`;
    } else {
      const form = await request.formData(), file = form.get('file');
      if (!(file instanceof File)) return NextResponse.json({ error: 'Backup file is required' }, { status: 400 });
      if (form.get('confirmation') !== 'RESTORE') return NextResponse.json({ error: 'Type RESTORE to confirm' }, { status: 400 });
      if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'Backup file is too large (50 MB maximum)' }, { status: 400 });
      text = await file.text(); source = 'uploaded file';
    }
    await restoreBackup(parseBackup(text), source);
    return NextResponse.json({ ok: true, message: 'Backup restored successfully' });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Restore failed' }, { status: e instanceof RestoreError ? 400 : 500 });
  }
}
