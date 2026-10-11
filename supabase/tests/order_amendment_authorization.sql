-- Fictitious, isolated authorization regression checks.
-- A raised exception fails CI. No external Supabase project is accessed.
begin;
do $test$
declare
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  inst_a uuid := gen_random_uuid();
  inst_b uuid := gen_random_uuid();
  sys uuid := gen_random_uuid();
  prod_a uuid := gen_random_uuid();
  prod_b uuid := gen_random_uuid();
  order_a uuid := gen_random_uuid();
  order_b uuid := gen_random_uuid();
  token_a text := repeat('a',64);
  token_b text := repeat('b',64);
  n integer;
begin
  insert into public.neroxa_organizations(id,legal_name) values (org_a,'Fixture A'),(org_b,'Fixture B');
  insert into public.neroxa_systems(id,slug,name,system_type) values (sys,'fixture-delivery','Fixture','DELIVERY');
  insert into public.neroxa_system_instances(id,organization_id,system_id,name,slug,system_type)
  values (inst_a,org_a,sys,'A','a','DELIVERY'),(inst_b,org_b,sys,'B','b','DELIVERY');
  insert into public.neroxa_storefront_products(id,instance_id,organization_id,name,price,active)
  values (prod_a,inst_a,org_a,'Pizza A',10,true),(prod_b,inst_b,org_b,'Pizza B',20,true);
  insert into public.neroxa_orders(id,instance_id,organization_id,order_number,customer_name,customer_phone,fulfillment,payment_method,status)
  values (order_a,inst_a,org_a,1,'Cliente A','62999990000','PICKUP','PIX','RECEIVED'),
         (order_b,inst_b,org_b,1,'Cliente B','62999990001','PICKUP','PIX','DELIVERED');
  insert into public.neroxa_order_amendment_credentials(order_id,token_hash,expires_at)
  values (order_a,sha256(convert_to(token_a,'UTF8')),now()+interval '1 hour'),
         (order_b,sha256(convert_to(token_b,'UTF8')),now()+interval '1 hour');

  -- Invalid bearer token must fail.
  begin
    perform * from public.append_authorized_order_items(order_a,repeat('f',64),
      jsonb_build_array(jsonb_build_object('product_id',prod_a,'quantity',1)),'PIX');
    raise exception 'FAIL: invalid token accepted';
  exception when others then
    if sqlerrm = 'FAIL: invalid token accepted' then raise; end if;
  end;

  -- Valid token cannot add another store's product.
  begin
    perform * from public.append_authorized_order_items(order_a,token_a,
      jsonb_build_array(jsonb_build_object('product_id',prod_b,'quantity',1)),'PIX');
    raise exception 'FAIL: cross-store product accepted';
  exception when others then
    if sqlerrm = 'FAIL: cross-store product accepted' then raise; end if;
  end;

  -- Delivered orders cannot be modified.
  begin
    perform * from public.append_authorized_order_items(order_b,token_b,
      jsonb_build_array(jsonb_build_object('product_id',prod_b,'quantity',1)),'PIX');
    raise exception 'FAIL: delivered order accepted';
  exception when others then
    if sqlerrm = 'FAIL: delivered order accepted' then raise; end if;
  end;

  -- A valid token and product should append exactly once.
  perform * from public.append_authorized_order_items(order_a,token_a,
    jsonb_build_array(jsonb_build_object('product_id',prod_a,'quantity',1)),'PIX');
  select count(*) into n from public.neroxa_order_items where order_id=order_a;
  if n <> 1 then raise exception 'FAIL: expected one added item, got %',n; end if;

  -- Revoked credentials must fail.
  update public.neroxa_order_amendment_credentials set revoked_at=now() where order_id=order_a;
  begin
    perform * from public.append_authorized_order_items(order_a,token_a,
      jsonb_build_array(jsonb_build_object('product_id',prod_a,'quantity',1)),'PIX');
    raise exception 'FAIL: revoked token accepted';
  exception when others then
    if sqlerrm = 'FAIL: revoked token accepted' then raise; end if;
  end;
end;
$test$;
rollback;
