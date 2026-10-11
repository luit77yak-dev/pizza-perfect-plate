-- Run after all staged supplier migrations and compatibility smoke tests.
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $test$ begin
 if not exists(select 1 from public.neroxa_storefront_products where id='55555555-5555-4555-8555-555555555555') then raise exception 'tenant read denied'; end if;
 if public.neroxa_can_write_storefront_instance('33333333-3333-4333-8333-333333333333') then raise exception 'tenant member gained catalog write'; end if;
 if public.neroxa_can_write_storefront_organization('11111111-1111-4111-8111-111111111111') then raise exception 'tenant member gained settings write'; end if;
 update public.neroxa_storefront_products set name='FORBIDDEN' where id='55555555-5555-4555-8555-555555555555';
 if found then raise exception 'tenant member updated product'; end if;
 update public.neroxa_storefront_settings set storefront_theme='FORBIDDEN' where organization_id='11111111-1111-4111-8111-111111111111';
 if found then raise exception 'tenant member updated settings'; end if;
 update public.neroxa_storefront_delivery_zones set name='FORBIDDEN' where id='99999999-9999-4999-8999-999999999999';
 if found then raise exception 'tenant member updated zone'; end if;
 begin
  insert into public.neroxa_storefront_categories(instance_id,name,slug) values
   ('33333333-3333-4333-8333-333333333333','Forbidden','forbidden');
  raise exception 'tenant member inserted category';
 exception when insufficient_privilege or check_violation then null;
 end;
end $test$;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
do $test$ begin
 if not public.neroxa_can_write_storefront_instance('33333333-3333-4333-8333-333333333333') then raise exception 'platform admin write denied'; end if;
 update public.neroxa_storefront_settings set storefront_theme='neroxa-classic'
 where organization_id='11111111-1111-4111-8111-111111111111';
 if not found then raise exception 'platform admin settings update denied'; end if;
end $test$;
reset role;
