-- Execute real UPDATE DML under RLS for every Master role; disposable PostgreSQL only.
-- Earlier master_role_matrix.sql creates synthetic users and sets auth.uid().
set role authenticated;
do $test$
declare v_role text; v_id uuid; v_expected boolean; v_changed integer;
begin
 for v_role,v_id,v_expected in select * from (values
 ('OWNER','b0000000-0000-4000-8000-000000000001'::uuid,true),
 ('ADMIN','b0000000-0000-4000-8000-000000000002'::uuid,true),
 ('MANAGER','b0000000-0000-4000-8000-000000000003'::uuid,true),
 ('OPERATOR','b0000000-0000-4000-8000-000000000004'::uuid,false),
 ('SUPER_ADMIN','b0000000-0000-4000-8000-000000000005'::uuid,true),
 ('PLATFORM_ADMIN','b0000000-0000-4000-8000-000000000006'::uuid,true),
 ('SUPPORT','b0000000-0000-4000-8000-000000000007'::uuid,false),
 ('FINANCE','b0000000-0000-4000-8000-000000000008'::uuid,false)
 ) x(role_name,uid,expected)
 loop
  perform set_config('request.jwt.claim.sub',v_id::text,true);
  update public.neroxa_storefront_products set name=name
  where id='55555555-5555-4555-8555-555555555555';
  get diagnostics v_changed = row_count;
  if (v_changed=1) is distinct from v_expected then
   raise exception 'PRODUCT UPDATE RLS role % changed % expected %',v_role,v_changed,v_expected;
  end if;
  update public.neroxa_storefront_settings set storefront_theme=storefront_theme
  where organization_id='11111111-1111-4111-8111-111111111111';
  get diagnostics v_changed = row_count;
  if (v_changed=1) is distinct from v_expected then
   raise exception 'SETTINGS UPDATE RLS role % changed % expected %',v_role,v_changed,v_expected;
  end if;
 end loop;
 -- Cross-organization UPDATE must never affect a row for a tenant OWNER.
 perform set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
 update public.neroxa_storefront_products set name=name
 where id='66666666-6666-4666-8666-666666666666';
 get diagnostics v_changed = row_count;
 if v_changed<>0 then raise exception 'CROSS_ORG_PRODUCT_UPDATE_ALLOWED'; end if;
end $test$;
reset role;
