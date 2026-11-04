/**
 * Shared Intl.NumberFormat instances. Creating a formatter is far slower than using one, and
 * prices are formatted many times per render (every product card, every bag line).
 */
const cache = new Map<string, Intl.NumberFormat>();
export function numberFormat(locale: string, options: Intl.NumberFormatOptions = {}) {
  const key = locale + JSON.stringify(options);
  let f = cache.get(key);
  if (!f) { f = new Intl.NumberFormat(locale, options); cache.set(key, f); }
  return f;
}

/** 1234567 → "1,234,567" without Intl (rounded to a whole number); the shop's most common format. */
export function groupInt(value: number) {
  const n = Math.round(Number(value) || 0);
  const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return n < 0 ? `-${s}` : s;
}
