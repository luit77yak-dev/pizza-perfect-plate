create table if not exists public.product_addon_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  addon_id uuid not null references public.product_addons(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, addon_id)
);

create index if not exists product_addon_links_organization_id_idx
  on public.product_addon_links (organization_id);

create index if not exists product_addon_links_product_id_idx
  on public.product_addon_links (product_id);

alter table public.product_addon_links enable row level security;

create policy "Public can view product addon links"
on public.product_addon_links
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    join public.product_addons a on a.id = product_addon_links.addon_id
    where p.id = product_addon_links.product_id
      and p.organization_id = product_addon_links.organization_id
      and p.active
      and p.available
      and a.organization_id = product_addon_links.organization_id
      and a.active
  )
);

create policy "Owners and admins can manage product addon links"
on public.product_addon_links
for all
to authenticated
using (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = product_addon_links.organization_id
      and m.user_id = auth.uid()
      and m.active
      and m.role in ('OWNER', 'ADMIN')
  )
)
with check (
  exists (
    select 1
    from public.organization_members m
    where m.organization_id = product_addon_links.organization_id
      and m.user_id = auth.uid()
      and m.active
      and m.role in ('OWNER', 'ADMIN')
  )
);

insert into public.product_addon_links (organization_id, product_id, addon_id, sort_order)
select p.organization_id, p.id, a.id, a.sort_order
from public.products p
join public.product_addons a on a.organization_id = p.organization_id
where p.active and a.active
on conflict (product_id, addon_id) do nothing;
