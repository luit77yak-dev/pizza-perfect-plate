DROP POLICY IF EXISTS "settings_public_read" ON public.organization_settings;
CREATE POLICY "settings_public_read" ON public.organization_settings FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.active AND o.deleted_at IS NULL) OR public.is_org_staff(organization_id));

DROP POLICY IF EXISTS "special_hours_read" ON public.special_hours;
CREATE POLICY "special_hours_read" ON public.special_hours FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.active AND o.deleted_at IS NULL) OR public.is_org_staff(organization_id));

DROP POLICY IF EXISTS "prices_read" ON public.product_prices;
CREATE POLICY "prices_read" ON public.product_prices FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.products p JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.id = product_id AND p.organization_id = product_prices.organization_id AND p.active AND p.deleted_at IS NULL AND o.active AND o.deleted_at IS NULL)
  OR public.is_org_staff(organization_id));

DROP POLICY IF EXISTS "hours_read" ON public.store_hours;
CREATE POLICY "hours_read" ON public.store_hours FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.active AND o.deleted_at IS NULL) OR public.is_org_staff(organization_id));

GRANT EXECUTE ON FUNCTION public.is_org_staff(uuid) TO anon;