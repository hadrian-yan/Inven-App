-- Barang masuk mengisi current_stock secara langsung.
-- RLS items_insert_inventory tetap membatasi peran admin/inventory.
grant insert (current_stock) on table public.items to authenticated;
