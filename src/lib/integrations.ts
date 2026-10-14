import { eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { invalidateSettings, SETTINGS_TAG } from './cache-tags';

/**
 * Notification channels and tracking tags. Stored as one row ("integrations") in the settings
 * table but read only through this module: the bot token and API key never go to the storefront.
 */
export type Integrations = {
  telegram: { enabled: boolean; botToken: string; chatIds: string[] };
  whatsapp: { enabled: boolean; phone: string; apiKey: string };
  notify: { newOrder: boolean; lowStock: boolean };
  tracking: { metaPixelId: string; ga4Id: string; clarityId: string; metaCapiToken: string; metaTestCode: string };
};
export const defaultIntegrations: Integrations = {
  telegram: { enabled: false, botToken: '', chatIds: [] },
  whatsapp: { enabled: false, phone: '', apiKey: '' },
  notify: { newOrder: true, lowStock: true },
  tracking: { metaPixelId: '', ga4Id: '', clarityId: '', metaCapiToken: '', metaTestCode: '' },
};
const KEY = 'integrations';

function merge(value: unknown): Integrations {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Integrations>;
  return {
    telegram: { ...defaultIntegrations.telegram, ...(v.telegram ?? {}) },
    whatsapp: { ...defaultIntegrations.whatsapp, ...(v.whatsapp ?? {}) },
    notify: { ...defaultIntegrations.notify, ...(v.notify ?? {}) },
    tracking: { ...defaultIntegrations.tracking, ...(v.tracking ?? {}) },
  };
}
async function load() {
  const [row] = await db.select().from(settings).where(eq(settings.key, KEY));
  return merge(row?.value);
}
const cached = unstable_cache(load, ['integrations-v1'], { revalidate: 300, tags: [SETTINGS_TAG] });
export async function getIntegrations() {
  try { return await cached(); } catch (error) { console.error('Loading integrations failed', error); return defaultIntegrations; }
}
export async function saveIntegrations(next: Integrations) {
  await db.insert(settings).values({ key: KEY, value: next, updatedAt: new Date() }).onConflictDoUpdate({ target: settings.key, set: { value: next, updatedAt: new Date() } });
  invalidateSettings();
}

// Formats published by each vendor; anything else is dropped so nothing odd reaches the page.
export const trackingPatterns = { metaPixelId: /^\d{8,20}$/, ga4Id: /^G-[A-Z0-9]{4,16}$/, clarityId: /^[a-z0-9]{6,16}$/, metaCapiToken: /^[A-Za-z0-9_-]{30,400}$/, metaTestCode: /^TEST[A-Z0-9]{2,20}$/ } as const;
/** Tracking IDs that are safe to render on the storefront. */
export async function getPublicTracking() {
  const { tracking } = await getIntegrations();
  return {
    metaPixelId: trackingPatterns.metaPixelId.test(tracking.metaPixelId) ? tracking.metaPixelId : '',
    ga4Id: trackingPatterns.ga4Id.test(tracking.ga4Id) ? tracking.ga4Id : '',
    clarityId: trackingPatterns.clarityId.test(tracking.clarityId) ? tracking.clarityId : '',
    capi: Boolean(tracking.metaPixelId && tracking.metaCapiToken),
  };
}
export type PublicTracking = Awaited<ReturnType<typeof getPublicTracking>>;
