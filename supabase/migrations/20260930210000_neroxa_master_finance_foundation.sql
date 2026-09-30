-- Neroxa Master finance foundation
-- Invoices are immutable commercial snapshots; payments are separate records.

create type public.neroxa_invoice_status as enum (
  'PENDING','PAID','OVERDUE','CANCELLED','REFUNDED','NEGOTIATION'
);

create type public.neroxa_invoice_item_type as enum (
  'SUBSCRIPTION','ADD_ON','SERVICE','SETUP','ADJUSTMENT'
);

create type public.neroxa_payment_status as enum (
  'PENDING','CONFIRMED','FAILED','REFUNDED','CANCELLED'
);

create type public.neroxa_payment_method as enum (
  'PIX','CARD','BOLETO','BANK_TRANSFER','CASH','OTHER'
);

create table if not exists public.neroxa_invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.neroxa_clients(id) on delete restrict,
  subscription_id uuid references public.neroxa_subscriptions(id) on delete restrict,
  invoice_number text not null unique,
  status public.neroxa_invoice_status not null default 'PENDING',
  issue_date date not null default current_date,
  due_date date not null,
  paid_at timestamptz,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists neroxa_invoices_client_idx
  on public.neroxa_invoices(client_id);
create index if not exists neroxa_invoices_subscription_idx
  on public.neroxa_invoices(subscription_id);
create index if not exists neroxa_invoices_status_idx
  on public.neroxa_invoices(status);
create index if not exists neroxa_invoices_due_date_idx
  on public.neroxa_invoices(due_date)
  where status in ('PENDING','OVERDUE','NEGOTIATION');

create table if not exists public.neroxa_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.neroxa_invoices(id) on delete cascade,
  item_type public.neroxa_invoice_item_type not null,
  name text not null,
  description text,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total_price numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default now()
);

create index if not exists neroxa_invoice_items_invoice_idx
  on public.neroxa_invoice_items(invoice_id);

create table if not exists public.neroxa_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.neroxa_invoices(id) on delete restrict,
  client_id uuid not null references public.neroxa_clients(id) on delete restrict,
  status public.neroxa_payment_status not null default 'PENDING',
  method public.neroxa_payment_method not null,
  amount numeric(12,2) not null check (amount > 0),
  paid_at timestamptz,
  external_reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists neroxa_payments_invoice_idx
  on public.neroxa_payments(invoice_id);
create index if not exists neroxa_payments_client_idx
  on public.neroxa_payments(client_id);
create index if not exists neroxa_payments_status_idx
  on public.neroxa_payments(status);
create index if not exists neroxa_payments_paid_at_idx
  on public.neroxa_payments(paid_at)
  where status = 'CONFIRMED';

create trigger neroxa_invoices_set_updated_at
before update on public.neroxa_invoices
for each row execute function public.set_updated_at();

create trigger neroxa_payments_set_updated_at
before update on public.neroxa_payments
for each row execute function public.set_updated_at();

alter table public.neroxa_invoices enable row level security;
alter table public.neroxa_invoice_items enable row level security;
alter table public.neroxa_payments enable row level security;

revoke all on table
  public.neroxa_invoices,
  public.neroxa_invoice_items,
  public.neroxa_payments
from anon, authenticated;

grant select on table
  public.neroxa_invoices,
  public.neroxa_invoice_items,
  public.neroxa_payments
to authenticated;

insert into public.neroxa_permissions(key,name,description) values
  ('billing.read','Visualizar financeiro','Consultar faturas, pagamentos e inadimplência.'),
  ('billing.write','Gerenciar financeiro','Criar faturas, registrar pagamentos e atualizar o financeiro.')
on conflict(key) do nothing;

insert into public.neroxa_role_permissions(role_id,permission_id)
select r.id,p.id
from public.neroxa_roles r
join public.neroxa_permissions p on p.key in ('billing.read','billing.write')
where r.key='super_admin'
on conflict do nothing;

insert into public.neroxa_role_permissions(role_id,permission_id)
select r.id,p.id
from public.neroxa_roles r
join public.neroxa_permissions p on p.key='billing.read'
where r.key in ('admin','finance')
on conflict do nothing;

create policy neroxa_invoices_staff_read
on public.neroxa_invoices
for select to authenticated
using (public.has_neroxa_permission('billing.read'));

create policy neroxa_invoice_items_staff_read
on public.neroxa_invoice_items
for select to authenticated
using (public.has_neroxa_permission('billing.read'));

create policy neroxa_payments_staff_read
on public.neroxa_payments
for select to authenticated
using (public.has_neroxa_permission('billing.read'));

create or replace function public.create_neroxa_invoice(
  p_client_id uuid,
  p_invoice_number text,
  p_due_date date,
  p_subscription_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_number text := nullif(trim(coalesce(p_invoice_number,'')),'');
  v_subscription_client uuid;
begin
  if not public.has_neroxa_permission('billing.write') then
    raise exception 'not authorized';
  end if;
  if v_number is null then raise exception 'invoice number is required'; end if;
  if p_due_date is null then raise exception 'due date is required'; end if;

  if not exists (
    select 1 from public.neroxa_clients c
    where c.id=p_client_id and c.status <> 'CANCELLED'
  ) then
    raise exception 'active client not found';
  end if;

  if p_subscription_id is not null then
    select s.client_id into v_subscription_client
    from public.neroxa_subscriptions s
    where s.id=p_subscription_id;
    if v_subscription_client is null or v_subscription_client <> p_client_id then
      raise exception 'subscription does not belong to client';
    end if;
  end if;

  insert into public.neroxa_invoices(
    client_id,subscription_id,invoice_number,due_date,notes,created_by
  )
  values(
    p_client_id,p_subscription_id,v_number,p_due_date,
    nullif(trim(coalesce(p_notes,'')),''),auth.uid()
  )
  returning id into v_id;

  perform public.record_neroxa_audit(
    'INVOICE_CREATED','neroxa_invoice',v_id,null,null,
    jsonb_build_object('client_id',p_client_id,'subscription_id',p_subscription_id,
      'invoice_number',v_number,'due_date',p_due_date,'status','PENDING'),null
  );
  return v_id;
end
$$;

create or replace function public.add_neroxa_invoice_item(
  p_invoice_id uuid,
  p_item_type public.neroxa_invoice_item_type,
  p_name text,
  p_description text default null,
  p_quantity numeric default 1,
  p_unit_price numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_name text := nullif(trim(coalesce(p_name,'')),'');
  v_invoice_status public.neroxa_invoice_status;
begin
  if not public.has_neroxa_permission('billing.write') then raise exception 'not authorized'; end if;
  if v_name is null then raise exception 'invoice item name is required'; end if;
  if p_quantity <= 0 or p_unit_price < 0 then raise exception 'invalid invoice item values'; end if;

  select i.status into v_invoice_status from public.neroxa_invoices i where i.id=p_invoice_id;
  if v_invoice_status is null or v_invoice_status not in ('PENDING','NEGOTIATION') then
    raise exception 'invoice not editable';
  end if;

  insert into public.neroxa_invoice_items(invoice_id,item_type,name,description,quantity,unit_price)
  values(p_invoice_id,p_item_type,v_name,nullif(trim(coalesce(p_description,'')),''),p_quantity,p_unit_price)
  returning id into v_id;

  update public.neroxa_invoices i
  set subtotal = coalesce((select sum(ii.total_price) from public.neroxa_invoice_items ii where ii.invoice_id=i.id),0),
      total_amount = greatest(0,coalesce((select sum(ii.total_price) from public.neroxa_invoice_items ii where ii.invoice_id=i.id),0) - i.discount_amount)
  where i.id=p_invoice_id;

  perform public.record_neroxa_audit(
    'INVOICE_ITEM_ADDED','neroxa_invoice_item',v_id,null,null,
    jsonb_build_object('invoice_id',p_invoice_id,'item_type',p_item_type,'name',v_name,
      'quantity',p_quantity,'unit_price',p_unit_price),null
  );
  return v_id;
end
$$;

create or replace function public.transition_neroxa_invoice_status(
  p_invoice_id uuid,
  p_new_status public.neroxa_invoice_status
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_current public.neroxa_invoice_status;
  v_before jsonb;
  v_after jsonb;
begin
  if not public.has_neroxa_permission('billing.write') then raise exception 'not authorized'; end if;
  select i.status,to_jsonb(i) into v_current,v_before
  from public.neroxa_invoices i where i.id=p_invoice_id;
  if v_before is null then raise exception 'invoice not found'; end if;
  if v_current=p_new_status then return true; end if;

  if not (
    (v_current='PENDING' and p_new_status in ('PAID','OVERDUE','CANCELLED','NEGOTIATION'))
    or (v_current='NEGOTIATION' and p_new_status in ('PENDING','PAID','CANCELLED','OVERDUE'))
    or (v_current='OVERDUE' and p_new_status in ('PAID','NEGOTIATION','CANCELLED'))
    or (v_current='PAID' and p_new_status in ('REFUNDED'))
  ) then
    raise exception 'invalid invoice status transition from % to %',v_current,p_new_status;
  end if;

  update public.neroxa_invoices
  set status=p_new_status,
      paid_at=case when p_new_status='PAID' then coalesce(paid_at,now()) else paid_at end
  where id=p_invoice_id;

  select to_jsonb(i) into v_after from public.neroxa_invoices i where i.id=p_invoice_id;

  perform public.record_neroxa_audit(
    'INVOICE_STATUS_CHANGED','neroxa_invoice',p_invoice_id,null,v_before,v_after,
    jsonb_build_object('from_status',v_current,'to_status',p_new_status)
  );
  return true;
end
$$;

create or replace function public.record_neroxa_payment(
  p_invoice_id uuid,
  p_method public.neroxa_payment_method,
  p_amount numeric,
  p_paid_at timestamptz default null,
  p_external_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_client_id uuid;
  v_total numeric;
  v_confirmed numeric;
  v_payment_status public.neroxa_payment_status := 'CONFIRMED';
begin
  if not public.has_neroxa_permission('billing.write') then raise exception 'not authorized'; end if;
  if p_amount <= 0 then raise exception 'payment amount must be positive'; end if;

  select i.client_id,i.total_amount into v_client_id,v_total
  from public.neroxa_invoices i where i.id=p_invoice_id and i.status <> 'CANCELLED';
  if v_client_id is null then raise exception 'invoice not found'; end if;

  select coalesce(sum(p.amount),0) into v_confirmed
  from public.neroxa_payments p
  where p.invoice_id=p_invoice_id and p.status='CONFIRMED';

  if v_confirmed + p_amount > v_total then raise exception 'payment exceeds invoice balance'; end if;

  insert into public.neroxa_payments(
    invoice_id,client_id,status,method,amount,paid_at,external_reference,notes,created_by
  )
  values(
    p_invoice_id,v_client_id,v_payment_status,p_method,p_amount,
    coalesce(p_paid_at,now()),nullif(trim(coalesce(p_external_reference,'')),''),
    nullif(trim(coalesce(p_notes,'')),''),auth.uid()
  )
  returning id into v_id;

  if v_confirmed + p_amount >= v_total then
    update public.neroxa_invoices set status='PAID',paid_at=coalesce(p_paid_at,now()) where id=p_invoice_id;
  end if;

  perform public.record_neroxa_audit(
    'PAYMENT_RECORDED','neroxa_payment',v_id,null,null,
    jsonb_build_object('invoice_id',p_invoice_id,'amount',p_amount,'method',p_method),null
  );
  return v_id;
end
$$;

revoke all on function public.create_neroxa_invoice(uuid,text,date,uuid,text) from public,anon;
grant execute on function public.create_neroxa_invoice(uuid,text,date,uuid,text) to authenticated;
revoke all on function public.add_neroxa_invoice_item(uuid,public.neroxa_invoice_item_type,text,text,numeric,numeric) from public,anon;
grant execute on function public.add_neroxa_invoice_item(uuid,public.neroxa_invoice_item_type,text,text,numeric,numeric) to authenticated;
revoke all on function public.transition_neroxa_invoice_status(uuid,public.neroxa_invoice_status) from public,anon;
grant execute on function public.transition_neroxa_invoice_status(uuid,public.neroxa_invoice_status) to authenticated;
revoke all on function public.record_neroxa_payment(uuid,public.neroxa_payment_method,numeric,timestamptz,text,text) from public,anon;
grant execute on function public.record_neroxa_payment(uuid,public.neroxa_payment_method,numeric,timestamptz,text,text) to authenticated;
