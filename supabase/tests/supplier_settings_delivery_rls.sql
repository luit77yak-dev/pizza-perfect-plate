-- Disposable PostgreSQL only. Run after supplier_catalog_rls.sql.
insert into public.neroxa_storefront_settings(organization_id) values
 ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.neroxa_storefront_delivery_zones(id,organization_id,name) values
 ('99999999-9999-4999-8999-999999999999','11111111-1111-4111-8111-111111111111','Zone A'),
 ('aaaaaaaa-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','Zone B');
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
do $test$ begin
 if (select count(*) from public.neroxa_storefront_settings where organization_id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')) <> 1
 then raise exception 'settings tenant isolation failed'; end if;
 if (select count(*) from public.neroxa_storefront_delivery_zones where id in ('99999999-9999-4999-8999-999999999999','aaaaaaaa-1111-4111-8111-111111111111')) <> 1
 then raise exception 'delivery zone tenant isolation failed'; end if;
 if public.neroxa_can_manage_storefront_organization('22222222-2222-4222-8222-222222222222') then raise exception 'cross-tenant organization allowed'; end if;
 if (select count(*) from public.neroxa_storefront_delivery_zones where id='aaaaaaaa-1111-4111-8111-111111111111') <> 0
 then raise exception 'cross-tenant delivery zone read'; end if;
 update public.neroxa_storefront_delivery_zones set name='Forbidden' where id='aaaaaaaa-1111-4111-8111-111111111111';
 if found then raise exception 'cross-tenant delivery zone update'; end if;
end $test$;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
do $test$ begin
 if not exists (select 1 from public.neroxa_storefront_settings where organization_id='11111111-1111-4111-8111-111111111111')
 or not exists (select 1 from public.neroxa_storefront_settings where organization_id='22222222-2222-4222-8222-222222222222')
 then raise exception 'platform admin settings access denied'; end if;
 if not exists (select 1 from public.neroxa_storefront_delivery_zones where id='99999999-9999-4999-8999-999999999999')
 or not exists (select 1 from public.neroxa_storefront_delivery_zones where id='aaaaaaaa-1111-4111-8111-111111111111')
 then raise exception 'platform admin delivery zones access denied'; end if;
end $test$;
reset role;
do $test$ begin
 if has_table_privilege('anon','public.neroxa_storefront_settings','SELECT') then raise exception 'anon settings read granted'; end if;
 if has_table_privilege('anon','public.neroxa_storefront_delivery_zones','UPDATE') then raise exception 'anon zones update granted'; end if;
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('neroxa_storefront_settings','neroxa_storefront_delivery_zones') and c.relrowsecurity) <> 2
 then raise exception 'settings/zones RLS not enabled'; end if;
end $test$;
