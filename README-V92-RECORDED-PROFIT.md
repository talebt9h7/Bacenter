# v92 — Recorded profit per sold item

- Each sold item stores `profitIqd` inside the order snapshot.
- Each order stores the sum in `orders.profit_iqd`.
- Manual orders let the operator enter the exact profit for each product line.
- Reports and Excel use recorded order/item profit as the source of truth; inventory purchase cost does not overwrite it.
- Historical orders are backfilled from their saved purchase-cost snapshot where available.
- Changing a product's current sale price or purchase price does not change historical order profit.
