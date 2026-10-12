import { inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { adminLoginAttempts } from '@/db/schema';

const MAX_FAILURES = 8;
const WINDOW_MS = 10 * 60 * 1000;

/**
 * The client IP as seen by Vercel. `x-real-ip` / `x-vercel-forwarded-for` are set by the
 * platform; the first `x-forwarded-for` entry is only used as a fallback (local dev).
 */
export function clientIp(headers: Headers) {
  return headers.get('x-real-ip')?.trim()
    || headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    || headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'local';
}

/** Failures are counted per IP and per username, so one IP can't spray many accounts and many IPs can't hammer one. */
export function throttleKeys(ip: string, username: string) {
  return [`ip:${ip}`, `user:${username.trim().toLowerCase() || 'owner'}`];
}

export async function isLockedOut(keys: string[]) {
  const rows = await db.select().from(adminLoginAttempts).where(inArray(adminLoginAttempts.key, keys));
  const now = Date.now();
  return rows.some(row => row.count >= MAX_FAILURES && row.lockedUntil.getTime() > now);
}

export async function recordFailure(keys: string[]) {
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_MS);
  for (const key of keys) {
    // Counting restarts when the previous window has expired.
    await db.insert(adminLoginAttempts).values({ key, count: 1, lockedUntil: until }).onConflictDoUpdate({
      target: adminLoginAttempts.key,
      set: {
        // Compared with a value written the same way as locked_until (not the database clock),
        // so the result doesn't depend on the database server's time zone.
        count: sql`CASE WHEN ${adminLoginAttempts.lockedUntil} > ${now.toISOString()}::timestamp THEN ${adminLoginAttempts.count} + 1 ELSE 1 END`,
        lockedUntil: until,
      },
    });
  }
}

export async function clearFailures(keys: string[]) {
  await db.delete(adminLoginAttempts).where(inArray(adminLoginAttempts.key, keys));
}
