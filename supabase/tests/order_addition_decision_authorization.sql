-- Decision authorization tests use only disposable PostgreSQL fixtures.
begin;
create or replace function auth.uid() returns uuid language sql stable
as 'select nullif(current_setting(''neroxa.test_user'',true),'''')::uuid';

do $test$
declare
  org_a uuid:=gen_random_uuid();
  org_b uuid:=gen_random_uuid();
  inst_a uuid:=gen_random_uuid();
  inst_b uuid:=gen_random_uuid();
  sys_id uuid:=gen_random_uuid();
  user_a uuid:=gen_random_uuid();
  user_b uuid:=gen_random_uuid();
  order_a uuid:=gen_random_uuid();
  order_b uuid:=gen_random_uuid();
  prod_a uuid:=gen_random_uuid();
  prod_b uuid:=gen_random_uuid();
  req_a uuid:=gen_random_uuid();
  req_b uuid:=gen_random_uuid();
  state_a text;
  n integer;
begin
  insert into auth.users(id) values(user_a),(user_b);
  insert into public.neroxa_organizations(id,legal_name)
    values(org_a,'Decision Org A'),(org_b,'Decision Org B');
  insert into public.neroxa_systems(id,slug,name,system_type)
    values(sys_id,'decision-test','Decision Fixture','DELIVERY');
  insert into public.neroxa_system_instances(id,organization_id,system_id,name,slug,system_type)
    values(inst_a,org_a,sys_id,'A','decision-a','DELIVERY'),
          (inst_b,org_b,sys_id,'B','decision-b','DELIVERY');
  insert into public.neroxa_storefront_products(id,instance_id,name,slug,price,active)
    values(prod_a,inst_a,'Pizza A','pizza-a',15,true),
          (prod_b,inst_b,'Pizza B','pizza-b',20,true);
  insert into public.neroxa_organization_members(organization_id,user_id,active)
    values(org_a,user_a,true),(org_b,user_b,true);
  insert into public.neroxa_orders(id,instance_id,organization_id,order_number,customer_name,customer_phone,fulfillment,payment_method,status)
    values(order_a,inst_a,org_a,1,'A','62999990000','PICKUP','PIX','RECEIVED'),
          (order_b,inst_b,org_b,1,'B','62999990001','PICKUP','PIX','RECEIVED');
  insert into public.neroxa_order_addition_requests(id,order_id,instance_id,items)
    values(req_a,order_a,inst_a,jsonb_build_array(jsonb_build_object('product_id',prod_a,'quantity',2))),
          (req_b,order_b,inst_b,jsonb_build_array(jsonb_build_object('product_id',prod_b,'quantity',1)));

  perform set_config('neroxa.test_user',user_a::text,true);
  begin
    perform public.decide_order_addition_request(req_b,true);
    raise exception 'FAIL: cross-restaurant decision accepted';
  exception when insufficient_privilege then null;
  end;
  select status into state_a from public.neroxa_order_addition_requests where id=req_b;
  if state_a <> 'REQUESTED' then raise exception 'FAIL: cross-restaurant state changed'; end if;

  perform public.decide_order_addition_request(req_a,true);
  select count(*) into n from public.neroxa_order_addition_requests
    where id=req_a and status='APPROVED' and decided_by=user_a and decided_at is not null;
  if n<>1 then raise exception 'FAIL: own restaurant approval not persisted'; end if;

  select count(*) into n from public.neroxa_order_addition_charges
    where request_id=req_a and order_id=order_a and amount=30 and status='PENDING' and paid_at is null;
  if n<>1 then raise exception 'FAIL: expected exactly one pending charge of 30'; end if;
  select count(*) into n from public.neroxa_order_addition_charge_events e
    join public.neroxa_order_addition_charges c on c.id=e.charge_id
    where c.request_id=req_a and e.next_status='PENDING';
  if n<>1 then raise exception 'FAIL: expected exactly one charge event'; end if;

  begin
    perform public.decide_order_addition_request(req_a,false);
    raise exception 'FAIL: repeated decision accepted';
  exception when raise_exception then
    if sqlerrm <> 'Request already decided' then raise; end if;
  end;

  select count(*) into n from public.neroxa_order_addition_charges where request_id=req_a;
  if n<>1 then raise exception 'FAIL: duplicate charge created'; end if;

  update public.neroxa_orders set status='DELIVERED' where id=order_b;
  perform set_config('neroxa.test_user',user_b::text,true);
  begin
    perform public.decide_order_addition_request(req_b,true);
    raise exception 'FAIL: terminal order approved';
  exception when raise_exception then
    if sqlerrm <> 'Order no longer accepts additions' then raise; end if;
  end;

  update public.neroxa_orders set status='RECEIVED' where id=order_b;
  perform set_config('neroxa.test_user','',true);
  begin
    perform public.decide_order_addition_request(req_b,true);
    raise exception 'FAIL: anonymous decision accepted';
  exception when insufficient_privilege then null;
  end;

  perform set_config('neroxa.test_user',user_b::text,true);
  perform public.decide_order_addition_request(req_b,false);
  select count(*) into n from public.neroxa_order_addition_requests
    where id=req_b and status='REJECTED' and decided_by=user_b;
  if n<>1 then raise exception 'FAIL: own restaurant rejection not persisted'; end if;
  select count(*) into n from public.neroxa_order_addition_charges where request_id=req_b;
  if n<>0 then raise exception 'FAIL: rejected request created charge'; end if;

  if has_function_privilege('anon','public.decide_order_addition_request(uuid,boolean)','EXECUTE') then
    raise exception 'FAIL: anonymous role has decision privilege';
  end if;
end;
$test$;
rollback;
