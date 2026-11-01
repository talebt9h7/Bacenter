import { NextRequest, NextResponse } from 'next/server';
import { getAdminActor } from '@/lib/admin-auth';
import { autoBackupReady, KEEP_DAILY, KEEP_MONTHLY, listAutoBackups, openAutoBackup, runAutoBackup } from '@/lib/backup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const owner = async () => { const a = await getAdminActor(); return a?.type === 'owner' ? a : null; };

/** Lists the stored automatic copies, or (?download=pathname) streams one back as plain JSON. */
export async function GET(request: NextRequest) {
  if (!(await owner())) return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  const download = request.nextUrl.searchParams.get('download');
  if (download) {
    const stream = await openAutoBackup(download);
    if (!stream) return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    const name = (download.split('/').pop() || 'ur-backup.json.gz').replace(/\.gz$/, '');
    return new NextResponse(stream, { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
  }
  try { return NextResponse.json({ ready: autoBackupReady(), keepDaily: KEEP_DAILY, keepMonthly: KEEP_MONTHLY, items: await listAutoBackups() }); }
  catch (error) { return NextResponse.json({ ready: autoBackupReady(), keepDaily: KEEP_DAILY, keepMonthly: KEEP_MONTHLY, items: [], error: error instanceof Error ? error.message : 'Could not list backups' }); }
}

/** Takes a copy now (same as the nightly run). */
export async function POST() {
  if (!(await owner())) return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  try { return NextResponse.json({ ok: true, ...(await runAutoBackup('manual')) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Backup failed' }, { status: 500 }); }
}
