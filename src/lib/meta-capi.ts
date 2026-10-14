import { createHash } from 'node:crypto';
import { getIntegrations } from './integrations';

/**
 * Meta Conversions API: the same events the browser pixel sends, sent again from the server so
 * Meta still counts them when the pixel is blocked (iOS, ad blockers). Each event carries the
 * same event_id as the browser event, so Meta keeps one and drops the duplicate.
 * Customer details are normalised and SHA-256 hashed before they leave the server.
 */
const GRAPH = process.env.META_GRAPH_BASE || 'https://graph.facebook.com/v21.0';
export type CapiEventName = 'PageView' | 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase' | 'Search' | 'Contact';
export type CapiUser = { phone?: string | null; email?: string | null; name?: string | null; city?: string | null; governorate?: string | null; externalId?: string | null; ip?: string | null; userAgent?: string | null; fbp?: string | null; fbc?: string | null };
export type CapiEvent = { name: CapiEventName; eventId: string; url?: string; user: CapiUser; custom?: Record<string, unknown>; time?: Date };

const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const clean = (v?: string | null) => (v ?? '').trim().toLowerCase();
/** Iraqi mobile → 9647XXXXXXXXX (Meta wants country code, digits only). */
export function normalizePhone(raw?: string | null) {
  let d = (raw ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 11) d = `964${d.slice(1)}`;
  if (d.length === 10 && d.startsWith('7')) d = `964${d}`;
  return d.length >= 10 ? d : '';
}
function userData(u: CapiUser) {
  const parts = clean(u.name).split(/\s+/).filter(Boolean);
  const out: Record<string, unknown> = { country: [sha('iq')] };
  const phone = normalizePhone(u.phone); if (phone) out.ph = [sha(phone)];
  const email = clean(u.email); if (email && email.includes('@')) out.em = [sha(email)];
  if (parts[0]) out.fn = [sha(parts[0])];
  if (parts.length > 1) out.ln = [sha(parts[parts.length - 1])];
  const city = clean(u.city || u.governorate).replace(/[^a-z؀-ۿ]/g, ''); if (city) out.ct = [sha(city)];
  if (u.externalId) out.external_id = [sha(clean(u.externalId))];
  if (u.ip) out.client_ip_address = u.ip;
  if (u.userAgent) out.client_user_agent = u.userAgent;
  if (u.fbp) out.fbp = u.fbp;
  if (u.fbc) out.fbc = u.fbc;
  return out;
}

export async function sendCapi(events: CapiEvent[], opts: { testCode?: string } = {}) {
  const { tracking } = await getIntegrations();
  const pixel = tracking.metaPixelId, token = tracking.metaCapiToken;
  if (!pixel || !token || !events.length) return { ok: false, skipped: true as const, error: 'Conversions API is not set up.' };
  const body: Record<string, unknown> = {
    data: events.map(e => ({ event_name: e.name, event_time: Math.floor((e.time ?? new Date()).getTime() / 1000), event_id: e.eventId, action_source: 'website', event_source_url: e.url, user_data: userData(e.user), custom_data: e.custom ?? {} })),
  };
  const testCode = opts.testCode ?? tracking.metaTestCode;
  if (testCode) body.test_event_code = testCode;
  try {
    const r = await fetch(`${GRAPH}/${pixel}/events?access_token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
    const data = await r.json().catch(() => ({})) as { events_received?: number; error?: { message?: string } };
    if (!r.ok) return { ok: false, error: data.error?.message || `HTTP ${r.status}` };
    return { ok: true, received: data.events_received ?? 0 };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'network error' }; }
}

/** Request details Meta uses to match the browser and the server event. */
export function requestUser(headers: Headers, cookies: { get(name: string): { value: string } | undefined }): CapiUser {
  const ip = (headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || headers.get('x-real-ip') || null;
  return { ip, userAgent: headers.get('user-agent'), fbp: cookies.get('_fbp')?.value ?? null, fbc: cookies.get('_fbc')?.value ?? null };
}
