begin;
do $test$
declare
  org uuid:=gen_random_uuid();
  sys uuid:=gen_random_uuid();
  inst uuid:=gen_random_uuid();
  ord uuid:=gen_random_uuid();
  req uuid:=gen_random_uuid();
  ch uuid:=gen_random_uuid();
  n integer;
begin
  insert into public.neroxa_organizations(id,legal_name) values(org,'Payment fixture');
  insert into public.neroxa_systems(id,slug,name,system_type) values(sys,'payment-fixture','Fixture','DELIVERY');
  insert into public.neroxa_system_instances(id,organization_id,system_id,name,slug,system_type)
    values(inst,org,sys,'Payment','payment-fixture','DELIVERY');
  insert into public.neroxa_orders(id,instance_id,organization_id,order_number,customer_name,customer_phone,fulfillment,payment_method,status)
    values(ord,inst,org,1,'Fixture','62999990000','PICKUP','PIX','RECEIVED');
  insert into public.neroxa_order_addition_requests(id,order_id,instance_id,items,status)
    values(req,ord,inst,'[{"quantity":1}]','APPROVED');
  insert into public.neroxa_order_addition_charges(id,request_id,order_id,amount,status)
    values(ch,req,ord,15,'PENDING');

  perform public.neroxa_confirm_addition_payment(ch,'test-provider','ref-001','evt-001');
  perform public.neroxa_confirm_addition_payment(ch,'test-provider','ref-001','evt-001');
  select count(*) into n from public.neroxa_order_addition_charge_events
    where charge_id=ch and next_status='PAID';
  if n<>1 then raise exception 'FAIL: duplicate paid events'; end if;
  select count(*) into n from public.neroxa_order_addition_charges
    where id=ch and status='PAID' and paid_at is not null
      and provider='test-provider' and provider_reference='ref-001';
  if n<>1 then raise exception 'FAIL: charge not settled'; end if;
  begin
    perform public.neroxa_confirm_addition_payment(ch,'test-provider','ref-002','evt-002');
    raise exception 'FAIL: conflicting settlement accepted';
  exception when raise_exception then
    if sqlerrm <> 'Charge already settled with another payment' then raise; end if;
  end;
  if has_function_privilege('anon','public.neroxa_confirm_addition_payment(uuid,text,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.neroxa_confirm_addition_payment(uuid,text,text,text)','EXECUTE') then
    raise exception 'FAIL: payment settlement exposed to client';
  end if;
  if not has_function_privilege('service_role','public.neroxa_confirm_addition_payment(uuid,text,text,text)','EXECUTE') then
    raise exception 'FAIL: trusted backend cannot settle payment';
  end if;
end;
$test$;
rollback;
