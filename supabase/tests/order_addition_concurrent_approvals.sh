#!/usr/bin/env bash
set -euo pipefail
# Runs against disposable GitHub Actions PostgreSQL only.
psql -v ON_ERROR_STOP=1 <<'SQL'
create or replace function auth.uid() returns uuid language sql stable
as 'select nullif(current_setting(''neroxa.test_user'',true),'''')::uuid';
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001');
insert into public.neroxa_organizations(id,legal_name) values ('20000000-0000-4000-8000-000000000001','Concurrency fixture');
insert into public.neroxa_systems(id,slug,name,system_type) values ('30000000-0000-4000-8000-000000000001','concurrency-fixture','Fixture','DELIVERY');
insert into public.neroxa_system_instances(id,organization_id,system_id,name,slug,system_type)
values ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Fixture','concurrency','DELIVERY');
insert into public.neroxa_organization_members(organization_id,user_id,active)
values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',true);
insert into public.neroxa_storefront_products(id,instance_id,name,slug,price)
values ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Fixture pizza','fixture-pizza',17);
insert into public.neroxa_orders(id,instance_id,organization_id,order_number,customer_name,customer_phone,fulfillment,payment_method,status)
values ('60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',1,'Fixture','62999990000','PICKUP','PIX','RECEIVED');
insert into public.neroxa_order_addition_requests(id,order_id,instance_id,items)
values ('70000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
'[{"product_id":"50000000-0000-4000-8000-000000000001","quantity":2}]');
SQL

# Lock the request in one transaction while both approval sessions queue behind it.
# After release, exactly one must commit and the other must fail as already decided.
psql -v ON_ERROR_STOP=1 -c "begin; select id from public.neroxa_order_addition_requests where id='70000000-0000-4000-8000-000000000001' for update; select pg_sleep(4); commit;" >/tmp/neroxa-lock.log 2>&1 &
lock_pid=$!
sleep 1
for i in 1 2; do
  (
    psql -v ON_ERROR_STOP=1 <<'SQL'
select set_config('neroxa.test_user','10000000-0000-4000-8000-000000000001',false);
select public.decide_order_addition_request('70000000-0000-4000-8000-000000000001',true);
SQL
  ) >/tmp/neroxa-approval-"$i".log 2>&1 &
  if [[ "$i" == 1 ]]; then pid1=$!; else pid2=$!; fi
done
set +e
wait "$pid1"; rc1=$?
wait "$pid2"; rc2=$?
wait "$lock_pid"; lock_rc=$?
set -e
cat /tmp/neroxa-approval-1.log /tmp/neroxa-approval-2.log
if [[ "$lock_rc" != 0 ]]; then echo "Lock fixture failed"; exit 1; fi
if ! { [[ "$rc1" == 0 && "$rc2" != 0 ]] || [[ "$rc2" == 0 && "$rc1" != 0 ]]; }; then
  echo "Expected exactly one successful concurrent approval"; exit 1
fi
psql -v ON_ERROR_STOP=1 <<'SQL'
do $test$
declare n integer;
begin
  select count(*) into n from public.neroxa_order_addition_charges
  where request_id='70000000-0000-4000-8000-000000000001'
    and amount=34 and status='PENDING';
  if n<>1 then raise exception 'Expected exactly one pending charge, got %',n; end if;
  select count(*) into n from public.neroxa_order_addition_charge_events e
  join public.neroxa_order_addition_charges c on c.id=e.charge_id
  where c.request_id='70000000-0000-4000-8000-000000000001';
  if n<>1 then raise exception 'Expected exactly one event, got %',n; end if;
end;
$test$;
SQL
