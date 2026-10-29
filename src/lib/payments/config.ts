import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { invalidateSettings } from '../cache-tags';

/**
 * Electronic payment gateway settings. Stored as one settings row ("payments") and read only on
 * the server: client secrets and API keys never reach the storefront or the admin page in full.
 */
export type PaymentProvider = 'zaincash' | 'fib' | 'alqaseh';
export type PaymentMode = 'test' | 'live';
export type PaymentSettings = {
  enabled: boolean;
  provider: PaymentProvider;
  mode: PaymentMode;
  zaincash: { clientId: string; clientSecret: string; apiKey: string; serviceType: string; liveBaseUrl: string };
  fib: { clientId: string; clientSecret: string; liveBaseUrl: string };
  /** Al Qaseh (card payments, hosted page). liveBaseUrl = API, livePayUrl = hosted payment page. */
  alqaseh: { clientId: string; clientSecret: string; liveBaseUrl: string; livePayUrl: string };
};
export const defaultPaymentSettings: PaymentSettings = {
  enabled: false,
  provider: 'zaincash',
  mode: 'test',
  zaincash: { clientId: '', clientSecret: '', apiKey: '', serviceType: '', liveBaseUrl: '' },
  fib: { clientId: '', clientSecret: '', liveBaseUrl: '' },
  alqaseh: { clientId: '', clientSecret: '', liveBaseUrl: '', livePayUrl: '' },
};
// Sandbox hosts published by each provider. Live hosts are given by the provider at onboarding.
export const SANDBOX = { zaincash: 'https://pg-api-uat.zaincash.iq', fib: 'https://fib.stage.fib.iq', alqaseh: 'https://api-test.alqaseh.com/v1' } as const;
export const ALQASEH_SANDBOX_PAY = 'https://pay-test.alqaseh.com/pay';
// Al Qaseh publishes shared sandbox credentials; used in test mode when no own UAT keys are saved.
export const ALQASEH_SANDBOX_CLIENT = { clientId: 'public_test', clientSecret: 'Lr10yWWmm1dXLoI7VgXCrQVnlq13c1G0' };
const KEY = 'payments';

function merge(value: unknown): PaymentSettings {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<PaymentSettings>;
  return {
    enabled: v.enabled === true,
    provider: v.provider === 'fib' || v.provider === 'alqaseh' ? v.provider : 'zaincash',
    mode: v.mode === 'live' ? 'live' : 'test',
    zaincash: { ...defaultPaymentSettings.zaincash, ...(v.zaincash ?? {}) },
    fib: { ...defaultPaymentSettings.fib, ...(v.fib ?? {}) },
    alqaseh: { ...defaultPaymentSettings.alqaseh, ...(v.alqaseh ?? {}) },
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
  const live = provider === 'fib' ? s.fib.liveBaseUrl : provider === 'alqaseh' ? s.alqaseh.liveBaseUrl : s.zaincash.liveBaseUrl;
  return (s.mode === 'live' && live ? live : SANDBOX[provider]).replace(/\/+$/, '');
}
/** What is missing before the chosen provider can take payments (empty when ready). */
export function missingFields(s: PaymentSettings, provider: PaymentProvider = s.provider): string[] {
  const out: string[] = [];
  if (provider === 'zaincash') {
    const z = s.zaincash;
    if (!z.clientId) out.push('clientId'); if (!z.clientSecret) out.push('clientSecret'); if (!z.apiKey) out.push('apiKey'); if (!z.serviceType) out.push('serviceType');
    if (s.mode === 'live' && !z.liveBaseUrl) out.push('liveBaseUrl');
  } else if (provider === 'alqaseh') {
    const q = s.alqaseh;
    // Test mode can run on Al Qaseh's shared sandbox keys; live needs the merchant's own keys and hosts.
    if (s.mode === 'live') { if (!q.clientId) out.push('clientId'); if (!q.clientSecret) out.push('clientSecret'); if (!q.liveBaseUrl) out.push('liveBaseUrl'); if (!q.livePayUrl) out.push('livePayUrl'); }
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
    alqaseh: { ...s.alqaseh, clientSecret: maskSecret(s.alqaseh.clientSecret) },
  };
}

/** Al Qaseh credentials and hosts for the current mode (sandbox defaults in test mode). */
export function alqasehAccess(s: PaymentSettings) {
  const live = s.mode === 'live';
  const own = s.alqaseh.clientId && s.alqaseh.clientSecret;
  return {
    clientId: own ? s.alqaseh.clientId : live ? '' : ALQASEH_SANDBOX_CLIENT.clientId,
    clientSecret: own ? s.alqaseh.clientSecret : live ? '' : ALQASEH_SANDBOX_CLIENT.clientSecret,
    api: baseUrl(s, 'alqaseh'),
    pay: (live && s.alqaseh.livePayUrl ? s.alqaseh.livePayUrl : ALQASEH_SANDBOX_PAY).replace(/\/+$/, ''),
  };
}
