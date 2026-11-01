import { NextRequest, NextResponse } from 'next/server';
import { runAutoBackup } from '@/lib/backup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/** Called by Vercel Cron once a day (see vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET". */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json({ ok: true, ...(await runAutoBackup('schedule')) }); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Backup failed' }, { status: 500 }); }
}
