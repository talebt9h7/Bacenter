# v90 — Profit, Purchases & Material Movement

- Net profit = product revenue - FIFO cost of units sold - operating expenses.
- Purchases are shown separately as inventory/cash investment; buying stock is not treated as an expense until the units are sold.
- Current stock value is calculated from remaining inventory batches at purchase cost.
- Each product now shows a Material Movement ledger with purchase/sale/return/adjustment movements.
- Existing batchAllocations and purchaseCostCents on order items preserve historical FIFO cost even if the sale price changes later.
- Added reporting indexes only; no destructive migration.
