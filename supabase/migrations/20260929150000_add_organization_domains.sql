create table if not exists public.organization_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint organization_domains_domain_unique unique (domain)
);

create index if not exists organization_domains_organization_id_idx
  on public.organization_domains (organization_id);

create index if not exists organization_domains_active_domain_idx
  on public.organization_domains (domain)
  where active = true;

alter table public.organization_domains enable row level security;

drop policy if exists organization_domains_public_read on public.organization_domains;
create policy organization_domains_public_read
  on public.organization_domains
  for select
  to anon, authenticated
  using (active = true);

grant select on public.organization_domains to anon, authenticated;
