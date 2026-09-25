REVOKE EXECUTE ON FUNCTION public.is_org_staff(uuid) FROM anon;
DO $$ DECLARE t text; p text; BEGIN
FOR t, p IN SELECT * FROM (VALUES ('organization_settings','settings_public_read'),('special_hours','special_hours_read'),('store_hours','hours_read')) v LOOP
  EXECUTE format('DROP POLICY %I ON public.%I', p, t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.active AND o.deleted_at IS NULL))', p||'_anon', t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.active AND o.deleted_at IS NULL) OR public.is_org_staff(organization_id))', p, t);
END LOOP; END $$;
DROP POLICY "prices_read" ON public.product_prices;
CREATE POLICY "prices_read_anon" ON public.product_prices FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.products p JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.id = product_id AND p.organization_id = product_prices.organization_id AND p.active AND p.deleted_at IS NULL AND o.active AND o.deleted_at IS NULL));
CREATE POLICY "prices_read" ON public.product_prices FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.products p JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.id = product_id AND p.organization_id = product_prices.organization_id AND p.active AND p.deleted_at IS NULL AND o.active AND o.deleted_at IS NULL)
  OR public.is_org_staff(organization_id));