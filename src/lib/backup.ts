import { copy, del, get, list, put } from '@vercel/blob';
import { db, pool } from '@/db';
import { activityLog } from '@/db/schema';
import { invalidateCatalog, invalidateSettings } from './cache-tags';
import { broadcast } from './notify';

/**
 * Full database backups. The same JSON format is used for the manual download, the automatic
 * daily copy (gzipped, kept in a private Vercel Blob store) and restore.
 */
const quote = (i: string) => `"${i.replaceAll('"', '""')}"`;
function encode(v: unknown): unknown { if (Buffer.isBuffer(v)) return { __type: 'bytea', value: v.toString('base64') }; if (Array.isArray(v)) return v.map(encode); if (v && typeof v === 'object' && !(v instanceof Date)) { const o: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = encode(x); return o; } return v; }
function decode(v: unknown): unknown { if (Array.isArray(v)) return v.map(decode); if (v && typeof v === 'object') { const o = v as Record<string, unknown>; if (o.__type === 'bytea' && typeof o.value === 'string') return Buffer.from(o.value, 'base64'); const out: Record<string, unknown> = {}; for (const [k, x] of Object.entries(o)) out[k] = decode(x); return out; } return v; }

async function tableNames() {
  const r = await pool.query<{ name: string }>(`select table_name as name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name`);
  return r.rows.map(x => x.name);
}

/** The whole database as a JSON stream, one table at a time (never held in memory as one string). */
export async function backupStream(onDone?: (tables: number) => Promise<void> | void) {
  const names = await tableNames();
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`{"format":"store-admin-backup","version":1,"createdAt":${JSON.stringify(new Date().toISOString())},"tables":{`));
        for (const [index, name] of names.entries()) {
          const r = await pool.query(`select * from public.${quote(name)}`);
          controller.enqueue(encoder.encode(`${index ? ',' : ''}${JSON.stringify(name)}:[`));
          for (const [i, row] of r.rows.entries()) controller.enqueue(encoder.encode(`${i ? ',' : ''}${JSON.stringify(encode(row))}`));
          controller.enqueue(encoder.encode(']'));
        }
        controller.enqueue(encoder.encode('}}'));
        controller.close();
        await onDone?.(names.length);
      } catch (error) { controller.error(error); }
    },
  });
}

// ---------- restore ----------
const BACKUP_FORMATS = ['store-admin-backup', 'bellroy-admin-backup'];
export type Backup = { format: string; version: number; createdAt: string; tables: Record<string, unknown[]> };
export class RestoreError extends Error {}

export function parseBackup(text: string): Backup {
  let backup: Backup;
  try { backup = JSON.parse(text); } catch { throw new RestoreError('Invalid JSON backup file'); }
  if (!backup || !BACKUP_FORMATS.includes(backup.format) || backup.version !== 1 || !backup.tables || typeof backup.tables !== 'object') throw new RestoreError('Unsupported or invalid backup file');
  return backup;
}

function orderTables(names: string[], fks: { child: string; parent: string }[]) {
  const deps = new Map<string, Set<string>>(); for (const n of names) deps.set(n, new Set());
  for (const f of fks) if (deps.has(f.child) && deps.has(f.parent) && f.child !== f.parent) deps.get(f.child)!.add(f.parent);
  const out: string[] = []; const remaining = new Set(names);
  while (remaining.size) { let progressed = false; for (const n of [...remaining]) { if ([...deps.get(n)!].every(x => !remaining.has(x))) { out.push(n); remaining.delete(n); progressed = true; } } if (!progressed) { out.push(...remaining); break; } }
  return out;
}

/** Replaces every table with the backup's rows, in one transaction. */
export async function restoreBackup(backup: Backup, source: string) {
  const client = await pool.connect();
  try {
    const names = (await client.query<{ name: string }>(`select table_name as name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name`)).rows.map(x => x.name);
    const allowed = new Set(names);
    if (Object.keys(backup.tables).some(n => !allowed.has(n))) throw new RestoreError('Backup contains tables that do not exist in this project');
    const fks = (await client.query<{ child: string; parent: string }>(`select tc.table_name as child, ccu.table_name as parent from information_schema.table_constraints tc join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name and ccu.table_schema=tc.table_schema where tc.table_schema='public' and tc.constraint_type='FOREIGN KEY'`)).rows;
    // json/jsonb values must be sent as JSON text; the driver would turn JS arrays into Postgres arrays.
    const jsonCols = new Set((await client.query<{ t: string; c: string }>(`select table_name t, column_name c from information_schema.columns where table_schema='public' and data_type in ('json','jsonb')`)).rows.map(r => `${r.t}.${r.c}`));
    await client.query('BEGIN');
    await client.query(`TRUNCATE ${names.map(n => `public.${quote(n)}`).join(', ')} RESTART IDENTITY CASCADE`);
    for (const name of orderTables(names, fks)) {
      const rows = backup.tables[name]; if (!Array.isArray(rows)) continue;
      for (const raw of rows) { const row = decode(raw) as Record<string, unknown>; const cols = Object.keys(row); if (!cols.length) continue; await client.query(`insert into public.${quote(name)} (${cols.map(quote).join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, cols.map(c => jsonCols.has(`${name}.${c}`) && row[c] !== null && row[c] !== undefined ? JSON.stringify(row[c]) : row[c])); }
    }
    const serials = await client.query<{ table_name: string; column_name: string; sequence_name: string }>(`select table_name,column_name,pg_get_serial_sequence(format('%I.%I',table_schema,table_name),column_name) as sequence_name from information_schema.columns where table_schema='public' and pg_get_serial_sequence(format('%I.%I',table_schema,table_name),column_name) is not null`);
    for (const s of serials.rows) if (s.sequence_name) await client.query(`select setval($1::regclass,coalesce((select max(${quote(s.column_name)}) from public.${quote(s.table_name)}),1),(select count(*)>0 from public.${quote(s.table_name)}))`, [s.sequence_name]);
    await client.query('COMMIT');
  } catch (e) { try { await client.query('ROLLBACK'); } catch { /* already closed */ } throw e; }
  finally { client.release(); }
  try { await db.insert(activityLog).values({ action: 'restore', entity: 'database', details: `Restored backup created ${backup.createdAt} (${source})` }); } catch { /* log only */ }
  invalidateCatalog(); invalidateSettings();
}

// ---------- automatic daily copies ----------
const PREFIX = 'backups/';
/** Daily copies kept, plus the copy from the 1st of each month for this many months. */
export const KEEP_DAILY = 7, KEEP_MONTHLY = 3;
export const autoBackupReady = () => !!process.env.BLOB_READ_WRITE_TOKEN;
export type AutoBackup = { pathname: string; size: number; uploadedAt: string; monthly: boolean };

export async function listAutoBackups(): Promise<AutoBackup[]> {
  if (!autoBackupReady()) return [];
  const out: AutoBackup[] = []; let cursor: string | undefined;
  do { const page = await list({ prefix: PREFIX, cursor, limit: 1000 }); for (const b of page.blobs) out.push({ pathname: b.pathname, size: b.size, uploadedAt: new Date(b.uploadedAt).toISOString(), monthly: b.pathname.startsWith(`${PREFIX}monthly/`) }); cursor = page.hasMore ? page.cursor : undefined; } while (cursor);
  return out.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/** Writes today's gzipped copy to the private Blob store and removes copies past the keep window. */
export async function runAutoBackup(trigger: 'schedule' | 'manual') {
  if (!autoBackupReady()) throw new Error('Backup storage is not connected (BLOB_READ_WRITE_TOKEN missing).');
  const started = Date.now();
  const baghdad = new Date(Date.now() + 3 * 3600_000);
  const day = baghdad.toISOString().slice(0, 10);
  let tables = 0;
  try {
    const gz = (await backupStream(n => { tables = n; })).pipeThrough(new CompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
    const saved = await put(`${PREFIX}daily/ur-backup-${day}.json.gz`, gz, { access: 'private', contentType: 'application/gzip', addRandomSuffix: false, allowOverwrite: true, multipart: true });
    if (baghdad.getUTCDate() === 1) await copy(saved.url, `${PREFIX}monthly/ur-backup-${day.slice(0, 7)}.json.gz`, { access: 'private', contentType: 'application/gzip', addRandomSuffix: false, allowOverwrite: true });
    const all = await listAutoBackups();
    const stale = [...all.filter(b => !b.monthly).slice(KEEP_DAILY), ...all.filter(b => b.monthly).slice(KEEP_MONTHLY)];
    if (stale.length) await del(stale.map(b => b.pathname));
    const size = all.find(b => b.pathname === saved.pathname)?.size ?? 0;
    try { await db.insert(activityLog).values({ action: 'backup', entity: 'database', details: `Automatic backup (${tables} tables) · ${(size / 1048576).toFixed(1)} MB` }); } catch { /* log only */ }
    return { pathname: saved.pathname, size, tables, seconds: Math.round((Date.now() - started) / 1000), removed: stale.length, trigger };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Automatic backup failed', message);
    await broadcast(`⚠️ <b>فشل النسخ الاحتياطي التلقائي</b>\n${day}\n${message.slice(0, 300)}`).catch(() => {});
    throw error;
  }
}

/** A stored copy, decompressed back to the plain JSON backup format. */
export async function openAutoBackup(pathname: string) {
  if (!pathname.startsWith(PREFIX) || pathname.includes('..')) return null;
  const file = await get(pathname, { access: 'private', useCache: false });
  if (!file?.stream) return null;
  return file.stream.pipeThrough(new DecompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
}
