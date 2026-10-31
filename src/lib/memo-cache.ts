/**
 * Small in-memory cache for heavy admin statistics. Each server instance keeps a result for a few
 * seconds, so reloading the dashboard or switching between pages does not rerun the same large
 * queries. Concurrent requests for the same key share one query. Values are kept as-is (no JSON
 * round-trip), so Dates and Maps survive.
 */
type Entry = { at: number; value: Promise<unknown> };
const store = new Map<string, Entry>();

export function memo<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load();
  store.set(key, { at: now, value });
  value.catch(() => { if (store.get(key)?.value === value) store.delete(key); });
  if (store.size > 200) for (const [k, e] of store) if (now - e.at >= ttlMs) store.delete(k);
  return value;
}

/** Drop cached stats (after an order or stock change, so the next view is fresh). */
export function clearMemo(prefix = '') { for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k); }
