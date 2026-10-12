import { and, gte, lte, or, sql, type SQL } from 'drizzle-orm';
import { orders } from '@/db/schema';

/**
 * Reporting periods are calendar days in Iraq (Asia/Baghdad, UTC+3, no daylight saving).
 * The server runs in UTC, so "today" computed with plain Date methods would start at
 * 03:00 Baghdad time and push early-morning orders into the previous day.
 */
const BAGHDAD_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of the Baghdad calendar day containing `date`, as a UTC instant. */
function baghdadDayStart(date: Date) {
  const shifted = date.getTime() + BAGHDAD_OFFSET_MS;
  return new Date(Math.floor(shifted / DAY_MS) * DAY_MS - BAGHDAD_OFFSET_MS);
}

/** "YYYY-MM-DD" for the Baghdad calendar day of `date`. */
export function baghdadDayKey(date: Date | string) {
  return new Date(new Date(date).getTime() + BAGHDAD_OFFSET_MS).toISOString().slice(0, 10);
}

/** Parses "YYYY-MM-DD" as the start of that Baghdad day. */
function parseDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : new Date(date.getTime() - BAGHDAD_OFFSET_MS);
}

export function startOfBaghdadToday(now = new Date()) {
  return baghdadDayStart(now);
}

/**
 * Resolves a period key (today, 7d, 30d, 90d, year) or explicit from/to days into a
 * [from, to] range of UTC instants covering whole Baghdad days.
 */
export function reportRange(period?: string, fromDay?: string, toDay?: string, now = new Date()) {
  const todayStart = baghdadDayStart(now);
  const to = new Date((toDay && parseDay(toDay) ? parseDay(toDay)!.getTime() : todayStart.getTime()) + DAY_MS - 1);
  let from: Date;
  const explicitFrom = fromDay ? parseDay(fromDay) : null;
  if (explicitFrom) from = explicitFrom;
  else if (period === 'today') from = todayStart;
  else if (period === '7d') from = new Date(todayStart.getTime() - 6 * DAY_MS);
  else if (period === '90d') from = new Date(todayStart.getTime() - 89 * DAY_MS);
  else if (period === 'year') from = parseDay(`${baghdadDayKey(now).slice(0, 4)}-01-01`)!;
  else from = new Date(todayStart.getTime() - 29 * DAY_MS);
  return { from, to };
}

/**
 * Revenue and profit are recognised when an order is delivered, so financial reports
 * place an order on its delivery date, not the day it was placed. Orders delivered
 * before delivery dates were recorded fall back to their last update time.
 */
export function recognizedAt(order: { deliveredAt?: Date | string | null; updatedAt: Date | string }) {
  return new Date(order.deliveredAt ?? order.updatedAt);
}

export function isRecognizedIn(order: { status: string; deliveredAt?: Date | string | null; updatedAt: Date | string }, from: Date, to: Date) {
  if (order.status !== 'delivered') return false;
  const at = recognizedAt(order).getTime();
  return at >= from.getTime() && at <= to.getTime();
}

/** Orders placed in the range, or delivered in it. Filter with isRecognizedIn for financial totals. */
export function ordersTouchingRange(from: Date, to: Date): SQL {
  return or(
    and(gte(orders.createdAt, from), lte(orders.createdAt, to)),
    // Raw expressions don't go through Drizzle's column mapping, so pass the bounds the
    // way Drizzle stores timestamps (ISO, UTC) to avoid any session time-zone conversion.
    sql`${orders.status} = 'delivered' and coalesce(${orders.deliveredAt}, ${orders.updatedAt}) between ${from.toISOString()}::timestamp and ${to.toISOString()}::timestamp`,
  )!;
}

export function isPlacedIn(order: { createdAt: Date | string }, from: Date, to: Date) {
  const at = new Date(order.createdAt).getTime();
  return at >= from.getTime() && at <= to.getTime();
}
