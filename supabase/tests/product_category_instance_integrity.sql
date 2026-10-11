-- Runs against isolated fixture after 19:00 migration; no production data.
set role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
insert into public.neroxa_storefront_categories(id,instance_id,name,slug)
values('a2222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','Test','test-cat');
update public.neroxa_storefront_products set category_id='a2222222-2222-4222-8222-222222222222'
where id='55555555-5555-4555-8555-555555555555';
do $test$ begin
 begin
  update public.neroxa_storefront_products set category_id='a2222222-2222-4222-8222-222222222222',
  instance_id='44444444-4444-4444-8444-444444444444'
  where id='55555555-5555-4555-8555-555555555555';
  raise exception 'CROSS_INSTANCE_PRODUCT_UPDATE_ACCEPTED';
 exception when check_violation then null;
 end;
 begin
  insert into public.neroxa_storefront_products(id,instance_id,name,price,category_id)
  values('a3333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444','Invalid',10,
  'a2222222-2222-4222-8222-222222222222');
  raise exception 'CROSS_INSTANCE_PRODUCT_INSERT_ACCEPTED';
 exception when check_violation then null;
 end;
end $test$;
reset role;
