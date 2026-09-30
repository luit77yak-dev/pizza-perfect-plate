-- Neroxa Master subscription foundation
--
-- This layer turns an accepted commercial contract into a durable subscription
-- snapshot. Invoice/payment records remain in the Finance module.

create type public.neroxa_subscription_status as enum (
  'PENDING',
  'ACTIVE',
  'PAUSED',
  'DELINQUENT',
  'CANCELLED',
  'EXPIRED'
);

create type public.neroxa_billing_interval as enum (
  'MONTHLY',
  'QUARTERLY',
  'YEARLY'
);

create type public.neroxa_subscription_item_type as enum (
  'PLAN',
  'ADD_ON',
  'SERVICE'
);

create table if not exists public.neroxa_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  active boolean not null default true,
  billing_interval public.neroxa_billing_interval not null default 'MONTHLY',
  base_price numeric(12,2) not null default 0 check (base_price >= 0),
  setup_price numeric(12,2) not null default 0 check (setup_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists neroxa_plans_active_idx
  on public.neroxa_plans(active);

create table if not exists public.neroxa_plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.neroxa_plans(id) on delete cascade,
  feature_key text not null,
  feature_name text not null,
  description text,
  included boolean not null default true,
  quantity numeric(12,2) check (quantity is null or quantity >= 0),
  created_at timestamptz not null default now(),
  unique(plan_id, feature_key)
);

create index if not exists neroxa_plan_features_plan_idx
  on public.neroxa_plan_features(plan_id);

create table if not exists public.neroxa_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.neroxa_clients(id) on delete restrict,
  contract_id uuid not null references public.neroxa_contracts(id) on delete restrict,
  contract_version_id uuid references public.neroxa_contract_versions(id) on delete restrict,
  plan_id uuid not null references public.neroxa_plans(id) on delete restrict,
  status public.neroxa_subscription_status not null default 'PENDING',
  billing_interval public.neroxa_billing_interval not null,
  contracted_recurring_value numeric(12,2) not null check (contracted_recurring_value >= 0),
  contracted_setup_value numeric(12,2) not null default 0 check (contracted_setup_value >= 0),
  started_at date,
  current_period_start date,
  current_period_end date,
  next_billing_date date,
  cancelled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists neroxa_subscriptions_client_idx
  on public.neroxa_subscriptions(client_id);

create index if not exists neroxa_subscriptions_contract_idx
  on public.neroxa_subscriptions(contract_id);

create index if not exists neroxa_subscriptions_status_idx
  on public.neroxa_subscriptions(status);

create index if not exists neroxa_subscriptions_billing_date_idx
  on public.neroxa_subscriptions(next_billing_date)
  where status in ('ACTIVE','DELINQUENT');

create unique index if not exists neroxa_subscriptions_one_current_per_client_idx
  on public.neroxa_subscriptions(client_id)
  where status in ('PENDING','ACTIVE','PAUSED','DELINQUENT');

create table if not exists public.neroxa_subscription_items (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.neroxa_subscriptions(id) on delete cascade,
  item_type public.neroxa_subscription_item_type not null,
  name text not null,
  description text,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  recurring boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists neroxa_subscription_items_subscription_idx
  on public.neroxa_subscription_items(subscription_id);

create trigger neroxa_plans_set_updated_at
before update on public.neroxa_plans
for each row execute function public.set_updated_at();

create trigger neroxa_subscriptions_set_updated_at
before update on public.neroxa_subscriptions
for each row execute function public.set_updated_at();

alter table public.neroxa_plans enable row level security;
alter table public.neroxa_plan_features enable row level security;
alter table public.neroxa_subscriptions enable row level security;
alter table public.neroxa_subscription_items enable row level security;

revoke all on table
  public.neroxa_plans,
  public.neroxa_plan_features,
  public.neroxa_subscriptions,
  public.neroxa_subscription_items
from anon, authenticated;

grant select on table
  public.neroxa_plans,
  public.neroxa_plan_features,
  public.neroxa_subscriptions,
  public.neroxa_subscription_items
to authenticated;

insert into public.neroxa_permissions(key,name,description) values
  ('subscriptions.read','Visualizar assinaturas','Consultar planos e assinaturas de clientes.'),
  ('subscriptions.write','Gerenciar assinaturas','Criar, atualizar e alterar assinaturas e planos.')
on conflict(key) do nothing;

insert into public.neroxa_role_permissions(role_id,permission_id)
select r.id,p.id
from public.neroxa_roles r
join public.neroxa_permissions p
  on p.key in ('subscriptions.read','subscriptions.write')
where r.key='super_admin'
on conflict do nothing;

insert into public.neroxa_role_permissions(role_id,permission_id)
select r.id,p.id
from public.neroxa_roles r
join public.neroxa_permissions p
  on p.key='subscriptions.read'
where r.key in ('admin','finance')
on conflict do nothing;

create policy neroxa_plans_staff_read
on public.neroxa_plans
for select to authenticated
using (public.has_neroxa_permission('subscriptions.read'));

create policy neroxa_plan_features_staff_read
on public.neroxa_plan_features
for select to authenticated
using (public.has_neroxa_permission('subscriptions.read'));

create policy neroxa_subscriptions_staff_read
on public.neroxa_subscriptions
for select to authenticated
using (public.has_neroxa_permission('subscriptions.read'));

create policy neroxa_subscription_items_staff_read
on public.neroxa_subscription_items
for select to authenticated
using (public.has_neroxa_permission('subscriptions.read'));

create or replace function public.create_neroxa_plan(
  p_name text,
  p_slug text,
  p_description text default null,
  p_billing_interval public.neroxa_billing_interval default 'MONTHLY',
  p_base_price numeric default 0,
  p_setup_price numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_name text := nullif(trim(coalesce(p_name,'')),'');
  v_slug text := lower(nullif(trim(coalesce(p_slug,'')),''));
begin
  if not public.has_neroxa_permission('subscriptions.write') then
    raise exception 'not authorized';
  end if;

  if v_name is null or v_slug is null then
    raise exception 'plan name and slug are required';
  end if;

  if p_base_price < 0 or p_setup_price < 0 then
    raise exception 'plan values cannot be negative';
  end if;

  insert into public.neroxa_plans(
    name,slug,description,billing_interval,base_price,setup_price
  )
  values(
    v_name,v_slug,nullif(trim(coalesce(p_description,'')), ''),
    p_billing_interval,p_base_price,p_setup_price
  )
  returning id into v_id;

  perform public.record_neroxa_audit(
    'PLAN_CREATED',
    'neroxa_plan',
    v_id,
    null,
    null,
    jsonb_build_object(
      'name',v_name,
      'slug',v_slug,
      'billing_interval',p_billing_interval,
      'base_price',p_base_price,
      'setup_price',p_setup_price
    ),
    null
  );

  return v_id;
end
$$;

create or replace function public.create_neroxa_plan_feature(
  p_plan_id uuid,
  p_feature_key text,
  p_feature_name text,
  p_description text default null,
  p_included boolean default true,
  p_quantity numeric default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_key text := lower(nullif(trim(coalesce(p_feature_key,'')),''));
  v_name text := nullif(trim(coalesce(p_feature_name,'')),'');
begin
  if not public.has_neroxa_permission('subscriptions.write') then
    raise exception 'not authorized';
  end if;

  if v_key is null or v_name is null then
    raise exception 'feature key and name are required';
  end if;

  if p_quantity is not null and p_quantity < 0 then
    raise exception 'feature quantity cannot be negative';
  end if;

  if not exists(
    select 1 from public.neroxa_plans
    where id=p_plan_id
  ) then
    raise exception 'plan not found';
  end if;

  insert into public.neroxa_plan_features(
    plan_id,feature_key,feature_name,description,included,quantity
  )
  values(
    p_plan_id,v_key,v_name,
    nullif(trim(coalesce(p_description,'')), ''),
    p_included,p_quantity
  )
  returning id into v_id;

  perform public.record_neroxa_audit(
    'PLAN_FEATURE_CREATED',
    'neroxa_plan_feature',
    v_id,
    null,
    null,
    jsonb_build_object('plan_id',p_plan_id,'feature_key',v_key,'feature_name',v_name),
    null
  );

  return v_id;
end
$$;

create or replace function public.create_neroxa_subscription(
  p_client_id uuid,
  p_contract_id uuid,
  p_contract_version_id uuid,
  p_plan_id uuid,
  p_recurring_value numeric,
  p_setup_value numeric default 0,
  p_started_at date default current_date,
  p_next_billing_date date default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_interval public.neroxa_billing_interval;
  v_contract_client uuid;
  v_version_contract uuid;
  v_plan_active boolean;
begin
  if not public.has_neroxa_permission('subscriptions.write') then
    raise exception 'not authorized';
  end if;

  if p_recurring_value < 0 or p_setup_value < 0 then
    raise exception 'subscription values cannot be negative';
  end if;

  select c.client_id
  into v_contract_client
  from public.neroxa_contracts c
  where c.id=p_contract_id
    and c.status in ('ACTIVE','SUSPENDED');

  if v_contract_client is null then
    raise exception 'active contract not found';
  end if;

  if v_contract_client <> p_client_id then
    raise exception 'contract does not belong to client';
  end if;

  if p_contract_version_id is not null then
    select cv.contract_id
    into v_version_contract
    from public.neroxa_contract_versions cv
    where cv.id=p_contract_version_id;

    if v_version_contract is null or v_version_contract <> p_contract_id then
      raise exception 'contract version does not belong to contract';
    end if;
  end if;

  select p.billing_interval,p.active
  into v_interval,v_plan_active
  from public.neroxa_plans p
  where p.id=p_plan_id;

  if v_interval is null or not v_plan_active then
    raise exception 'active plan not found';
  end if;

  insert into public.neroxa_subscriptions(
    client_id,contract_id,contract_version_id,plan_id,status,
    billing_interval,contracted_recurring_value,contracted_setup_value,
    started_at,current_period_start,next_billing_date,created_by
  )
  values(
    p_client_id,p_contract_id,p_contract_version_id,p_plan_id,'PENDING',
    v_interval,p_recurring_value,p_setup_value,
    p_started_at,p_started_at,p_next_billing_date,auth.uid()
  )
  returning id into v_id;

  perform public.record_neroxa_audit(
    'SUBSCRIPTION_CREATED',
    'neroxa_subscription',
    v_id,
    null,
    null,
    jsonb_build_object(
      'client_id',p_client_id,
      'contract_id',p_contract_id,
      'contract_version_id',p_contract_version_id,
      'plan_id',p_plan_id,
      'billing_interval',v_interval,
      'contracted_recurring_value',p_recurring_value,
      'contracted_setup_value',p_setup_value,
      'status','PENDING'
    ),
    null
  );

  return v_id;
end
$$;

create or replace function public.add_neroxa_subscription_item(
  p_subscription_id uuid,
  p_item_type public.neroxa_subscription_item_type,
  p_name text,
  p_description text default null,
  p_quantity numeric default 1,
  p_unit_price numeric default 0,
  p_recurring boolean default true
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_name text := nullif(trim(coalesce(p_name,'')),'');
begin
  if not public.has_neroxa_permission('subscriptions.write') then
    raise exception 'not authorized';
  end if;

  if v_name is null then
    raise exception 'subscription item name is required';
  end if;

  if p_quantity <= 0 or p_unit_price < 0 then
    raise exception 'invalid subscription item values';
  end if;

  if not exists(
    select 1 from public.neroxa_subscriptions
    where id=p_subscription_id
      and status in ('PENDING','ACTIVE','PAUSED')
  ) then
    raise exception 'subscription not found or not editable';
  end if;

  insert into public.neroxa_subscription_items(
    subscription_id,item_type,name,description,quantity,unit_price,recurring
  )
  values(
    p_subscription_id,p_item_type,v_name,
    nullif(trim(coalesce(p_description,'')), ''),
    p_quantity,p_unit_price,p_recurring
  )
  returning id into v_id;

  perform public.record_neroxa_audit(
    'SUBSCRIPTION_ITEM_ADDED',
    'neroxa_subscription_item',
    v_id,
    null,
    null,
    jsonb_build_object(
      'subscription_id',p_subscription_id,
      'item_type',p_item_type,
      'name',v_name,
      'quantity',p_quantity,
      'unit_price',p_unit_price,
      'recurring',p_recurring
    ),
    null
  );

  return v_id;
end
$$;

create or replace function public.transition_neroxa_subscription_status(
  p_subscription_id uuid,
  p_new_status public.neroxa_subscription_status
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_current public.neroxa_subscription_status;
  v_before jsonb;
  v_after jsonb;
  v_client uuid;
  v_start date;
  ok boolean := false;
begin
  if not public.has_neroxa_permission('subscriptions.write') then
    raise exception 'not authorized';
  end if;

  select s.status,s.client_id,to_jsonb(s)
  into v_current,v_client,v_before
  from public.neroxa_subscriptions s
  where s.id=p_subscription_id;

  if v_before is null then
    raise exception 'subscription not found';
  end if;

  if v_current=p_new_status then
    return true;
  end if;

  ok :=
    (v_current='PENDING' and p_new_status in ('ACTIVE','CANCELLED','EXPIRED'))
    or (v_current='ACTIVE' and p_new_status in ('PAUSED','DELINQUENT','CANCELLED','EXPIRED'))
    or (v_current='PAUSED' and p_new_status in ('ACTIVE','DELINQUENT','CANCELLED'))
    or (v_current='DELINQUENT' and p_new_status in ('ACTIVE','PAUSED','CANCELLED'))
    or (v_current='CANCELLED' and false)
    or (v_current='EXPIRED' and false);

  if not ok then
    raise exception 'invalid subscription status transition from % to %',v_current,p_new_status;
  end if;

  v_start := coalesce(
    (v_before->>'started_at')::date,
    current_date
  );

  update public.neroxa_subscriptions
  set
    status=p_new_status,
    started_at=case
      when p_new_status='ACTIVE' then coalesce(started_at,v_start)
      else started_at
    end,
    current_period_start=case
      when p_new_status='ACTIVE' then coalesce(current_period_start,v_start)
      else current_period_start
    end,
    cancelled_at=case
      when p_new_status='CANCELLED' then coalesce(cancelled_at,now())
      else cancelled_at
    end
  where id=p_subscription_id;

  select to_jsonb(s)
  into v_after
  from public.neroxa_subscriptions s
  where s.id=p_subscription_id;

  perform public.record_neroxa_audit(
    'SUBSCRIPTION_STATUS_CHANGED',
    'neroxa_subscription',
    p_subscription_id,
    null,
    v_before,
    v_after,
    jsonb_build_object(
      'client_id',v_client,
      'from_status',v_current,
      'to_status',p_new_status
    )
  );

  return true;
end
$$;

revoke all on function public.create_neroxa_plan(text,text,text,public.neroxa_billing_interval,numeric,numeric) from public,anon;
grant execute on function public.create_neroxa_plan(text,text,text,public.neroxa_billing_interval,numeric,numeric) to authenticated;

revoke all on function public.create_neroxa_plan_feature(uuid,text,text,text,boolean,numeric) from public,anon;
grant execute on function public.create_neroxa_plan_feature(uuid,text,text,text,boolean,numeric) to authenticated;

revoke all on function public.create_neroxa_subscription(uuid,uuid,uuid,uuid,numeric,numeric,date,date) from public,anon;
grant execute on function public.create_neroxa_subscription(uuid,uuid,uuid,uuid,numeric,numeric,date,date) to authenticated;

revoke all on function public.add_neroxa_subscription_item(uuid,public.neroxa_subscription_item_type,text,text,numeric,numeric,boolean) from public,anon;
grant execute on function public.add_neroxa_subscription_item(uuid,public.neroxa_subscription_item_type,text,text,numeric,numeric,boolean) to authenticated;

revoke all on function public.transition_neroxa_subscription_status(uuid,public.neroxa_subscription_status) from public,anon;
grant execute on function public.transition_neroxa_subscription_status(uuid,public.neroxa_subscription_status) to authenticated;
