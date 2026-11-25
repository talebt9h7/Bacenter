import { createHmac, timingSafeEqual } from 'node:crypto';

/** Signed link for a shopper to open one order without typing their phone (sent from the confirmation page). */
function secret() {
  return process.env.ORDER_TRACK_SECRET || process.env.ADMIN_SESSION_SECRET || `${process.env.ADMIN_PASSWORD || 'ur'}::ur-order-track`;
}
export function trackToken(reference: string) {
  return createHmac('sha256', secret()).update(reference.toUpperCase()).digest('base64url').slice(0, 22);
}
export function verifyTrackToken(reference: string, token: string) {
  const want = Buffer.from(trackToken(reference)); const got = Buffer.from(token || '');
  return want.length === got.length && timingSafeEqual(want, got);
}
export const trackPath = (reference: string) => `/my-orders?ref=${encodeURIComponent(reference)}&t=${trackToken(reference)}`;
