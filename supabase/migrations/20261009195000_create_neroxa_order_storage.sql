-- Canonical Neroxa order storage must exist before checkout binds create_public_order to it.
-- This migration expects the shared Neroxa master/storefront foundation tables to be present.

create table if not exists public.neroxa_orders (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.neroxa_system_instances(id) on delete cascade,
  organization_id uuid not null references public.neroxa_organizations(id) on delete cascade,
  order_number bigint not null,
  customer_name text not null,
  customer_phone text not null,
  fulfillment text not null check (fulfillment in ('DELIVERY','PICKUP')),
  payment_method text not null check (payment_method in ('CASH','PIX','CARD_ON_DELIVERY','CARD_ON_SITE')),
  status text not null default 'RECEIVED'
    check (status in ('RECEIVED','CONFIRMED','PREPARING','READY','OUT_FOR_DELIVERY','DELIVERED','CANCELLED')),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  address_street text,
  address_number text,
  address_neighborhood text,
  address_complement text,
  address_reference text,
  notes text,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  out_for_delivery_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz
);

create table if not exists public.neroxa_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.neroxa_orders(id) on delete cascade,
  product_id uuid references public.neroxa_storefront_products(id) on delete set null,
  product_name text not null,
  product_image_url text,
  second_product_id uuid references public.neroxa_storefront_products(id) on delete set null,
  second_product_name text,
  is_half boolean not null default false,
  size_id uuid,
  size_name text,
  crust_id uuid,
  crust_name text,
  crust_price numeric(12,2) not null default 0,
  addons jsonb not null default '[]'::jsonb,
  complements jsonb not null default '[]'::jsonb,
  quantity integer not null check (quantity between 1 and 99),
  notes text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.neroxa_order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.neroxa_orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists neroxa_orders_instance_order_number_uidx
  on public.neroxa_orders(instance_id, order_number);
create unique index if not exists neroxa_orders_instance_idempotency_uidx
  on public.neroxa_orders(instance_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists neroxa_orders_instance_created_idx
  on public.neroxa_orders(instance_id, created_at desc);
create index if not exists neroxa_orders_instance_status_idx
  on public.neroxa_orders(instance_id, status);
create index if not exists neroxa_order_items_order_idx
  on public.neroxa_order_items(order_id);
create index if not exists neroxa_order_status_history_order_idx
  on public.neroxa_order_status_history(order_id, created_at);

alter table public.neroxa_orders enable row level security;
alter table public.neroxa_order_items enable row level security;
alter table public.neroxa_order_status_history enable row level security;

revoke all on public.neroxa_orders from anon, authenticated;
revoke all on public.neroxa_order_items from anon, authenticated;
revoke all on public.neroxa_order_status_history from anon, authenticated;
