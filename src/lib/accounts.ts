import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { courierSettlements, couriers, expenses, moneyMovements, orders, settings, wholesalePayments } from '@/db/schema';
import { clearMemo } from './memo-cache';
import { accountNames, awaitsSettlement, courierCharge, courierCollected, isLegacyCodPaid, isMoneyAccount, movementKinds, type MoneyAccount } from './accounts-rules';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------- settings ----------
export type AccountsSettings = { qasehFeePercent: number; defaultCourierId: number | null };
const KEY = 'accounts';
export const defaultAccountsSettings: AccountsSettings = { qasehFeePercent: 1, defaultCourierId: null };
export function normalizeAccountsSettings(value: unknown): AccountsSettings {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<AccountsSettings>;
  const pct = Number(v.qasehFeePercent);
  const courier = Number(v.defaultCourierId);
  return { qasehFeePercent: Number.isFinite(pct) ? Math.min(20, Math.max(0, Math.round(pct * 100) / 100)) : 1, defaultCourierId: Number.isInteger(courier) && courier > 0 ? courier : null };
}
export async function getAccountsSettings(executor: Tx | typeof db = db): Promise<AccountsSettings> {
  try { const [row] = await executor.select().from(settings).where(eq(settings.key, KEY)); return normalizeAccountsSettings(row?.value); }
  catch { return defaultAccountsSettings; }
}
export async function saveAccountsSettings(next: Partial<AccountsSettings>) {
  const value = normalizeAccountsSettings({ ...(await getAccountsSettings()), ...next });
  await db.insert(settings).values({ key: KEY, value, updatedAt: new Date() }).onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  return value;
}

// ---------- couriers ----------
export type CourierRow = typeof couriers.$inferSelect;
export const listCouriers = (executor: Tx | typeof db = db) => executor.select().from(couriers).orderBy(desc(couriers.active), asc(couriers.id));

/** The delivery company used when an order has none: the chosen default, else the only active one. */
export async function defaultCourier(executor: Tx | typeof db = db) {
  const [list, cfg] = await Promise.all([listCouriers(executor), getAccountsSettings(executor)]);
  const active = list.filter(c => c.active);
  return active.find(c => c.id === cfg.defaultCourierId) ?? (active.length === 1 ? active[0] : null);
}

// ---------- ledger ----------
/** Account keys: the three money accounts, and one per delivery company ("courier:<id>"). */
export type LedgerAccount = MoneyAccount | `courier:${number}`;
export type LedgerEntry = { at: string; account: LedgerAccount; amount: number; kind: string; label: string; orderId?: number; reference?: string; settlementId?: number; movementId?: number; expenseId?: number };

const expenseAccount = (row: { account: string | null; paymentMethod: string }): MoneyAccount => isMoneyAccount(row.account) ? row.account : row.paymentMethod === 'cash' ? 'cash' : 'master';

/**
 * Every money movement, rebuilt from the orders, settlements, expenses, wholesale payments and
 * manual movements. Nothing is copied into a separate journal, so editing an order always
 * corrects the accounts too.
 */
export async function loadLedger() {
  const [orderRows, settlementRows, movementRows, expenseRows, wholesaleRows, courierRows] = await Promise.all([
    db.select({ id: orders.id, reference: orders.reference, name: orders.name, source: orders.source, status: orders.status, paymentMethod: orders.paymentMethod, paymentStatus: orders.paymentStatus, fulfillment: orders.fulfillment, courierId: orders.courierId, courierFeeIqd: orders.courierFeeIqd, settlementId: orders.settlementId, paidTo: orders.paidTo, paidAt: orders.paidAt, totalCents: orders.totalCents, gatewayFeeIqd: orders.gatewayFeeIqd, deliveredAt: orders.deliveredAt, updatedAt: orders.updatedAt, createdAt: orders.createdAt, governorate: orders.governorate, shippingCents: orders.shippingCents }).from(orders).where(ne(orders.source, 'wholesale')),
    db.select().from(courierSettlements),
    db.select().from(moneyMovements),
    db.select({ id: expenses.id, amountIqd: expenses.amountIqd, expenseDate: expenses.expenseDate, description: expenses.description, account: expenses.account, paymentMethod: expenses.paymentMethod }).from(expenses),
    db.select({ id: wholesalePayments.id, orderId: wholesalePayments.orderId, amountIqd: wholesalePayments.amountIqd, account: wholesalePayments.account, createdAt: wholesalePayments.createdAt, reference: orders.reference, name: orders.name }).from(wholesalePayments).innerJoin(orders, eq(orders.id, wholesalePayments.orderId)),
    listCouriers(),
  ]);
  const courierName = new Map(courierRows.map(c => [c.id, c.name]));
  const entries: LedgerEntry[] = [];
  const iso = (d: Date | null | undefined, fallback: Date) => (d ?? fallback).toISOString();
  for (const o of orderRows) {
    // Paid directly (cash, Master transfer, Al Qaseh): the money is in that account.
    if (o.paymentMethod !== 'cod' && o.paymentStatus === 'paid' && isMoneyAccount(o.paidTo)) {
      const at = iso(o.paidAt, o.updatedAt);
      entries.push({ at, account: o.paidTo, amount: o.totalCents, kind: 'order', label: `طلب ${o.reference} · ${o.name}`, orderId: o.id, reference: o.reference });
      if (o.gatewayFeeIqd > 0) entries.push({ at, account: o.paidTo, amount: -o.gatewayFeeIqd, kind: 'gateway_fee', label: `عمولة القاصة · ${o.reference}`, orderId: o.id, reference: o.reference });
    }
    if (!o.courierId) continue;
    const account = `courier:${o.courierId}` as const;
    const at = iso(o.deliveredAt, o.updatedAt);
    const collected = courierCollected(o), fee = courierCharge(o);
    if (collected) entries.push({ at, account, amount: collected, kind: 'collected', label: `استلمت من الزبون · ${o.reference}`, orderId: o.id, reference: o.reference });
    if (fee) entries.push({ at, account, amount: -fee, kind: 'courier_fee', label: `${o.status === 'returned' ? 'أجور إرجاع' : 'أجور توصيل'} · ${o.reference}`, orderId: o.id, reference: o.reference });
  }
  for (const s of settlementRows) {
    const at = s.settledAt.toISOString(), name = courierName.get(s.courierId) ?? 'شركة التوصيل';
    entries.push({ at, account: `courier:${s.courierId}`, amount: -s.receivedIqd, kind: 'settlement', label: `استلام كشف رقم ${s.id}`, settlementId: s.id });
    if (isMoneyAccount(s.account)) entries.push({ at, account: s.account, amount: s.receivedIqd, kind: 'settlement', label: `استلام من ${name} · كشف ${s.id}`, settlementId: s.id });
  }
  for (const m of movementRows) {
    const at = m.movedAt.toISOString(), label = `${movementKinds[m.kind] ?? m.kind}${m.note ? ` · ${m.note}` : ''}`;
    if (m.fromAccount && validAccount(m.fromAccount)) entries.push({ at, account: m.fromAccount as LedgerAccount, amount: -m.amountIqd, kind: m.kind, label, movementId: m.id });
    if (m.toAccount && validAccount(m.toAccount)) entries.push({ at, account: m.toAccount as LedgerAccount, amount: m.amountIqd, kind: m.kind, label, movementId: m.id });
  }
  for (const e of expenseRows) entries.push({ at: e.expenseDate.toISOString(), account: expenseAccount(e), amount: -e.amountIqd, kind: 'expense', label: `مصروف · ${e.description}`, expenseId: e.id });
  for (const w of wholesaleRows) if (isMoneyAccount(w.account)) entries.push({ at: w.createdAt.toISOString(), account: w.account, amount: w.amountIqd, kind: 'wholesale', label: `دفعة جملة · ${w.reference} · ${w.name}`, orderId: w.orderId, reference: w.reference });
  entries.sort((a, b) => b.at.localeCompare(a.at));
  return { entries, orders: orderRows, couriers: courierRows, settlements: settlementRows };
}

export function validAccount(value: string): value is LedgerAccount {
  return isMoneyAccount(value) || /^courier:\d+$/.test(value);
}

export function accountLabel(account: string, courierNames: Map<number, string>) {
  if (isMoneyAccount(account)) return accountNames[account];
  const id = Number(account.split(':')[1]);
  return courierNames.get(id) ?? 'شركة توصيل';
}

/** Current balance of every account, plus what needs the owner's attention. */
export async function loadAccountsOverview() {
  const { entries, orders: orderRows, couriers: courierRows, settlements } = await loadLedger();
  const balance = (account: string) => entries.filter(e => e.account === account).reduce((s, e) => s + e.amount, 0);
  const money = (['cash', 'master', 'qaseh'] as const).map(account => ({ account, name: accountNames[account], balance: balance(account) }));
  const courierBalances = courierRows.map(c => {
    const pending = orderRows.filter(o => o.courierId === c.id && awaitsSettlement(o));
    return { id: c.id, name: c.name, active: c.active, balance: balance(`courier:${c.id}`), pendingOrders: pending.length, pendingNet: pending.reduce((s, o) => s + courierCollected(o) - courierCharge(o), 0), lastSettlement: settlements.filter(s => s.courierId === c.id).sort((a, b) => b.settledAt.getTime() - a.settledAt.getTime())[0]?.settledAt.toISOString() ?? null };
  });
  const review = {
    legacyCod: orderRows.filter(isLegacyCodPaid).map(o => ({ id: o.id, reference: o.reference, name: o.name, total: o.totalCents })),
    noCourier: orderRows.filter(o => o.fulfillment === 'courier' && !o.courierId && (o.status === 'delivered' || o.status === 'returned')).map(o => ({ id: o.id, reference: o.reference, name: o.name, total: o.totalCents })),
    noFee: orderRows.filter(o => o.courierId && o.courierFeeIqd == null && (o.status === 'delivered' || o.status === 'returned')).map(o => ({ id: o.id, reference: o.reference, name: o.name, total: o.totalCents })),
    waiting: orderRows.filter(o => (o.paymentMethod === 'bank_transfer' || o.paymentMethod === 'electronic') && o.paymentStatus !== 'paid' && o.paymentStatus !== 'refunded' && o.status !== 'cancelled' && o.status !== 'returned').map(o => ({ id: o.id, reference: o.reference, name: o.name, total: o.totalCents, method: o.paymentMethod })),
  };
  const totalMoney = money.reduce((s, a) => s + a.balance, 0) + courierBalances.reduce((s, c) => s + c.balance, 0);
  return { money, couriers: courierBalances, review, totalMoney, recent: entries.slice(0, 12) };
}

// ---------- settlements ----------
export async function settlementCandidates(courierId: number) {
  const rows = await db.select().from(orders).where(and(eq(orders.courierId, courierId), isNull(orders.settlementId), ne(orders.source, 'wholesale'), inArray(orders.status, ['delivered', 'returned']))).orderBy(asc(orders.deliveredAt), asc(orders.id));
  const legacy = await db.select().from(orders).where(and(eq(orders.courierId, courierId), isNull(orders.settlementId), eq(orders.paymentMethod, 'cod'), eq(orders.paymentStatus, 'paid'), ne(orders.source, 'wholesale'))).orderBy(asc(orders.id));
  const seen = new Set<number>();
  return [...rows, ...legacy].filter(o => (seen.has(o.id) ? false : (seen.add(o.id), true))).map(o => {
    // A legacy paid COD order is settled as an ordinary delivered one.
    const asOrdinary = isLegacyCodPaid(o) ? { ...o, paymentStatus: 'unpaid' } : o;
    const collected = courierCollected(asOrdinary), fee = courierCharge(asOrdinary);
    return { id: o.id, reference: o.reference, name: o.name, governorate: o.governorate, status: o.status, paymentMethod: o.paymentMethod, deliveredAt: (o.deliveredAt ?? o.updatedAt).toISOString(), total: o.totalCents, collected, fee, feeMissing: o.courierFeeIqd == null, net: collected - fee, legacy: isLegacyCodPaid(o) };
  });
}

export class AccountsError extends Error {}

export async function createSettlement(input: { courierId: number; orderIds: number[]; receivedIqd: number; account: MoneyAccount; settledAt: Date; note?: string | null }) {
  clearMemo('stats:');
  return db.transaction(async tx => {
    const [courier] = await tx.select().from(couriers).where(eq(couriers.id, input.courierId));
    if (!courier) throw new AccountsError('شركة التوصيل غير موجودة.');
    if (!input.orderIds.length) throw new AccountsError('اختر طلب واحد على الأقل.');
    const rows = await tx.select().from(orders).where(and(inArray(orders.id, input.orderIds), eq(orders.courierId, input.courierId))).for('update');
    if (rows.length !== new Set(input.orderIds).size) throw new AccountsError('بعض الطلبات مو تابعة لهذه الشركة.');
    let expected = 0;
    for (const o of rows) {
      if (o.settlementId) throw new AccountsError(`الطلب ${o.reference} داخل بكشف سابق.`);
      const legacy = isLegacyCodPaid(o);
      if (!legacy && o.status !== 'delivered' && o.status !== 'returned') throw new AccountsError(`الطلب ${o.reference} بعده ما انسلم ولا رجع.`);
      const ordinary = legacy ? { ...o, paymentStatus: 'unpaid' } : o;
      expected += courierCollected(ordinary) - courierCharge(ordinary);
    }
    const [settlement] = await tx.insert(courierSettlements).values({ courierId: input.courierId, expectedIqd: expected, receivedIqd: input.receivedIqd, account: input.account, settledAt: input.settledAt, note: input.note || null }).returning();
    for (const o of rows) {
      const cod = o.paymentMethod === 'cod' && o.status === 'delivered';
      await tx.update(orders).set({ settlementId: settlement.id, ...(cod ? { paymentStatus: 'paid', paidTo: input.account, paidAt: input.settledAt } : {}), updatedAt: new Date() }).where(eq(orders.id, o.id));
    }
    return settlement;
  });
}

export async function deleteSettlement(id: number) {
  clearMemo('stats:');
  return db.transaction(async tx => {
    const [settlement] = await tx.select().from(courierSettlements).where(eq(courierSettlements.id, id)).for('update');
    if (!settlement) throw new AccountsError('الكشف غير موجود.');
    await tx.update(orders).set({ paymentStatus: 'unpaid', paidTo: null, paidAt: null, updatedAt: new Date() }).where(and(eq(orders.settlementId, id), eq(orders.paymentMethod, 'cod')));
    await tx.update(orders).set({ settlementId: null }).where(eq(orders.settlementId, id));
    await tx.delete(courierSettlements).where(eq(courierSettlements.id, id));
    return settlement;
  });
}

export async function settlementDetail(id: number) {
  const [settlement] = await db.select().from(courierSettlements).where(eq(courierSettlements.id, id));
  if (!settlement) return null;
  const rows = await db.select().from(orders).where(eq(orders.settlementId, id)).orderBy(asc(orders.id));
  const [courier] = await db.select().from(couriers).where(eq(couriers.id, settlement.courierId));
  return { settlement, courier, orders: rows.map(o => { const collected = courierCollected(o), fee = courierCharge(o); return { id: o.id, reference: o.reference, name: o.name, governorate: o.governorate, status: o.status, paymentMethod: o.paymentMethod, total: o.totalCents, collected, fee, net: collected - fee }; }) };
}

export async function listSettlements(limit = 50) {
  return db.select({ id: courierSettlements.id, courierId: courierSettlements.courierId, courierName: couriers.name, expectedIqd: courierSettlements.expectedIqd, receivedIqd: courierSettlements.receivedIqd, account: courierSettlements.account, settledAt: courierSettlements.settledAt, note: courierSettlements.note, orders: sql<number>`(select count(*) from ${orders} where ${orders.settlementId} = ${courierSettlements.id})`.mapWith(Number) })
    .from(courierSettlements).innerJoin(couriers, eq(couriers.id, courierSettlements.courierId)).orderBy(desc(courierSettlements.settledAt), desc(courierSettlements.id)).limit(limit);
}
