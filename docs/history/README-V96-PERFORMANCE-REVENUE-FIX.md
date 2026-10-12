# UR v96 — Performance + Revenue Recognition Fix

- Admin revenue is now **net product revenue after order discount**.
- Delivery remains separate from product revenue.
- Product profit remains **(sale price − purchase price) × quantity** and is NOT reduced by order discounts or delivery.
- Discount is shown separately in reports and exports.
- Added indexes for order date/status/customer and activity log.
- Increased DB pool max from 5 to 10.
- Removed redundant `force-dynamic` declaration from the admin layout.
- Dashboard delivered-order query selects only fields needed for statistics.
