import { randomBytes, randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { orderEvents, orders, payments } from '@/db/schema';
import { broadcast } from '../notify';
import { getSettings } from '../settings';
import { gatewayReady, getPaymentSettings, type PaymentProvider } from './config';
import { checkWithProvider, FINAL, GatewayError, startWithProvider, type PayStatus } from './providers';

export type PaymentRow = typeof payments.$inferSelect;

/** Display name of a provider. */
export function providerName(provider: string, lang: 'ar' | 'en' = 'en') {
  if (provider === 'fib') return 'FIB';
  if (provider === 'alqaseh') return lang === 'ar' ? 'القاصة (بطاقة)' : 'Al Qaseh (card)';
  return lang === 'ar' ? 'زين كاش' : 'ZainCash';
}

function siteBase(origin: string, canonical?: string) { return (canonical || origin).replace(/\/+$/, ''); }

/**
 * Opens a payment attempt for an order with the configured provider. Returns the public token
 * for the pay page, or null when the gateway is off. Throws GatewayError when the provider refuses.
 */
export async function startPayment(orderId: number, origin: string, language: 'ar' | 'en' = 'ar') {
  const config = await getPaymentSettings();
  if (!gatewayReady(config)) return null;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new Error('Order not found');
  if (order.paymentStatus === 'paid') throw new GatewayError('This order is already paid.');
  const settings = await getSettings();
  const base = siteBase(origin, settings.canonicalBaseUrl);
  const token = randomBytes(16).toString('hex');
  // ZainCash wants a UUID; Al Qaseh's order_id column holds at most 32 characters.
  const externalRef = config.provider === 'alqaseh' ? randomUUID().replace(/-/g, '') : randomUUID();
  const provider: PaymentProvider = config.provider;
  const [row] = await db.insert(payments).values({ orderId, token, provider, mode: config.mode, amountIqd: order.totalCents, externalRef }).returning();
  try {
    const result = await startWithProvider(provider, config, {
      orderReference: order.reference, amountIqd: order.totalCents, externalRef, language,
      phone: order.phone ? `964${order.phone.replace(/^0/, '')}` : undefined,
      returnUrl: provider === 'alqaseh' ? `${base}/api/payments/alqaseh/return?p=${token}` : `${base}/api/payments/zaincash/return?p=${token}`,
      callbackUrl: provider === 'alqaseh' ? `${base}/api/payments/alqaseh/webhook` : `${base}/api/payments/fib/callback`,
    });
    await db.update(payments).set({ providerRef: result.providerRef || null, redirectUrl: result.redirectUrl, details: result.details, updatedAt: new Date() }).where(eq(payments.id, row.id));
    await db.insert(orderEvents).values({ orderId, type: 'payment', message: `Electronic payment opened · ${providerName(provider)}${config.mode === 'test' ? ' (test)' : ''}` });
    return { token, redirectUrl: result.redirectUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gateway error';
    await db.update(payments).set({ status: 'failed', error: message.slice(0, 500), updatedAt: new Date() }).where(eq(payments.id, row.id));
    console.error('Payment start failed', message);
    throw error instanceof GatewayError ? error : new GatewayError(message);
  }
}

export async function getPaymentByToken(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const [row] = await db.select().from(payments).where(eq(payments.token, token));
  return row ?? null;
}
export async function findPayment(provider: PaymentProvider, by: { providerRef?: string; externalRef?: string }) {
  if (by.providerRef) {
    const [row] = await db.select().from(payments).where(and(eq(payments.provider, provider), eq(payments.providerRef, by.providerRef)));
    if (row) return row;
  }
  if (by.externalRef) {
    const [row] = await db.select().from(payments).where(and(eq(payments.provider, provider), eq(payments.externalRef, by.externalRef)));
    if (row) return row;
  }
  return null;
}

/** Records a new status on a payment and, when it becomes paid, on its order (once). */
export async function applyStatus(payment: PaymentRow, status: PayStatus, raw?: unknown, origin?: string) {
  if (payment.status === status) return payment;
  // A final status never goes back to pending; paid can only move on to refunded.
  if (FINAL.includes(payment.status as PayStatus) && !(payment.status === 'paid' && status === 'refunded')) return payment;
  const now = new Date();
  const details = { ...(payment.details as Record<string, unknown>), ...(raw ? { last: raw } : {}) };
  const [updated] = await db.update(payments).set({ status, details, updatedAt: now, ...(status === 'paid' ? { paidAt: now } : {}) })
    .where(and(eq(payments.id, payment.id), eq(payments.status, payment.status))).returning();
  if (!updated) return payment; // another request got there first
  if (status === 'paid') {
    const [order] = await db.update(orders).set({ paymentStatus: 'paid', paymentMethod: 'electronic', paidCents: payment.amountIqd, updatedAt: now }).where(eq(orders.id, payment.orderId)).returning();
    await db.insert(orderEvents).values({ orderId: payment.orderId, type: 'payment', message: `Paid electronically · ${providerName(payment.provider)} · ${payment.amountIqd.toLocaleString('en-US')} IQD` });
    if (order) {
      const settings = await getSettings();
      const base = siteBase(origin ?? '', settings.canonicalBaseUrl);
      await broadcast([
        `💳 <b>تم الدفع إلكترونياً — ${order.reference}</b>`,
        `${providerName(payment.provider, 'ar')}${payment.mode === 'test' ? ' (تجريبي)' : ''} · ${payment.amountIqd.toLocaleString('en-US')} د.ع`,
        `👤 ${order.name} · ${order.phone}`,
        base ? `${base}/admin/orders/${order.id}` : '',
      ].filter(Boolean).join('\n')).catch(() => {});
    }
  } else if (status === 'refunded') {
    await db.update(orders).set({ paymentStatus: 'refunded', updatedAt: now }).where(eq(orders.id, payment.orderId));
    await db.insert(orderEvents).values({ orderId: payment.orderId, type: 'payment', message: 'Electronic payment refunded' });
  } else if (status !== 'pending') {
    await db.insert(orderEvents).values({ orderId: payment.orderId, type: 'payment', message: `Electronic payment ${status}` });
  }
  return updated;
}

/** Asks the provider for the current status of an open payment and records it. */
export async function syncPayment(payment: PaymentRow, origin?: string) {
  if (!payment.providerRef || FINAL.includes(payment.status as PayStatus)) return payment;
  const config = await getPaymentSettings();
  // Al Qaseh reports status by its request token (kept in details), the others by their payment id.
  const ref = payment.provider === 'alqaseh' ? String((payment.details as Record<string, unknown>)?.token || payment.providerRef) : payment.providerRef;
  const { status, raw } = await checkWithProvider(payment.provider as PaymentProvider, config, ref, payment.amountIqd);
  return applyStatus(payment, status, raw, origin);
}

export async function latestPaymentForOrder(orderId: number) {
  const [row] = await db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.id)).limit(1);
  return row ?? null;
}

/** What the pay page and its polling endpoint may show to the shopper. */
export async function publicPayment(payment: PaymentRow) {
  const [order] = await db.select({ reference: orders.reference, total: orders.totalCents, paymentStatus: orders.paymentStatus }).from(orders).where(eq(orders.id, payment.orderId));
  const d = (payment.details ?? {}) as Record<string, string>;
  return {
    token: payment.token,
    provider: payment.provider as PaymentProvider,
    test: payment.mode === 'test',
    status: (order?.paymentStatus === 'paid' ? 'paid' : payment.status) as PayStatus,
    amount: payment.amountIqd,
    reference: order?.reference ?? '',
    redirectUrl: payment.status === 'pending' ? payment.redirectUrl : null,
    fib: payment.provider === 'fib' && payment.status === 'pending' ? { qrCode: d.qrCode || '', readableCode: d.readableCode || '', personalAppLink: d.personalAppLink || '', businessAppLink: d.businessAppLink || '', validUntil: d.validUntil || '' } : null,
  };
}
export type PublicPayment = Awaited<ReturnType<typeof publicPayment>>;
