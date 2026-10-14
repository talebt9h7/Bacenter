import { after, NextRequest, NextResponse } from 'next/server';
import { requestUser, sendCapi, type CapiEventName } from '@/lib/meta-capi';

export const dynamic = 'force-dynamic';
const ALLOWED: CapiEventName[] = ['ViewContent', 'AddToCart', 'InitiateCheckout', 'Search', 'Contact'];
const str = (v: unknown, max: number) => typeof v === 'string' ? v.slice(0, max) : undefined;
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e10 ? v : undefined;

/** Browser events mirrored to the Meta Conversions API (Purchase is sent by the checkout itself). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { name?: string; eventId?: string; url?: string; custom?: Record<string, unknown> } | null;
  if (!body || !ALLOWED.includes(body.name as CapiEventName) || !/^[A-Za-z0-9_.:-]{8,64}$/.test(body.eventId ?? '')) return NextResponse.json({ ok: false }, { status: 400 });
  const c = body.custom ?? {};
  const custom = {
    currency: 'IQD', value: num(c.value), content_type: str(c.content_type, 20), content_name: str(c.content_name, 120), num_items: num(c.num_items),
    content_ids: Array.isArray(c.content_ids) ? c.content_ids.filter(x => typeof x === 'string').slice(0, 20).map(x => (x as string).slice(0, 60)) : undefined,
    search_string: str(c.search_string, 100),
  };
  const origin = request.nextUrl.origin;
  const url = str(body.url, 500);
  const user = requestUser(request.headers, request.cookies);
  after(() => sendCapi([{ name: body.name as CapiEventName, eventId: body.eventId!, url: url?.startsWith(origin) ? url : origin, user, custom }]).then(() => undefined));
  return NextResponse.json({ ok: true });
}
