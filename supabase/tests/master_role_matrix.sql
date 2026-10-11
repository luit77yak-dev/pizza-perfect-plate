-- Isolated fixture role authorization matrix; assumes master_roles_policy_overlay.sql.
-- auth.uid() in CI is overridden for synthetic JWT subject.
create or replace function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
insert into auth.users(id) values
('b0000000-0000-4000-8000-000000000001'),('b0000000-0000-4000-8000-000000000002'),
('b0000000-0000-4000-8000-000000000003'),('b0000000-0000-4000-8000-000000000004'),
('b0000000-0000-4000-8000-000000000005'),('b0000000-0000-4000-8000-000000000006'),
('b0000000-0000-4000-8000-000000000007'),('b0000000-0000-4000-8000-000000000008')
on conflict do nothing;
insert into public.neroxa_organization_members(organization_id,user_id,role,active) values
('11111111-1111-4111-8111-111111111111','b0000000-0000-4000-8000-000000000001','OWNER',true),
('11111111-1111-4111-8111-111111111111','b0000000-0000-4000-8000-000000000002','ADMIN',true),
('11111111-1111-4111-8111-111111111111','b0000000-0000-4000-8000-000000000003','MANAGER',true),
('11111111-1111-4111-8111-111111111111','b0000000-0000-4000-8000-000000000004','OPERATOR',true);
insert into public.neroxa_platform_members(user_id,role,active) values
('b0000000-0000-4000-8000-000000000005','SUPER_ADMIN',true),
('b0000000-0000-4000-8000-000000000006','ADMIN',true),
('b0000000-0000-4000-8000-000000000007','SUPPORT',true),
('b0000000-0000-4000-8000-000000000008','FINANCE',true);
set role authenticated;
do $test$ declare v_role text; v_id uuid; v_expected boolean; v_actual boolean; begin
 for v_role,v_id,v_expected in
 select * from (values
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
 select (public.neroxa_has_org_role('11111111-1111-4111-8111-111111111111',array['OWNER','ADMIN','MANAGER']::public.neroxa_organization_role[])
 or public.neroxa_has_platform_role(array['SUPER_ADMIN','ADMIN']::public.neroxa_platform_role[])) into v_actual;
 if v_actual is distinct from v_expected then raise exception 'role % unexpected write authorization: %',v_role,v_actual; end if;
 end loop;
 perform set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
 if public.neroxa_has_org_role('22222222-2222-4222-8222-222222222222') then raise exception 'cross-organization authorization'; end if;
end $test$;
reset role;

-- The executable DML matrix is in master_role_dml_matrix.sql; CI inclusion pending.
