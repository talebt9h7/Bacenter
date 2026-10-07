-- v90: Profit & inventory accounting uses existing purchases, inventory_batches and inventory_movements.
-- No destructive changes. Existing order item batchAllocations remain the historical FIFO cost snapshot.
-- This migration adds indexes that keep material-movement and purchase reporting fast.
create index if not exists inventory_movements_variant_created_idx on inventory_movements (variant_id, created_at desc);
create index if not exists inventory_batches_variant_remaining_idx on inventory_batches (variant_id, quantity_remaining);
create index if not exists purchases_date_status_idx on purchases (purchase_date, status);
