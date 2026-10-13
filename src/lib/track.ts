/**
 * Storefront analytics events, sent to whichever tags are installed (Meta Pixel, Google
 * Analytics 4). Microsoft Clarity records sessions on its own. Every call is a no-op when a tag
 * isn't configured or is blocked. Money is in IQD.
 */
type Item = { id: string; name: string; price: number; quantity?: number; variant?: string; category?: string };
type Win = Window & { fbq?: (...args: unknown[]) => void; gtag?: (...args: unknown[]) => void };
const CURRENCY = 'IQD';
const w = () => (typeof window === 'undefined' ? null : window as Win);
const ga4Items = (items: Item[]) => items.map(i => ({ item_id: i.id, item_name: i.name, item_variant: i.variant, item_category: i.category, price: i.price, quantity: i.quantity ?? 1 }));
const value = (items: Item[]) => items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);
function send(fb: [string, Record<string, unknown>, Record<string, unknown>?] | null, ga: [string, Record<string, unknown>] | null) {
  const win = w(); if (!win) return;
  try { if (fb && win.fbq) win.fbq('track', fb[0], fb[1], fb[2]); } catch { /* blocked */ }
  try { if (ga && win.gtag) win.gtag('event', ga[0], ga[1]); } catch { /* blocked */ }
}
export const track = {
  viewItem(item: Item) {
    send(['ViewContent', { content_ids: [item.id], content_name: item.name, content_type: 'product', value: item.price, currency: CURRENCY }], ['view_item', { currency: CURRENCY, value: item.price, items: ga4Items([item]) }]);
  },
  addToCart(item: Item) {
    send(['AddToCart', { content_ids: [item.id], content_name: item.name, content_type: 'product', value: item.price * (item.quantity ?? 1), currency: CURRENCY }], ['add_to_cart', { currency: CURRENCY, value: item.price * (item.quantity ?? 1), items: ga4Items([item]) }]);
  },
  beginCheckout(items: Item[]) {
    send(['InitiateCheckout', { content_ids: items.map(i => i.id), num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0), value: value(items), currency: CURRENCY }], ['begin_checkout', { currency: CURRENCY, value: value(items), items: ga4Items(items) }]);
  },
  /** `reference` is the order number: Meta uses it to de-duplicate, GA4 as the transaction id. */
  purchase(reference: string, total: number, items: Item[], extra: { shipping?: number; coupon?: string } = {}) {
    send(['Purchase', { content_ids: items.map(i => i.id), content_type: 'product', num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0), value: total, currency: CURRENCY }, { eventID: reference }], ['purchase', { transaction_id: reference, currency: CURRENCY, value: total, shipping: extra.shipping ?? 0, coupon: extra.coupon || undefined, items: ga4Items(items) }]);
  },
  search(query: string) { send(['Search', { search_string: query }], ['search', { search_term: query }]); },
  contact(channel: string) { send(['Contact', { channel }], ['contact', { method: channel }]); },
};
