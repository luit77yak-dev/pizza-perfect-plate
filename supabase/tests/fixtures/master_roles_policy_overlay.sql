-- Real Master roles mirrored in isolated PostgreSQL; this fixture is NOT a production migration.
create type public.neroxa_organization_role as enum ('OWNER','ADMIN','MANAGER','OPERATOR');
create type public.neroxa_platform_role as enum ('SUPER_ADMIN','ADMIN','SUPPORT','FINANCE');
alter table public.neroxa_organization_members add column role public.neroxa_organization_role not null default 'OPERATOR';
alter table public.neroxa_platform_members add column role public.neroxa_platform_role not null default 'SUPPORT';

create or replace function public.neroxa_has_org_role(target_organization_id uuid, allowed_roles public.neroxa_organization_role[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
 select 1 from public.neroxa_organization_members m where m.user_id=auth.uid()
 and m.organization_id=target_organization_id and m.active
 and (allowed_roles is null or m.role=any(allowed_roles)));
$$;
create or replace function public.neroxa_has_platform_role(p_roles public.neroxa_platform_role[])
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
 select 1 from public.neroxa_platform_members m where m.user_id=auth.uid() and m.active and m.role=any(p_roles));
$$;
-- Replace fixture-only generic write policies with role-aware write policies.
drop policy if exists supplier_products_write on public.neroxa_storefront_products;
drop policy if exists supplier_settings_write on public.neroxa_storefront_settings;
drop policy if exists supplier_delivery_zones_write on public.neroxa_storefront_delivery_zones;
-- The original provisional platform-member policy is too broad for SUPPORT/FINANCE.
-- Fixture-only removal: production must reconcile all actual policy names first.
drop policy if exists supplier_categories_write on public.neroxa_storefront_categories;
drop policy if exists supplier_groups_write on public.neroxa_storefront_addon_groups;
drop policy if exists supplier_addons_write on public.neroxa_storefront_addons;
drop policy if exists supplier_links_write on public.neroxa_storefront_product_addon_groups;
create policy master_role_products_write on public.neroxa_storefront_products for all to authenticated
using (exists(select 1 from public.neroxa_system_instances i where i.id=instance_id and
 public.neroxa_has_org_role(i.organization_id,array['OWNER','ADMIN','MANAGER']::public.neroxa_organization_role[]))
 or public.neroxa_has_platform_role(array['SUPER_ADMIN','ADMIN']::public.neroxa_platform_role[]))
with check (exists(select 1 from public.neroxa_system_instances i where i.id=instance_id and
 public.neroxa_has_org_role(i.organization_id,array['OWNER','ADMIN','MANAGER']::public.neroxa_organization_role[]))
 or public.neroxa_has_platform_role(array['SUPER_ADMIN','ADMIN']::public.neroxa_platform_role[]));
create policy master_role_settings_write on public.neroxa_storefront_settings for all to authenticated
using(public.neroxa_has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.neroxa_organization_role[])
 or public.neroxa_has_platform_role(array['SUPER_ADMIN','ADMIN']::public.neroxa_platform_role[]))
with check(public.neroxa_has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.neroxa_organization_role[])
 or public.neroxa_has_platform_role(array['SUPER_ADMIN','ADMIN']::public.neroxa_platform_role[]));
create policy master_role_zones_write on public.neroxa_storefront_delivery_zones for all to authenticated
using(public.neroxa_has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.neroxa_organization_role[])
 or public.neroxa_has_platform_role(array['SUPER_ADMIN','ADMIN']::public.neroxa_platform_role[]))
with check(public.neroxa_has_org_role(organization_id,array['OWNER','ADMIN','MANAGER']::public.neroxa_organization_role[])
 or public.neroxa_has_platform_role(array['SUPER_ADMIN','ADMIN']::public.neroxa_platform_role[]));

-- Test fixture: enable instance lookups used by row policies.
grant select on public.neroxa_system_instances to authenticated;
