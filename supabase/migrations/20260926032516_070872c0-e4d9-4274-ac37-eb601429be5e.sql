CREATE OR REPLACE FUNCTION public.prevent_organization_id_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id cannot be changed';
  END IF;
  RETURN NEW;
END; $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organization_members','organization_settings','categories','product_sizes','products','product_prices','product_crusts','product_addons','coupons','delivery_zones','drivers','store_hours','special_hours','orders','order_items','order_item_addons','order_status_history','loyalty_accounts','loyalty_transactions','audit_logs']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS prevent_organization_id_change_%1$s ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER prevent_organization_id_change_%1$s BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.prevent_organization_id_change()', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_public_storefront_settings(p_org uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'organization_id', s.organization_id, 'description', s.description, 'whatsapp_phone', s.whatsapp_phone,
    'logo_url', s.logo_url, 'hero_image_url', s.hero_image_url, 'hero_title', s.hero_title,
    'hero_subtitle', s.hero_subtitle, 'hero_cta_label', s.hero_cta_label, 'primary_color', s.primary_color,
    'secondary_color', s.secondary_color, 'font_family', s.font_family, 'payment_methods', s.payment_methods,
    'delivery_enabled', s.delivery_enabled, 'pickup_enabled', s.pickup_enabled, 'pickup_instructions', s.pickup_instructions,
    'min_order_amount', s.min_order_amount, 'estimated_delivery_minutes', s.estimated_delivery_minutes,
    'estimated_pickup_minutes', s.estimated_pickup_minutes, 'half_pizza_pricing_rule', s.half_pizza_pricing_rule,
    'half_pizza_fixed_price', s.half_pizza_fixed_price)
  FROM public.organization_settings s JOIN public.organizations o ON o.id = s.organization_id
  WHERE s.organization_id = p_org AND o.active AND o.deleted_at IS NULL LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_storefront_settings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_storefront_settings(uuid) TO anon, authenticated;
DROP POLICY IF EXISTS settings_public_read ON public.organization_settings;

DROP POLICY IF EXISTS prices_read ON public.product_prices;
CREATE POLICY prices_read ON public.product_prices FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = product_prices.organization_id AND o.active AND o.deleted_at IS NULL));

DROP POLICY IF EXISTS orders_staff_update ON public.orders;
DROP POLICY IF EXISTS orders_manager_update ON public.orders;
CREATE POLICY orders_manager_update ON public.orders FOR UPDATE TO authenticated
USING (public.is_org_manager(organization_id)) WITH CHECK (public.is_org_manager(organization_id));
DROP POLICY IF EXISTS status_hist_staff_insert ON public.order_status_history;

CREATE OR REPLACE FUNCTION public.update_order_status(p_order_id uuid, p_organization_id uuid, p_status public.order_status, p_note text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_org_staff(p_organization_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.orders SET status = p_status, updated_at = now() WHERE id = p_order_id AND organization_id = p_organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  INSERT INTO public.order_status_history (organization_id, order_id, status, note)
  VALUES (p_organization_id, p_order_id, p_status, NULLIF(trim(COALESCE(p_note, '')), ''));
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.update_order_status(uuid, uuid, public.order_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, uuid, public.order_status, text) TO authenticated;