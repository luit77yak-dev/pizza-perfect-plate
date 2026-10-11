-- Candidate migration for isolated validation; DO NOT apply before Master schema review.
-- No production or test project database is changed by this file.
create table if not exists public.neroxa_storefront_categories (
 id uuid primary key default gen_random_uuid(),
 instance_id uuid not null references public.neroxa_system_instances(id) on delete cascade,
 name text not null, slug text not null, description text,
 active boolean not null default true, sort_order integer not null default 0,
 unique(instance_id,slug)
);
create table if not exists public.neroxa_storefront_addon_groups (
 id uuid primary key default gen_random_uuid(),
 instance_id uuid not null references public.neroxa_system_instances(id) on delete cascade,
 name text not null, required boolean not null default false,
 min_selections integer not null default 0,
 max_selections integer not null default 1,
 active boolean not null default true, sort_order integer not null default 0,
 constraint neroxa_addon_group_selection_range check(min_selections >= 0 and max_selections >= greatest(1,min_selections))
);
create table if not exists public.neroxa_storefront_addons (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.neroxa_storefront_addon_groups(id) on delete cascade,
 name text not null, price_delta numeric not null default 0 check(price_delta >= 0),
 active boolean not null default true, sort_order integer not null default 0
);
create table if not exists public.neroxa_storefront_product_addon_groups (
 product_id uuid not null references public.neroxa_storefront_products(id) on delete cascade,
 group_id uuid not null references public.neroxa_storefront_addon_groups(id) on delete cascade,
 sort_order integer not null default 0, primary key(product_id,group_id)
);
alter table public.neroxa_storefront_products
 add column if not exists category_id uuid references public.neroxa_storefront_categories(id) on delete set null,
 add column if not exists description text,
 add column if not exists sort_order integer not null default 0;

create or replace function public.neroxa_can_manage_storefront_instance(p_instance_id uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
 select auth.uid() is not null and exists (
  select 1 from public.neroxa_system_instances i
  join public.neroxa_organization_members m on m.organization_id=i.organization_id
  where i.id=p_instance_id and m.user_id=auth.uid() and m.active
 );
$fn$;
revoke all on function public.neroxa_can_manage_storefront_instance(uuid) from public, anon;
grant execute on function public.neroxa_can_manage_storefront_instance(uuid) to authenticated;

-- Anon has no direct table access; verified-domain catalog RPC is the public read path.
alter table public.neroxa_storefront_products enable row level security;
alter table public.neroxa_storefront_categories enable row level security;
alter table public.neroxa_storefront_addon_groups enable row level security;
alter table public.neroxa_storefront_addons enable row level security;
alter table public.neroxa_storefront_product_addon_groups enable row level security;
create policy supplier_products on public.neroxa_storefront_products for all to authenticated
 using (public.neroxa_can_manage_storefront_instance(instance_id))
 with check (public.neroxa_can_manage_storefront_instance(instance_id));
create policy supplier_categories on public.neroxa_storefront_categories for all to authenticated
 using (public.neroxa_can_manage_storefront_instance(instance_id))
 with check (public.neroxa_can_manage_storefront_instance(instance_id));
create policy supplier_groups on public.neroxa_storefront_addon_groups for all to authenticated
 using (public.neroxa_can_manage_storefront_instance(instance_id))
 with check (public.neroxa_can_manage_storefront_instance(instance_id));
create policy supplier_addons on public.neroxa_storefront_addons for all to authenticated
 using (exists(select 1 from public.neroxa_storefront_addon_groups g where g.id=group_id and public.neroxa_can_manage_storefront_instance(g.instance_id)))
 with check (exists(select 1 from public.neroxa_storefront_addon_groups g where g.id=group_id and public.neroxa_can_manage_storefront_instance(g.instance_id)));
create policy supplier_links on public.neroxa_storefront_product_addon_groups for all to authenticated
 using (exists(select 1 from public.neroxa_storefront_products p join public.neroxa_storefront_addon_groups g on g.id=group_id where p.id=product_id and p.instance_id=g.instance_id and public.neroxa_can_manage_storefront_instance(p.instance_id)))
 with check (exists(select 1 from public.neroxa_storefront_products p join public.neroxa_storefront_addon_groups g on g.id=group_id where p.id=product_id and p.instance_id=g.instance_id and public.neroxa_can_manage_storefront_instance(p.instance_id)));
revoke all on public.neroxa_storefront_products,public.neroxa_storefront_categories,public.neroxa_storefront_addon_groups,public.neroxa_storefront_addons,public.neroxa_storefront_product_addon_groups from anon;
grant select,insert,update,delete on public.neroxa_storefront_products,public.neroxa_storefront_categories,public.neroxa_storefront_addon_groups,public.neroxa_storefront_addons,public.neroxa_storefront_product_addon_groups to authenticated;
