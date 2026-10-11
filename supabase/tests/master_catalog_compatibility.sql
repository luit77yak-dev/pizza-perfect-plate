-- Isolated compatibility smoke test mirroring master-catalogo.tsx payload fields.
-- Fixture + staged catalog/settings migrations + compatibility patch must run first.
set role authenticated;
select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
insert into public.neroxa_storefront_categories
 (id,instance_id,name,slug,description,image_url,sort_order,active,updated_at)
 values ('a1111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',
 'Pizzas','pizzas','Cardapio','https://example.com/category.png',1,true,now());
update public.neroxa_storefront_categories
 set name='Pizzas especiais',image_url='https://example.com/new.png',updated_at=now()
 where id='a1111111-1111-4111-8111-111111111111';
update public.neroxa_storefront_products
 set category_id='a1111111-1111-4111-8111-111111111111',
 description='Pizza de teste',sort_order=2,updated_at=now()
 where id='55555555-5555-4555-8555-555555555555';
insert into public.neroxa_storefront_settings
 (organization_id,storefront_theme,updated_at)
 values ('11111111-1111-4111-8111-111111111111','neroxa-horizontal',now())
 on conflict (organization_id) do update set
 storefront_theme=excluded.storefront_theme,updated_at=excluded.updated_at;
do $test$ begin
 if not exists (select 1 from public.neroxa_storefront_categories
 where id='a1111111-1111-4111-8111-111111111111' and image_url='https://example.com/new.png')
 then raise exception 'Master category image/update incompatible'; end if;
 if not exists (select 1 from public.neroxa_storefront_products
 where id='55555555-5555-4555-8555-555555555555' and category_id='a1111111-1111-4111-8111-111111111111')
 then raise exception 'Master product category/update incompatible'; end if;
 if not exists (select 1 from public.neroxa_storefront_settings
 where organization_id='11111111-1111-4111-8111-111111111111' and storefront_theme='neroxa-horizontal')
 then raise exception 'Master storefront theme upsert incompatible'; end if;
end $test$;
reset role;
-- Ensure schema supports all fields Master writes, independent of fixture contents.
do $test$ declare v_missing text; begin
 select string_agg(expected.table_name||'.'||expected.column_name,', ')
 into v_missing from (values
 ('neroxa_storefront_categories','image_url'),('neroxa_storefront_categories','updated_at'),
 ('neroxa_storefront_products','updated_at'),
 ('neroxa_storefront_settings','storefront_theme'),('neroxa_storefront_settings','updated_at')
 ) expected(table_name,column_name)
 left join information_schema.columns c on c.table_schema='public'
 and c.table_name=expected.table_name and c.column_name=expected.column_name
 where c.column_name is null;
 if v_missing is not null then raise exception 'Master columns missing: %',v_missing; end if;
end $test$;
