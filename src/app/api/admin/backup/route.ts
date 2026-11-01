import { NextResponse } from 'next/server';
import { db } from '@/db';
import { activityLog } from '@/db/schema';
import { getAdminActor } from '@/lib/admin-auth';
import { backupStream } from '@/lib/backup';
export const dynamic = 'force-dynamic'; export const runtime = 'nodejs'; export const maxDuration = 300;

/** Manual download of the whole database as JSON, streamed table by table. */
export async function GET() {
  const actor = await getAdminActor(); if (!actor || actor.type !== 'owner') return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  const stream = await backupStream(async tables => { try { await db.insert(activityLog).values({ action: 'backup', entity: 'database', details: `Backup created (${tables} tables)` }); } catch { /* log only */ } });
  return new NextResponse(stream, { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="store-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json"`, 'cache-control': 'no-store' } });
}
