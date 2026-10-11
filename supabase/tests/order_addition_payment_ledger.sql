-- Isolated payment-ledger regression tests. Every assertion runs in a transaction.
begin;
do $test$
declare
  org_id uuid := gen_random_uuid();
  sys_id uuid := gen_random_uuid();
  inst_id uuid := gen_random_uuid();
  order_id uuid := gen_random_uuid();
  request_id uuid := gen_random_uuid();
  charge_id uuid := gen_random_uuid();
  n integer;
begin
  insert into public.neroxa_organizations(id,legal_name) values (org_id,'Payment Fixture');
  insert into public.neroxa_systems(id,slug,name,system_type)
    values (sys_id,'payment-fixture','Payment Fixture','DELIVERY');
  insert into public.neroxa_system_instances(id,organization_id,system_id,name,slug,system_type)
    values (inst_id,org_id,sys_id,'Fixture','payment','DELIVERY');
  insert into public.neroxa_orders(id,instance_id,organization_id,order_number,customer_name,customer_phone,fulfillment,payment_method,status)
    values (order_id,inst_id,org_id,1,'Cliente Ficticio','62999990000','PICKUP','PIX','RECEIVED');
  insert into public.neroxa_order_addition_requests(id,order_id,instance_id,items)
    values (request_id,order_id,inst_id,'[{"quantity":1}]'::jsonb);
  insert into public.neroxa_order_addition_charges(id,request_id,order_id,amount)
    values (charge_id,request_id,order_id,12.50);

  select count(*) into n from public.neroxa_order_addition_charges
  where id=charge_id and status='PENDING' and paid_at is null;
  if n <> 1 then raise exception 'FAIL: new charge not pending'; end if;

  begin
    update public.neroxa_order_addition_charges set status='PAID' where id=charge_id;
    raise exception 'FAIL: paid without proof';
  exception when check_violation then null;
  end;

  begin
    update public.neroxa_order_addition_charges set status='PAID',paid_at=now() where id=charge_id;
    raise exception 'FAIL: paid without provider reference';
  exception when check_violation then null;
  end;

  begin
    insert into public.neroxa_order_addition_charges(request_id,order_id,amount)
      values(request_id,order_id,12.50);
    raise exception 'FAIL: duplicate request charge';
  exception when unique_violation then null;
  end;

  begin
    insert into public.neroxa_order_addition_requests(order_id,instance_id,items)
      values (order_id,inst_id,'[{"quantity":1}]'::jsonb) returning id into request_id;
    insert into public.neroxa_order_addition_charges(request_id,order_id,amount)
      values(request_id,order_id,-1);
    raise exception 'FAIL: negative charge';
  exception when check_violation then null;
       when foreign_key_violation then
         raise exception 'FAIL: invalid test setup for negative charge';
  end;

  -- No direct table access for storefront and logged-in clients.
  if has_table_privilege('anon','public.neroxa_order_addition_charges','INSERT')
    or has_table_privilege('authenticated','public.neroxa_order_addition_charges','UPDATE')
    or has_table_privilege('anon','public.neroxa_order_addition_requests','SELECT')
    or has_table_privilege('authenticated','public.neroxa_order_addition_charge_events','INSERT')
  then raise exception 'FAIL: ledger grants too broad'; end if;
end;
$test$;
rollback;
