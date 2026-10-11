-- STAGED ONLY: do not apply until shared Neroxa Master schema/grants are reviewed.
-- Store settings and delivery zones belong to an organization, not an instance.
create or replace function public.neroxa_can_manage_storefront_organization(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
 select auth.uid() is not null and (
  exists (
   select 1 from public.neroxa_organizations o
   join public.neroxa_organization_members m on m.organization_id=o.id
   where o.id=p_organization_id and o.active and m.user_id=auth.uid() and m.active
  )
  or (
   exists (select 1 from public.neroxa_organizations o where o.id=p_organization_id and o.active)
   and exists (select 1 from public.neroxa_platform_members p where p.user_id=auth.uid() and p.active)
  )
 );
$fn$;
revoke all on function public.neroxa_can_manage_storefront_organization(uuid) from public, anon;
grant execute on function public.neroxa_can_manage_storefront_organization(uuid) to authenticated;

alter table public.neroxa_storefront_settings enable row level security;
alter table public.neroxa_storefront_delivery_zones enable row level security;
create policy supplier_settings on public.neroxa_storefront_settings for all to authenticated
 using (public.neroxa_can_manage_storefront_organization(organization_id))
 with check (public.neroxa_can_manage_storefront_organization(organization_id));
create policy supplier_delivery_zones on public.neroxa_storefront_delivery_zones for all to authenticated
 using (public.neroxa_can_manage_storefront_organization(organization_id))
 with check (public.neroxa_can_manage_storefront_organization(organization_id));
revoke all on public.neroxa_storefront_settings, public.neroxa_storefront_delivery_zones from anon;
grant select,insert,update,delete on public.neroxa_storefront_settings, public.neroxa_storefront_delivery_zones to authenticated;
