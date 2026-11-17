/**
 * Accounts rules shared by the server and the admin screens (no database access here).
 *
 * Every order has two separate facts:
 *  - fulfillment: 'courier' (a delivery company carries it) or 'pickup' (handed over in the shop);
 *  - paymentMethod: 'cod' (customer pays the delivery company), 'cash' (paid in the shop),
 *    'bank_transfer' (MasterCard transfer) or 'electronic' (Al Qaseh on the website).
 *
 * Where the money is:
 *  - cash                → the cash box, when the order is handed over;
 *  - bank_transfer       → the Master account, when the owner confirms the transfer arrived;
 *  - electronic          → the Al Qaseh account, minus its commission, when the payment succeeds;
 *  - cod (via courier)   → owed by the delivery company from delivery until a settlement
 *                          (statement) moves it into the cash box or the Master account.
 *  - The delivery company's fee on every order it carried (delivered, or its return fee when
 *    returned) is taken out of what it owes, whatever the payment method.
 */

export const MONEY_ACCOUNTS = ['cash', 'master', 'qaseh'] as const;
export type MoneyAccount = typeof MONEY_ACCOUNTS[number];
export const accountNames: Record<MoneyAccount, string> = { cash: 'الصندوق (نقد)', master: 'حساب الماستر', qaseh: 'حساب القاصة' };
export const isMoneyAccount = (value: unknown): value is MoneyAccount => typeof value === 'string' && (MONEY_ACCOUNTS as readonly string[]).includes(value);

export const FULFILLMENTS = ['courier', 'pickup'] as const;
export type Fulfillment = typeof FULFILLMENTS[number];
export const fulfillmentNames: Record<Fulfillment, string> = { courier: 'توصيل', pickup: 'من المحل' };

export const PAYMENT_METHODS = ['cod', 'cash', 'bank_transfer', 'electronic'] as const;
export const paymentMethodNames: Record<string, string> = { cod: 'الدفع عند الاستلام', cash: 'نقد', bank_transfer: 'تحويل ماستر', electronic: 'دفع إلكتروني', credit: 'آجل (جملة)' };

/** Payment methods that make sense for each way of handing the order over. */
export const methodsFor: Record<Fulfillment, string[]> = { courier: ['cod', 'bank_transfer', 'electronic'], pickup: ['cash', 'bank_transfer', 'electronic'] };
export const methodAllowed = (fulfillment: string, method: string) => (methodsFor[fulfillment as Fulfillment] ?? methodsFor.courier).includes(method);

/** The account a directly paid order's money goes to (cod has none: it goes through the courier). */
export function accountForMethod(method: string): MoneyAccount | null {
  if (method === 'cash') return 'cash';
  if (method === 'bank_transfer') return 'master';
  if (method === 'electronic') return 'qaseh';
  return null;
}

export type CourierRates = Record<string, number>;
export type CourierLike = { id: number; name: string; defaultFeeIqd: number; returnFeeIqd: number; rates: unknown; active?: boolean };
export function courierFee(courier: CourierLike | null | undefined, governorate: string) {
  if (!courier) return null;
  const rates = (courier.rates && typeof courier.rates === 'object' ? courier.rates : {}) as CourierRates;
  const own = Number(rates[governorate]);
  return Number.isFinite(own) && own >= 0 && rates[governorate] !== undefined ? own : courier.defaultFeeIqd;
}

export const gatewayFee = (amount: number, percent: number) => Math.max(0, Math.round(amount * Math.max(0, percent) / 100));

export type MoneyOrderLike = { source?: string | null; status: string; paymentMethod: string; paymentStatus: string; fulfillment?: string | null; courierId?: number | null; courierFeeIqd?: number | null; settlementId?: number | null; paidTo?: string | null; totalCents: number; gatewayFeeIqd?: number | null };

const isCourierOrder = (o: MoneyOrderLike) => (o.fulfillment ?? 'courier') === 'courier';
/** A cash-on-delivery order marked paid before accounts existed, with no settlement behind it. */
export const isLegacyCodPaid = (o: MoneyOrderLike) => o.source !== 'wholesale' && o.paymentMethod === 'cod' && o.paymentStatus === 'paid' && !o.settlementId;

/** What the delivery company collected from the customer for this order. */
export function courierCollected(o: MoneyOrderLike) {
  if (o.source === 'wholesale' || !isCourierOrder(o) || o.paymentMethod !== 'cod' || o.status !== 'delivered' || isLegacyCodPaid(o)) return 0;
  return o.totalCents;
}
/** What the delivery company charges for this order (counted once it is delivered or returned). */
export function courierCharge(o: MoneyOrderLike) {
  if (o.source === 'wholesale' || !isCourierOrder(o) || !o.courierId || isLegacyCodPaid(o)) return 0;
  return o.status === 'delivered' || o.status === 'returned' ? Math.max(0, o.courierFeeIqd ?? 0) : 0;
}
/** Net the delivery company owes for this order when it is settled (can be negative: only a fee). */
export const courierNet = (o: MoneyOrderLike) => courierCollected(o) - courierCharge(o);
/** Orders that belong on the delivery company's next statement. */
export const awaitsSettlement = (o: MoneyOrderLike) => o.source !== 'wholesale' && isCourierOrder(o) && !!o.courierId && !o.settlementId && (o.status === 'delivered' || o.status === 'returned');

export type MoneyState = 'received' | 'at_courier' | 'waiting' | 'unreceived' | 'refunded' | 'review';
export const moneyStateNames: Record<MoneyState, string> = { received: 'مستلم', at_courier: 'عند شركة التوصيل', waiting: 'بانتظار التحويل', unreceived: 'غير مستلم', refunded: 'مسترجع', review: 'يحتاج مراجعة' };
export const moneyStateTone: Record<MoneyState, string> = { received: 'ok', at_courier: 'warn', waiting: 'warn', unreceived: 'muted', refunded: 'muted', review: 'danger' };

export function moneyState(o: MoneyOrderLike): MoneyState {
  if (o.paymentStatus === 'refunded') return 'refunded';
  if (isLegacyCodPaid(o)) return 'review';
  if (o.paymentStatus === 'paid') return 'received';
  if (o.paymentMethod === 'cod' && isCourierOrder(o) && o.status === 'delivered') return 'at_courier';
  if ((o.paymentMethod === 'bank_transfer' || o.paymentMethod === 'electronic') && o.status !== 'cancelled' && o.status !== 'returned') return 'waiting';
  return 'unreceived';
}

export const movementKinds: Record<string, string> = { opening: 'رصيد افتتاحي', transfer: 'تحويل بين الحسابات', withdrawal: 'سحب (شريك / شخصي)', deposit: 'إيداع / رأس مال', adjustment: 'تسوية فرق' };
