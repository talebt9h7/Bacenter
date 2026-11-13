import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { defaultWholesaleReceipt, normalizeReceiptSettings } from '@/lib/wholesale-receipt';
export const WHOLESALE_RECEIPT_KEY = 'wholesaleReceipt';
export async function getWholesaleReceiptSettings() {
  const [store, [row]] = await Promise.all([getSettings(), db.select({ value: settings.value }).from(settings).where(eq(settings.key, WHOLESALE_RECEIPT_KEY))]);
  return normalizeReceiptSettings(row?.value, { ...defaultWholesaleReceipt, logoUrl: store.logoUrl || defaultWholesaleReceipt.logoUrl, phone: store.supportPhone || '', address: store.address || '' });
}
