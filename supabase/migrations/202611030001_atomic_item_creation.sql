-- Create an item and record its opening stock in one database transaction.
create or replace function public.create_inventory_item(
  p_sku text,
  p_name text,
  p_category text,
  p_variant text,
  p_kind public.item_kind,
  p_unit text,
  p_initial_stock integer,
  p_minimum_stock integer,
  p_location text,
  p_unit_price numeric
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare item_row public.items%rowtype;
begin
  if not private.has_any_role(array['admin','inventory']::public.app_role[]) then
    raise exception 'Insufficient role to create inventory items';
  end if;
  if nullif(btrim(p_sku), '') is null or nullif(btrim(p_name), '') is null
     or nullif(btrim(p_category), '') is null or nullif(btrim(p_unit), '') is null then
    raise exception 'SKU, name, category, and unit are required';
  end if;
  if p_initial_stock is null or p_initial_stock <= 0 then raise exception 'Initial stock must be positive'; end if;
  if p_minimum_stock is null or p_minimum_stock < 0 then raise exception 'Minimum stock cannot be negative'; end if;
  if p_unit_price is null or p_unit_price < 0 then raise exception 'Unit price cannot be negative'; end if;

  insert into public.items(sku,name,category,variant,kind,unit,current_stock,minimum_stock,location,unit_price,qr_payload)
  values(btrim(p_sku),btrim(p_name),btrim(p_category),coalesce(btrim(p_variant),''),p_kind,btrim(p_unit),0,p_minimum_stock,nullif(btrim(p_location),''),p_unit_price,btrim(p_sku))
  returning * into item_row;

  perform public.record_stock_movement(item_row.id,'inbound'::public.movement_type,p_initial_stock,null,'Stok awal barang');
  select * into item_row from public.items where id=item_row.id;
  return to_jsonb(item_row);
end;
$$;
revoke all on function public.create_inventory_item(text,text,text,text,public.item_kind,text,integer,integer,text,numeric) from public, anon;
grant execute on function public.create_inventory_item(text,text,text,text,public.item_kind,text,integer,integer,text,numeric) to authenticated;

-- Changing the stock behavior after an item has history can make old returns invalid
-- or make consumed stock appear returnable. Keep kind stable once transactions exist.
create or replace function private.prevent_item_kind_change_with_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind is distinct from old.kind and (
    exists(select 1 from public.requests where item_id=old.id)
    or exists(select 1 from public.stock_movements where item_id=old.id)
  ) then
    raise exception 'Item kind cannot be changed after stock or request history exists';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_item_kind_change_with_history() from public, anon, authenticated;
drop trigger if exists protect_item_kind_with_history on public.items;
create trigger protect_item_kind_with_history before update of kind on public.items
for each row execute function private.prevent_item_kind_change_with_history();
