REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_order_number(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_org_role(uuid, public.app_role[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_manager(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_staff(uuid) TO authenticated;

DROP POLICY categories_read ON public.categories;
CREATE POLICY categories_read_anon ON public.categories FOR SELECT TO anon
  USING (active AND deleted_at IS NULL);
CREATE POLICY categories_read_auth ON public.categories FOR SELECT TO authenticated
  USING ((active AND deleted_at IS NULL) OR public.is_org_staff(organization_id));

DROP POLICY sizes_read ON public.product_sizes;
CREATE POLICY sizes_read_anon ON public.product_sizes FOR SELECT TO anon USING (active);
CREATE POLICY sizes_read_auth ON public.product_sizes FOR SELECT TO authenticated
  USING (active OR public.is_org_staff(organization_id));

DROP POLICY products_read ON public.products;
CREATE POLICY products_read_anon ON public.products FOR SELECT TO anon
  USING (active AND deleted_at IS NULL);
CREATE POLICY products_read_auth ON public.products FOR SELECT TO authenticated
  USING ((active AND deleted_at IS NULL) OR public.is_org_staff(organization_id));

DROP POLICY crusts_read ON public.product_crusts;
CREATE POLICY crusts_read_anon ON public.product_crusts FOR SELECT TO anon USING (active);
CREATE POLICY crusts_read_auth ON public.product_crusts FOR SELECT TO authenticated
  USING (active OR public.is_org_staff(organization_id));

DROP POLICY addons_read ON public.product_addons;
CREATE POLICY addons_read_anon ON public.product_addons FOR SELECT TO anon USING (active);
CREATE POLICY addons_read_auth ON public.product_addons FOR SELECT TO authenticated
  USING (active OR public.is_org_staff(organization_id));

DROP POLICY zones_read ON public.delivery_zones;
CREATE POLICY zones_read_anon ON public.delivery_zones FOR SELECT TO anon USING (active);
CREATE POLICY zones_read_auth ON public.delivery_zones FOR SELECT TO authenticated
  USING (active OR public.is_org_staff(organization_id));