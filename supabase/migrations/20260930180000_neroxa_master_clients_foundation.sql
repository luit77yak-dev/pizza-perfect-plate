-- Neroxa Master client foundation
-- Separates the commercial/client record from the existing organization
-- without changing storefront or organization operational data.

create type public.neroxa_client_status as enum (
  'LEAD',
  'PROPOSAL',
  'NEGOTIATION',
  'CONTRACTED',
  'IMPLEMENTATION',
  'ACTIVE',
  'PAUSED',
  'DELINQUENT',
  'CANCELLED'
);

create table if not exists public.neroxa_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete restrict,
  status public.neroxa_client_status not null default 'LEAD',
  legal_name text,
  trade_name text,
  tax_id text,
  notes text,
  acquired_at timestamptz,
  contracted_at timestamptz,
  activated_at timestamptz,
  paused_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists neroxa_clients_status_idx
  on public.neroxa_clients (status);

create index if not exists neroxa_clients_updated_at_idx
  on public.neroxa_clients (updated_at desc);

create table if not exists public.neroxa_client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.neroxa_clients(id) on delete cascade,
  name text not null,
  role_title text,
  email text,
  phone text,
  whatsapp text,
  is_primary boolean not null default false,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists neroxa_client_contacts_client_id_idx
  on public.neroxa_client_contacts (client_id);

create unique index if not exists neroxa_client_contacts_primary_idx
  on public.neroxa_client_contacts (client_id)
  where is_primary and active;

create trigger neroxa_clients_set_updated_at
before update on public.neroxa_clients
for each row execute function public.set_updated_at();

create trigger neroxa_client_contacts_set_updated_at
before update on public.neroxa_client_contacts
for each row execute function public.set_updated_at();

alter table public.neroxa_clients enable row level security;
alter table public.neroxa_client_contacts enable row level security;

revoke all on table public.neroxa_clients, public.neroxa_client_contacts
from anon, authenticated;

grant select on table public.neroxa_clients, public.neroxa_client_contacts
to authenticated;

drop policy if exists neroxa_clients_staff_read on public.neroxa_clients;
create policy neroxa_clients_staff_read
  on public.neroxa_clients
  for select
  to authenticated
  using (public.has_neroxa_permission('clients.read'));

drop policy if exists neroxa_client_contacts_staff_read on public.neroxa_client_contacts;
create policy neroxa_client_contacts_staff_read
  on public.neroxa_client_contacts
  for select
  to authenticated
  using (
    public.has_neroxa_permission('clients.read')
  );

-- Mutations remain intentionally closed until the Master service/API flow
-- is defined. This prevents ad-hoc client creation before validation,
-- auditing and lifecycle rules are in place.
