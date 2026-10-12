# V95 — Financial recognition by delivery status

- A new storefront/manual order starts with `pending` status.
- Pending, confirmed, processing, and shipped orders are operational only and are excluded from realized revenue/profit/finance reports.
- Realized product revenue and product profit are recognized only when the order reaches `delivered`.
- Product profit remains: `(sale price - purchase price) × quantity`.
- Order discounts reduce product revenue and therefore reduce product profit. Delivery charges are tracked separately and do not enter product profit.
- When an order is delivered, `orders.profitIqd` is populated from the stored item-level sale/purchase snapshots.
- When an order is cancelled or returned, realized order profit is reset to zero and the reports exclude it.
- Dashboard “Needs action” still counts pending/confirmed/processing operational orders separately.
- The order itself remains `pending` after checkout; this is intentional. Financial recognition is separate from order workflow status.
