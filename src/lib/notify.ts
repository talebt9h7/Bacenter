import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { orders, productVariants, shippingZones } from '@/db/schema';
import { getIntegrations, type Integrations } from './integrations';
import { getSettings } from './settings';
import { reservedByVariant } from './reservations';

/**
 * Free notification channels:
 * - Telegram: a bot made with @BotFather; messages go to each saved chat ID.
 * - WhatsApp: CallMeBot (free, personal use) — the owner registers their number once and gets an API key.
 * Sending never throws: a failed notification must not affect the order.
 */
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = (html: string) => html.replace(/<b>(.*?)<\/b>/g, '*$1*').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
// Overridable only so automated tests can capture messages locally.
const TELEGRAM_API = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';
const money = (n: number) => `${new Intl.NumberFormat('en-US').format(Math.round(n))} د.ع`;

export async function sendTelegram(config: Integrations['telegram'], html: string) {
  if (!config.botToken || !config.chatIds.length) return { ok: false, error: 'Telegram is not set up.' };
  const results = await Promise.all(config.chatIds.map(async chatId => {
    try {
      const r = await fetch(`${TELEGRAM_API}/bot${config.botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true }), signal: AbortSignal.timeout(8000) });
      const data = await r.json().catch(() => ({}));
      return data.ok ? null : String(data.description || r.status);
    } catch (error) { return error instanceof Error ? error.message : 'network error'; }
  }));
  const errors = results.filter(Boolean);
  return errors.length ? { ok: false, error: errors.join('; ') } : { ok: true };
}

export async function sendWhatsApp(config: Integrations['whatsapp'], html: string) {
  if (!config.phone || !config.apiKey) return { ok: false, error: 'WhatsApp is not set up.' };
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(config.phone)}&text=${encodeURIComponent(plain(html))}&apikey=${encodeURIComponent(config.apiKey)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const body = await r.text();
    return r.ok && !/error|invalid/i.test(body.slice(0, 300)) ? { ok: true } : { ok: false, error: body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) || String(r.status) };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'network error' }; }
}

/** Sends to every enabled channel. */
export async function broadcast(html: string, integrations?: Integrations) {
  const config = integrations ?? await getIntegrations();
  const jobs: Promise<{ ok: boolean; error?: string }>[] = [];
  if (config.telegram.enabled) jobs.push(sendTelegram(config.telegram, html));
  if (config.whatsapp.enabled) jobs.push(sendWhatsApp(config.whatsapp, html));
  const results = await Promise.all(jobs);
  for (const r of results) if (!r.ok) console.error('Notification failed:', r.error);
  return results;
}

/** New-order alert: customer, address, items, totals, a link to the order, and stock running low. */
export async function notifyNewOrder(orderId: number, origin: string) {
  try {
    const config = await getIntegrations();
    if (!config.notify.newOrder || (!config.telegram.enabled && !config.whatsapp.enabled)) return;
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) return;
    const [zone] = await db.select({ nameAr: shippingZones.nameAr }).from(shippingZones).where(eq(shippingZones.code, order.governorate));
    const items = (Array.isArray(order.items) ? order.items : []) as { productId?: string; variantId: number; name: string; color: string; quantity: number; unitPrice?: number; listPrice?: number; promotionName?: string | null }[];
    const address = (order.address ?? {}) as { city?: string; line1?: string; landmark?: string; altPhone?: string };
    const settings = await getSettings();
    const base = (settings.canonicalBaseUrl || origin).replace(/\/$/, '');
    const lines = [
      `🛍️ <b>طلب جديد ${escape(order.reference)}</b>`,
      `👤 ${escape(order.name)}`,
      `📞 ${escape(order.phone)}${address.altPhone ? ` / ${escape(address.altPhone)}` : ''}`,
      `📍 ${escape(zone?.nameAr ?? order.governorate)} — ${escape(address.city ?? '')}${address.line1 ? `، ${escape(address.line1)}` : ''}${address.landmark ? ` (${escape(address.landmark)})` : ''}`,
      '',
      ...items.flatMap(i => [`• ${i.quantity} × ${escape(i.name)} — ${escape(i.color)}  ${money((i.unitPrice ?? 0) * i.quantity)}${i.promotionName ? ` 🏷️ ${escape(i.promotionName)}` : ''}`, ...(i.productId ? [`   ${escape(`${base}/products/${encodeURIComponent(i.productId)}${i.color ? `?color=${encodeURIComponent(i.color)}` : ''}`)}`] : [])]),
      '',
      `المنتجات: ${money(order.subtotalCents)}${order.discountCents ? `  | خصم: −${money(order.discountCents)}${order.couponCode ? ` (${escape(order.couponCode)})` : ''}` : ''}`,
      `التوصيل: ${order.shippingCents ? money(order.shippingCents) : 'مجاني'}`,
      `💰 <b>المطلوب تحصيله: ${money(order.totalCents)}</b>`,
      order.customerNote ? `📝 ${escape(order.customerNote)}` : '',
      `🔗 ${base}/admin/orders/${order.id}`,
    ];
    if (config.notify.lowStock) {
      const ids = [...new Set(items.map(i => i.variantId))];
      if (ids.length) {
        const [variants, reserved] = await Promise.all([db.select({ id: productVariants.id, stock: productVariants.stock }).from(productVariants).where(inArray(productVariants.id, ids)), reservedByVariant()]);
        const low = variants.map(v => ({ ...v, available: Math.max(0, v.stock - (reserved.get(v.id) ?? 0)), item: items.find(i => i.variantId === v.id)! })).filter(v => v.available <= (settings.lowStockThreshold || 5));
        if (low.length) lines.push('', '⚠️ <b>مخزون قليل</b>', ...low.map(v => `• ${escape(v.item.name)} — ${escape(v.item.color)}: باقي ${v.available}`));
      }
    }
    await broadcast(lines.filter((l, i, all) => l !== '' || (i > 0 && all[i - 1] !== '')).join('\n'), config);
  } catch (error) { console.error('New-order notification failed', error); }
}
