-- Expose only storefront-safe organization settings to public visitors.
-- The base organization_settings table remains restricted to managers.
CREATE OR REPLACE FUNCTION public.get_public_storefront_settings(p_org uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'organization_id', s.organization_id,
    'description', s.description,
    'whatsapp_phone', s.whatsapp_phone,
    'logo_url', s.logo_url,
    'hero_image_url', s.hero_image_url,
    'hero_title', s.hero_title,
    'hero_subtitle', s.hero_subtitle,
    'hero_cta_label', s.hero_cta_label,
    'primary_color', s.primary_color,
    'secondary_color', s.secondary_color,
    'font_family', s.font_family,
    'payment_methods', s.payment_methods,
    'delivery_enabled', s.delivery_enabled,
    'pickup_enabled', s.pickup_enabled,
    'pickup_instructions', s.pickup_instructions,
    'min_order_amount', s.min_order_amount,
    'estimated_delivery_minutes', s.estimated_delivery_minutes,
    'estimated_pickup_minutes', s.estimated_pickup_minutes,
    'half_pizza_pricing_rule', s.half_pizza_pricing_rule,
    'half_pizza_fixed_price', s.half_pizza_fixed_price
  )
  FROM public.organization_settings s
  JOIN public.organizations o ON o.id = s.organization_id
  WHERE s.organization_id = p_org
    AND o.active
    AND o.deleted_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_storefront_settings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_storefront_settings(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS settings_public_read ON public.organization_settings;
