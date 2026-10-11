-- Disposable CI only: fixture, catalog candidate, then this test.
create or replace function auth.uid() returns uuid language sql stable as $fn$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$fn$;
insert into auth.users(id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
insert into public.neroxa_platform_members(user_id,active) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
insert into public.neroxa_organizations(id,legal_name,active) values
 ('11111111-1111-4111-8111-111111111111','Org A',true),
 ('22222222-2222-4222-8222-222222222222','Org B',true);
insert into public.neroxa_system_instances(id,organization_id,name,slug,system_type,status) values
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Store A','store-a','delivery','ACTIVE'),
 ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','Store B','store-b','delivery','ACTIVE');
insert into public.neroxa_organization_members(organization_id,user_id,active) values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
insert into public.neroxa_storefront_products(id,instance_id,name,slug) values
 ('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','Pizza A','pizza-a'),
 ('66666666-6666-4666-8666-666666666666','44444444-4444-4444-8444-444444444444','Pizza B','pizza-b');
insert into public.neroxa_storefront_addon_groups(id,instance_id,name) values
 ('77777777-7777-4777-8777-777777777777','33333333-3333-4333-8333-333333333333','Extras A'),
 ('88888888-8888-4888-8888-888888888888','44444444-4444-4444-8444-444444444444','Extras B');
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $test$ begin
 if (select count(*) from public.neroxa_storefront_products) <> 1 then raise exception 'cross-tenant product read'; end if;
 if (select count(*) from public.neroxa_storefront_addon_groups) <> 1 then raise exception 'cross-tenant group read'; end if;
 if not public.neroxa_can_manage_storefront_instance('33333333-3333-4333-8333-333333333333') then raise exception 'own instance denied'; end if;
 if public.neroxa_can_manage_storefront_instance('44444444-4444-4444-8444-444444444444') then raise exception 'other instance allowed'; end if;
 begin
  insert into public.neroxa_storefront_product_addon_groups(product_id,group_id)
   values('55555555-5555-4555-8555-555555555555','88888888-8888-4888-8888-888888888888');
  raise exception 'cross-tenant addon link accepted';
 exception when insufficient_privilege or check_violation then null;
 end;
end $test$;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
do $test$ begin
 if (select count(*) from public.neroxa_storefront_products) <> 2 then raise exception 'platform admin denied'; end if;
end $test$;
reset role;
do $test$ begin
 if has_table_privilege('anon','public.neroxa_storefront_products','SELECT') then raise exception 'anon product select granted'; end if;
 if has_table_privilege('anon','public.neroxa_storefront_categories','INSERT') then raise exception 'anon category insert granted'; end if;
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname in ('neroxa_storefront_products','neroxa_storefront_categories','neroxa_storefront_addon_groups','neroxa_storefront_addons','neroxa_storefront_product_addon_groups') and c.relrowsecurity) <> 5
 then raise exception 'catalog RLS not enabled'; end if;
end $test$;
