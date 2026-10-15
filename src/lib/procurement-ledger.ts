import type { PaymentView, PurchaseView, SupplierView } from './procurement';

/** Running account with one supplier: opening balance, purchases (debit), payments (credit). */
export function supplierLedger(supplier: SupplierView, purchases: PurchaseView[], payments: PaymentView[]) {
  const rows = [
    ...purchases.filter(p => p.status === 'received').map(p => ({ date: p.receivedAt ?? p.purchaseDate, kind: 'purchase' as const, ref: p.reference, debit: p.totalIqd, credit: 0 })),
    ...payments.map(p => ({ date: p.paidAt, kind: 'payment' as const, ref: p.purchaseRef ?? '', debit: 0, credit: p.amountIqd })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  let balance = supplier.openingBalanceIqd;
  return { opening: supplier.openingBalanceIqd, rows: rows.map(r => { balance += r.debit - r.credit; return { ...r, balance }; }), closing: balance };
}

