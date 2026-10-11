-- CANDIDATE: least-privilege writes until authoritative organization roles are available.
-- Master test schema has active membership but no organization role column.
-- Active members retain tenant-scoped SELECT; only active platform members may mutate.
-- This is deliberately restrictive; do not deploy before real Master authorization review.
create or replace function public.neroxa_can_write_storefront_organization(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
 select auth.uid() is not null
 and exists(select 1 from public.neroxa_organizations o where o.id=p_organization_id and o.active)
 and exists(select 1 from public.neroxa_platform_members p where p.user_id=auth.uid() and p.active);
$fn$;
revoke all on function public.neroxa_can_write_storefront_organization(uuid) from public,anon;
grant execute on function public.neroxa_can_write_storefront_organization(uuid) to authenticated;
create or replace function public.neroxa_can_write_storefront_instance(p_instance_id uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
 select exists(select 1 from public.neroxa_system_instances i
 where i.id=p_instance_id and public.neroxa_can_write_storefront_organization(i.organization_id));
$fn$;
revoke all on function public.neroxa_can_write_storefront_instance(uuid) from public,anon;
grant execute on function public.neroxa_can_write_storefront_instance(uuid) to authenticated;

drop policy if exists supplier_products on public.neroxa_storefront_products;
drop policy if exists supplier_categories on public.neroxa_storefront_categories;
drop policy if exists supplier_groups on public.neroxa_storefront_addon_groups;
drop policy if exists supplier_addons on public.neroxa_storefront_addons;
drop policy if exists supplier_links on public.neroxa_storefront_product_addon_groups;
drop policy if exists supplier_settings on public.neroxa_storefront_settings;
drop policy if exists supplier_delivery_zones on public.neroxa_storefront_delivery_zones;

create policy supplier_products_read on public.neroxa_storefront_products for select to authenticated using(public.neroxa_can_manage_storefront_instance(instance_id));
create policy supplier_products_write on public.neroxa_storefront_products for all to authenticated using(public.neroxa_can_write_storefront_instance(instance_id)) with check(public.neroxa_can_write_storefront_instance(instance_id));
create policy supplier_categories_read on public.neroxa_storefront_categories for select to authenticated using(public.neroxa_can_manage_storefront_instance(instance_id));
create policy supplier_categories_write on public.neroxa_storefront_categories for all to authenticated using(public.neroxa_can_write_storefront_instance(instance_id)) with check(public.neroxa_can_write_storefront_instance(instance_id));
create policy supplier_groups_read on public.neroxa_storefront_addon_groups for select to authenticated using(public.neroxa_can_manage_storefront_instance(instance_id));
create policy supplier_groups_write on public.neroxa_storefront_addon_groups for all to authenticated using(public.neroxa_can_write_storefront_instance(instance_id)) with check(public.neroxa_can_write_storefront_instance(instance_id));
create policy supplier_addons_read on public.neroxa_storefront_addons for select to authenticated using(exists(select 1 from public.neroxa_storefront_addon_groups g where g.id=group_id and public.neroxa_can_manage_storefront_instance(g.instance_id)));
create policy supplier_addons_write on public.neroxa_storefront_addons for all to authenticated using(exists(select 1 from public.neroxa_storefront_addon_groups g where g.id=group_id and public.neroxa_can_write_storefront_instance(g.instance_id))) with check(exists(select 1 from public.neroxa_storefront_addon_groups g where g.id=group_id and public.neroxa_can_write_storefront_instance(g.instance_id)));
create policy supplier_links_read on public.neroxa_storefront_product_addon_groups for select to authenticated using(exists(select 1 from public.neroxa_storefront_products p join public.neroxa_storefront_addon_groups g on g.id=group_id where p.id=product_id and p.instance_id=g.instance_id and public.neroxa_can_manage_storefront_instance(p.instance_id)));
create policy supplier_links_write on public.neroxa_storefront_product_addon_groups for all to authenticated using(exists(select 1 from public.neroxa_storefront_products p join public.neroxa_storefront_addon_groups g on g.id=group_id where p.id=product_id and p.instance_id=g.instance_id and public.neroxa_can_write_storefront_instance(p.instance_id))) with check(exists(select 1 from public.neroxa_storefront_products p join public.neroxa_storefront_addon_groups g on g.id=group_id where p.id=product_id and p.instance_id=g.instance_id and public.neroxa_can_write_storefront_instance(p.instance_id)));
create policy supplier_settings_read on public.neroxa_storefront_settings for select to authenticated using(public.neroxa_can_manage_storefront_organization(organization_id));
create policy supplier_settings_write on public.neroxa_storefront_settings for all to authenticated using(public.neroxa_can_write_storefront_organization(organization_id)) with check(public.neroxa_can_write_storefront_organization(organization_id));
create policy supplier_delivery_zones_read on public.neroxa_storefront_delivery_zones for select to authenticated using(public.neroxa_can_manage_storefront_organization(organization_id));
create policy supplier_delivery_zones_write on public.neroxa_storefront_delivery_zones for all to authenticated using(public.neroxa_can_write_storefront_organization(organization_id)) with check(public.neroxa_can_write_storefront_organization(organization_id));
