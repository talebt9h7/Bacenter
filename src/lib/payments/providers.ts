import { createHmac, timingSafeEqual } from 'node:crypto';
import { alqasehAccess, baseUrl, type PaymentProvider, type PaymentSettings } from './config';

/** Our own payment status, shared by both providers. */
export type PayStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled' | 'refunded';
export const FINAL: PayStatus[] = ['paid', 'failed', 'expired', 'cancelled', 'refunded'];

export class GatewayError extends Error {
  constructor(message: string, public status = 0, public body: unknown = null) { super(message); }
}

const TIMEOUT_MS = 15000;
async function call(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const detail = typeof body === 'object' && body ? JSON.stringify(body).slice(0, 300) : String(body ?? '').slice(0, 300);
    throw new GatewayError(`${response.status} ${response.statusText}${detail ? ` — ${detail}` : ''}`, response.status, body);
  }
  return body;
}

/** Reads the first of several possible field names, at the top level or under `data`. */
function pick(obj: unknown, keys: string[]): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const o = obj as Record<string, unknown>;
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  for (const nest of ['data', 'result', 'transaction', 'payload']) {
    const inner = o[nest];
    if (inner && typeof inner === 'object') { const v = pick(inner, keys); if (v !== undefined) return v; }
  }
  return undefined;
}
const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));

// OAuth2 client-credentials tokens, reused until shortly before they expire.
const tokens = new Map<string, { token: string; until: number }>();
async function clientToken(cacheKey: string, url: string, form: Record<string, string>) {
  const hit = tokens.get(cacheKey);
  if (hit && hit.until > Date.now()) return hit.token;
  const body = await call(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams(form).toString() });
  const token = str(pick(body, ['access_token', 'accessToken', 'token']));
  if (!token) throw new GatewayError('The gateway did not return an access token.', 0, body);
  const ttl = Number(pick(body, ['expires_in', 'expiresIn'])) || 60;
  tokens.set(cacheKey, { token, until: Date.now() + Math.max(10, ttl - 15) * 1000 });
  return token;
}

/* ---------------- ZainCash (Payment Gateway v2) ---------------- */

function zcToken(s: PaymentSettings) {
  const base = baseUrl(s, 'zaincash');
  return clientToken(`zc:${base}:${s.zaincash.clientId}`, `${base}/oauth2/token`, {
    grant_type: 'client_credentials', client_id: s.zaincash.clientId, client_secret: s.zaincash.clientSecret, scope: 'payment:read payment:write',
  });
}
export function zcStatus(raw: unknown): PayStatus {
  const v = str(raw).toUpperCase();
  if (v === 'SUCCESS' || v === 'COMPLETED' || v === 'PAID') return 'paid';
  if (v === 'FAILED' || v === 'DECLINED') return 'failed';
  if (v === 'EXPIRED') return 'expired';
  if (v === 'CANCELLED' || v === 'CANCELED') return 'cancelled';
  if (v === 'REFUNDED') return 'refunded';
  return 'pending';
}
async function zcInit(s: PaymentSettings, input: StartInput): Promise<StartResult> {
  const base = baseUrl(s, 'zaincash');
  const token = await zcToken(s);
  const body = await call(`${base}/api/v2/payment-gateway/transaction/init`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      language: input.language === 'en' ? 'En' : 'Ar',
      externalReferenceId: input.externalRef,
      orderId: input.orderReference,
      serviceType: s.zaincash.serviceType,
      amount: { value: input.amountIqd, currency: 'IQD' },
      ...(input.phone ? { customer: { phone: input.phone } } : {}),
      redirectUrls: { successUrl: input.returnUrl, failureUrl: input.returnUrl },
    }),
  });
  const redirectUrl = str(pick(body, ['redirectUrl', 'redirect_url', 'paymentUrl', 'url']));
  const providerRef = str(pick(body, ['transactionId', 'transaction_id', 'id']));
  if (!redirectUrl) throw new GatewayError('ZainCash did not return a payment page link.', 0, body);
  return { providerRef, redirectUrl, details: { init: body } };
}
async function zcInquiry(s: PaymentSettings, transactionId: string) {
  const token = await zcToken(s);
  const body = await call(`${baseUrl(s, 'zaincash')}/api/v2/payment-gateway/transaction/inquiry/${encodeURIComponent(transactionId)}`, {
    method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  return { status: zcStatus(pick(body, ['status', 'transactionStatus', 'state'])), raw: body };
}

/** Verifies a ZainCash redirect / webhook JWT (HS256, signed with the merchant API key). */
export function verifyZainCashToken(jwt: string, apiKey: string): Record<string, unknown> | null {
  const parts = jwt.split('.');
  if (parts.length !== 3 || !apiKey) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as { alg?: string };
    if (header.alg !== 'HS256') return null;
    const expected = createHmac('sha256', apiKey).update(`${parts[0]}.${parts[1]}`).digest();
    const given = Buffer.from(parts[2], 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now() - 60_000) return null;
    return payload;
  } catch { return null; }
}
/** The transaction id, our reference and status carried in a verified ZainCash token. */
export function zainCashClaims(payload: Record<string, unknown>) {
  return {
    transactionId: str(pick(payload, ['transactionId', 'transaction_id', 'id'])),
    externalRef: str(pick(payload, ['externalReferenceId', 'external_reference_id', 'externalRef'])),
    status: zcStatus(pick(payload, ['status', 'transactionStatus', 'currentStatus'])),
  };
}

/* ---------------- FIB (First Iraqi Bank, web payments) ---------------- */

function fibToken(s: PaymentSettings) {
  const base = baseUrl(s, 'fib');
  return clientToken(`fib:${base}:${s.fib.clientId}`, `${base}/auth/realms/fib-online-shop/protocol/openid-connect/token`, {
    grant_type: 'client_credentials', client_id: s.fib.clientId, client_secret: s.fib.clientSecret,
  });
}
export function fibStatus(raw: unknown, reason?: unknown): PayStatus {
  const v = str(raw).toUpperCase();
  if (v === 'PAID') return 'paid';
  if (v === 'DECLINED') {
    const r = str(reason).toUpperCase();
    return r === 'PAYMENT_EXPIRATION' ? 'expired' : r === 'PAYMENT_CANCELLATION' ? 'cancelled' : 'failed';
  }
  return 'pending';
}
async function fibCreate(s: PaymentSettings, input: StartInput): Promise<StartResult> {
  const token = await fibToken(s);
  const body = await call(`${baseUrl(s, 'fib')}/protected/v1/payments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      monetaryValue: { amount: `${input.amountIqd}.00`, currency: 'IQD' },
      statusCallbackUrl: input.callbackUrl,
      description: `UR ${input.orderReference}`.slice(0, 50),
    }),
  });
  const providerRef = str(pick(body, ['paymentId', 'id']));
  if (!providerRef) throw new GatewayError('FIB did not return a payment id.', 0, body);
  return {
    providerRef,
    redirectUrl: null,
    details: {
      qrCode: str(pick(body, ['qrCode'])),
      readableCode: str(pick(body, ['readableCode'])),
      personalAppLink: str(pick(body, ['personalAppLink'])),
      businessAppLink: str(pick(body, ['businessAppLink'])),
      corporateAppLink: str(pick(body, ['corporateAppLink'])),
      validUntil: str(pick(body, ['validUntil'])),
    },
  };
}
async function fibCheck(s: PaymentSettings, paymentId: string) {
  const token = await fibToken(s);
  const body = await call(`${baseUrl(s, 'fib')}/protected/v1/payments/${encodeURIComponent(paymentId)}/status`, {
    method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  return { status: fibStatus(pick(body, ['status']), pick(body, ['decliningReason'])), raw: body };
}
async function fibCancel(s: PaymentSettings, paymentId: string) {
  const token = await fibToken(s);
  await call(`${baseUrl(s, 'fib')}/protected/v1/payments/${encodeURIComponent(paymentId)}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
}

/* ---------------- Al Qaseh (cards, hosted payment page) ---------------- */

function qsHeaders(s: PaymentSettings) {
  const a = alqasehAccess(s);
  return { Authorization: `Basic ${Buffer.from(`${a.clientId}:${a.clientSecret}`, 'utf8').toString('base64')}`, Accept: 'application/json' };
}
export function qsStatus(raw: unknown): PayStatus {
  const v = str(raw).toLowerCase();
  if (v === 'succeeded' || v === 'success') return 'paid';
  if (v === 'failed' || v === 'declined' || v === 'duplicated') return 'failed';
  if (v === 'expired') return 'expired';
  if (v === 'revoked') return 'cancelled';
  return 'pending'; // prepared, retried, pending, unknown
}
async function qsCreate(s: PaymentSettings, input: StartInput): Promise<StartResult> {
  const a = alqasehAccess(s);
  const body = await call(`${a.api}/egw/payments/create`, {
    method: 'POST',
    headers: { ...qsHeaders(s), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: input.amountIqd,
      currency: 'IQD',
      order_id: input.externalRef, // unique per attempt, so a retry never collides with an earlier one
      description: `UR Leather order ${input.orderReference}`,
      redirect_url: input.returnUrl,
      transaction_type: 'Retail',
      webhook_url: input.callbackUrl,
      country: 'IQ',
    }),
  });
  const paymentId = str(pick(body, ['payment_id', 'paymentId']));
  const token = str(pick(body, ['token']));
  if (!token) throw new GatewayError('Al Qaseh did not return a payment token.', 0, body);
  return { providerRef: paymentId || token, redirectUrl: `${a.pay}/${encodeURIComponent(token)}`, details: { token, paymentId } };
}
/** Status by request token; the amount and currency must match the order before it counts as paid. */
async function qsCheck(s: PaymentSettings, token: string, expectedIqd?: number) {
  const a = alqasehAccess(s);
  const body = await call(`${a.api}/egw/payments/info/${encodeURIComponent(token)}`, { method: 'GET', headers: qsHeaders(s) });
  let status = qsStatus(pick(body, ['payment_status', 'status']));
  if (status === 'paid' && expectedIqd !== undefined) {
    const amount = Number(pick(body, ['amount']));
    const currency = str(pick(body, ['currency'])).toUpperCase();
    if (!(Math.round(amount) === expectedIqd && (!currency || currency === 'IQD'))) {
      console.error('Al Qaseh amount mismatch', { amount, currency, expectedIqd });
      status = 'failed';
    }
  }
  return { status, raw: body };
}
async function qsRevoke(s: PaymentSettings, paymentId: string) {
  const a = alqasehAccess(s);
  await call(`${a.api}/egw/payments/revoke`, { method: 'POST', headers: { ...qsHeaders(s), 'Content-Type': 'application/json' }, body: JSON.stringify({ payment_id: paymentId, details: 'Cancelled by the store' }) });
}

/* ---------------- Provider-neutral entry points ---------------- */

export type StartInput = { orderReference: string; amountIqd: number; externalRef: string; returnUrl: string; callbackUrl: string; phone?: string; language: 'ar' | 'en' };
export type StartResult = { providerRef: string; redirectUrl: string | null; details: Record<string, unknown> };

export function startWithProvider(provider: PaymentProvider, s: PaymentSettings, input: StartInput) {
  return provider === 'fib' ? fibCreate(s, input) : provider === 'alqaseh' ? qsCreate(s, input) : zcInit(s, input);
}
/** `ref` is the provider's id (Al Qaseh: the request token). `expectedIqd` guards against a wrong amount. */
export function checkWithProvider(provider: PaymentProvider, s: PaymentSettings, ref: string, expectedIqd?: number) {
  return provider === 'fib' ? fibCheck(s, ref) : provider === 'alqaseh' ? qsCheck(s, ref, expectedIqd) : zcInquiry(s, ref);
}
export async function cancelWithProvider(provider: PaymentProvider, s: PaymentSettings, providerRef: string) {
  if (provider === 'fib') await fibCancel(s, providerRef);
  else if (provider === 'alqaseh') await qsRevoke(s, providerRef);
}
/** Gets an access token with the saved keys: proves the keys and host are right. */
export async function testConnection(s: PaymentSettings, provider: PaymentProvider = s.provider) {
  tokens.clear();
  if (provider === 'fib') await fibToken(s);
  else if (provider === 'alqaseh') {
    // No token endpoint: an authenticated history request proves the keys.
    await call(`${alqasehAccess(s).api}/egw/payments/history?limit=1`, { method: 'GET', headers: qsHeaders(s) });
  } else await zcToken(s);
  return { host: baseUrl(s, provider) };
}
