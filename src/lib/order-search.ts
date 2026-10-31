import { ilike, or, sql, type SQL } from 'drizzle-orm';
import { orders } from '@/db/schema';

/** Search across every order (not a recent subset): reference, name, phone, email, governorate, city, address. */
export function searchFilter(q: string): SQL | undefined {
  const term = q.trim().slice(0, 80);
  if (!term) return undefined;
  const like = `%${term.replace(/[\\%_]/g, m => `\\${m}`)}%`;
  const digits = term.replace(/\D/g, '');
  const parts: SQL[] = [ilike(orders.reference, like), ilike(orders.name, like), ilike(orders.email, like), ilike(orders.governorate, like), sql`${orders.address}->>'city' ilike ${like}`, sql`${orders.address}->>'line1' ilike ${like}`];
  if (digits.length >= 3) parts.push(sql`regexp_replace(${orders.phone}, '\\D', '', 'g') like ${`%${digits.replace(/^0+/, '')}%`}`);
  else parts.push(ilike(orders.phone, like));
  return or(...parts);
}

