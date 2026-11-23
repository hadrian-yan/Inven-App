-- End-to-end flow smoke test. Run in Supabase SQL Editor as project owner.
-- All test rows are rolled back at the end; do not remove the final ROLLBACK.

begin;
select set_config('request.jwt.claim.sub', (select id::text from public.profiles where role = 'admin' order by created_at limit 1), true);
select set_config('request.jwt.claims', json_build_object('sub', (select id::text from public.profiles where role = 'admin' order by created_at limit 1), 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare
  test_member uuid;
  test_item uuid;
  cash_request uuid;
  payroll_request uuid;
  test_sku text := 'TEST-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  part record;
  observed_stock integer;
  observed_status public.payment_status;
begin
  insert into public.members(employee_no, full_name, job_role, site, is_active)
  values ('UJI-' || substr(test_sku, 6), '[UJI] Anggota Inventaris', 'OB', '[UJI]', true)
  returning id into test_member;

  test_item := (public.create_inventory_item(
    test_sku, '[UJI] Barang Pinjaman', 'Uji', 'Test', 'loan', 'unit', 5, 1, '[UJI]', 10000
  )->>'id')::uuid;

  -- Tunai: create -> approve -> record cash -> issue -> partial return.
  cash_request := public.create_inventory_request(test_member, test_item, 2, 'cash', 0, '[UJI] flow rollback');
  perform public.review_inventory_request(cash_request, true);
  perform public.record_cash_payment(cash_request);
  perform public.record_stock_movement(test_item, 'outbound', 2, cash_request, '[UJI] serah');
  perform public.record_stock_movement(test_item, 'return', 1, cash_request, '[UJI] kembali sebagian');
  select current_stock into observed_stock from public.items where id = test_item;
  if observed_stock <> 4 then raise exception 'Stock check failed after partial return: expected 4, got %', observed_stock; end if;

  -- Payroll: two installments become recorded only after handover.
  payroll_request := public.create_inventory_request(test_member, test_item, 1, 'payroll', 2, '[UJI] payroll rollback');
  perform public.review_inventory_request(payroll_request, true);
  perform public.record_stock_movement(test_item, 'outbound', 1, payroll_request, '[UJI] serah payroll');
  for part in
    select i.id from public.payment_installments i join public.payments p on p.id = i.payment_id
    where p.request_id = payroll_request order by i.installment_no
  loop
    perform public.record_payroll_installment(part.id, to_char(current_date, 'YYYY-MM'));
  end loop;
  select status into observed_status from public.payments where request_id = payroll_request;
  if observed_status <> 'paid' then raise exception 'Payroll check failed: expected paid, got %', observed_status; end if;

  raise notice 'PASS: tunai, barang keluar, pengembalian sebagian, cicilan payroll, dan stok.';
end;
$$;

rollback;
