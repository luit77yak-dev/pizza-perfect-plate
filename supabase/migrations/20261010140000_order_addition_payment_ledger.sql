-- Additive payment ledger for forgotten items; no live payment confirmation.
-- Do not mark a charge PAID without a verified provider webhook or authorized manual reconciliation.
create table if not exists public.neroxa_order_addition_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.neroxa_orders(id) on delete cascade,
  instance_id uuid not null references public.neroxa_system_instances(id),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  status text not null default 'REQUESTED'
    check (status in ('REQUESTED','APPROVED','REJECTED','CANCELLED')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(id,order_id)
);

create table if not exists public.neroxa_order_addition_charges (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.neroxa_order_addition_requests(id),
  order_id uuid not null references public.neroxa_orders(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  status text not null default 'PENDING'
    check (status in ('PENDING','PAID','CANCELLED','REFUNDED')),
  provider text,
  provider_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint charge_payment_consistency check (
    (status = 'PAID' and paid_at is not null and provider_reference is not null)
    or (status <> 'PAID' and paid_at is null)
  ),
  unique(provider,provider_reference)
);

create table if not exists public.neroxa_order_addition_charge_events (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.neroxa_order_addition_charges(id),
  previous_status text,
  next_status text not null,
  actor_user_id uuid references auth.users(id),
  external_event_id text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists neroxa_addition_requests_order_idx
  on public.neroxa_order_addition_requests(order_id,requested_at desc);
create index if not exists neroxa_addition_charges_order_idx
  on public.neroxa_order_addition_charges(order_id);
create index if not exists neroxa_addition_events_charge_idx
  on public.neroxa_order_addition_charge_events(charge_id,created_at);

alter table public.neroxa_order_addition_requests enable row level security;
alter table public.neroxa_order_addition_charges enable row level security;
alter table public.neroxa_order_addition_charge_events enable row level security;
revoke all on public.neroxa_order_addition_requests from public,anon,authenticated;
revoke all on public.neroxa_order_addition_charges from public,anon,authenticated;
revoke all on public.neroxa_order_addition_charge_events from public,anon,authenticated;

-- All state changes require dedicated server-side RPCs with tenant authorization.
-- No INSERT/UPDATE/DELETE grants or public payment confirmation RPC are created here.
