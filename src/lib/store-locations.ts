import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { storeLocations } from '@/db/schema';

export type StoreLocation = typeof storeLocations.$inferSelect;

export async function getStoreLocations(options: { includeInactive?: boolean } = {}) {
  const rows = await db.select().from(storeLocations).orderBy(asc(storeLocations.sortOrder), asc(storeLocations.id));
  return options.includeInactive ? rows : rows.filter(row => row.active);
}
