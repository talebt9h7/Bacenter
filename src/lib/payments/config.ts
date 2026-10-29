import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { invalidateSettings } from '../cache-tags';

/**
 * Electronic payment gateway settings. Stored as one settings row ("payments") and read only on
 * the server: client secrets and API keys never reach the storefront or the admin page in full.
 */
export type PaymentProvider = 'zaincash' | 'fib';
export type PaymentMode = 'test' | 'live';
export type PaymentSettings = {
  enabled: boolean;
  provider: PaymentProvider;
  mode: PaymentMode;
  zaincash: { clientId: string; clientSecret: string; apiKey: string; serviceType: string; liveBaseUrl: string };
  fib: { clientId: string; clientSecret: string; liveBaseUrl: string };
};
export const defaultPaymentSettings: PaymentSettings = {
  enabled: false,
  provider: 'zaincash',
  mode: 'test',
  zaincash: { clientId: '', clientSecret: '', apiKey: '', serviceType: '', liveBaseUrl: '' },
  fib: { clientId: '', clientSecret: '', liveBaseUrl: '' },
};
// Sandbox hosts published by each provider. Live hosts are given by the provider at onboarding.
export const SANDBOX = { zaincash: 'https://pg-api-uat.zaincash.iq', fib: 'https://fib.stage.fib.iq' } as const;
const KEY = 'payments';

function merge(value: unknown): PaymentSettings {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<PaymentSettings>;
  return {
    enabled: v.enabled === true,
    provider: v.provider === 'fib' ? 'fib' : 'zaincash',
    mode: v.mode === 'live' ? 'live' : 'test',
    zaincash: { ...defaultPaymentSettings.zaincash, ...(v.zaincash ?? {}) },
    fib: { ...defaultPaymentSettings.fib, ...(v.fib ?? {}) },
  };
}
// Not cached: payments are rare and must always use the current keys.
export async function getPaymentSettings(): Promise<PaymentSettings> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, KEY));
    return merge(row?.value);
  } catch (error) { console.error('Loading payment settings failed', error); return defaultPaymentSettings; }
}
export async function savePaymentSettings(next: PaymentSettings) {
  await db.insert(settings).values({ key: KEY, value: next, updatedAt: new Date() }).onConflictDoUpdate({ target: settings.key, set: { value: next, updatedAt: new Date() } });
  invalidateSettings();
}

export function baseUrl(s: PaymentSettings, provider: PaymentProvider = s.provider) {
  const live = provider === 'fib' ? s.fib.liveBaseUrl : s.zaincash.liveBaseUrl;
  return (s.mode === 'live' && live ? live : SANDBOX[provider]).replace(/\/+$/, '');
}
/** What is missing before the chosen provider can take payments (empty when ready). */
export function missingFields(s: PaymentSettings, provider: PaymentProvider = s.provider): string[] {
  const out: string[] = [];
  if (provider === 'zaincash') {
    const z = s.zaincash;
    if (!z.clientId) out.push('clientId'); if (!z.clientSecret) out.push('clientSecret'); if (!z.apiKey) out.push('apiKey'); if (!z.serviceType) out.push('serviceType');
    if (s.mode === 'live' && !z.liveBaseUrl) out.push('liveBaseUrl');
  } else {
    const f = s.fib;
    if (!f.clientId) out.push('clientId'); if (!f.clientSecret) out.push('clientSecret');
    if (s.mode === 'live' && !f.liveBaseUrl) out.push('liveBaseUrl');
  }
  return out;
}
/** True when the storefront should send electronic payments to the gateway. */
export function gatewayReady(s: PaymentSettings) { return s.enabled && missingFields(s).length === 0; }

export const SECRET_MASK = '••••••';
export function maskSecret(value: string) { return value ? SECRET_MASK : ''; }
/** The settings as the admin page may see them: secrets masked. */
export function maskedPaymentSettings(s: PaymentSettings): PaymentSettings {
  return {
    ...s,
    zaincash: { ...s.zaincash, clientSecret: maskSecret(s.zaincash.clientSecret), apiKey: maskSecret(s.zaincash.apiKey) },
    fib: { ...s.fib, clientSecret: maskSecret(s.fib.clientSecret) },
  };
}
