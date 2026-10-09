-- Storefront-only configuration. Does not alter catalog, pricing, cart, checkout, orders or payments.
alter table public.neroxa_storefront_settings
  add column if not exists visual_overrides jsonb not null default '{}'::jsonb;

alter table public.neroxa_storefront_settings
  drop constraint if exists neroxa_storefront_settings_visual_overrides_object;

alter table public.neroxa_storefront_settings
  add constraint neroxa_storefront_settings_visual_overrides_object
  check (jsonb_typeof(visual_overrides) = 'object');

-- Expose presentation overrides to the storefront loader. This intentionally
-- keeps the existing public catalog, product and add-on payloads unchanged.
create or replace function public.get_public_storefront_catalog(p_domain text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_instance uuid;
  v_org uuid;
  v_context jsonb;
  v_categories jsonb;
  v_products jsonb;
  v_settings jsonb;
  v_zones jsonb;
  v_addon_groups jsonb;
begin
  select x.instance_id, x.organization_id into v_instance, v_org
  from public.get_public_storefront_context(p_domain) x limit 1;
  if v_instance is null then return null; end if;

  select to_jsonb(x) into v_context from public.get_public_storefront_context(p_domain) x limit 1;

  select coalesce(jsonb_agg(to_jsonb(c) - 'instance_id' order by c.sort_order, c.name), '[]'::jsonb)
    into v_categories from public.neroxa_storefront_categories c
    where c.instance_id = v_instance and c.active;

  select coalesce(jsonb_agg(to_jsonb(p) - 'instance_id' order by p.sort_order, p.name), '[]'::jsonb)
    into v_products from public.neroxa_storefront_products p
    where p.instance_id = v_instance and p.active;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', g.id, 'name', g.name, 'required', g.required,
      'min_selections', g.min_selections, 'max_selections', g.max_selections,
      'active', g.active, 'sort_order', g.sort_order,
      'products', coalesce((
        select jsonb_agg(jsonb_build_object('product_id', l.product_id, 'sort_order', l.sort_order)
          order by l.sort_order)
        from public.neroxa_storefront_product_addon_groups l
        where l.group_id = g.id
      ), '[]'::jsonb),
      'addons', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', a.id, 'name', a.name, 'price_delta', a.price_delta,
          'active', a.active, 'sort_order', a.sort_order
        ) order by a.sort_order, a.name)
        from public.neroxa_storefront_addons a
        where a.group_id = g.id and a.active
      ), '[]'::jsonb)
    ) order by g.sort_order, g.name
  ), '[]'::jsonb) into v_addon_groups
  from public.neroxa_storefront_addon_groups g
  where g.instance_id = v_instance and g.active;

  select to_jsonb(s) - 'organization_id' into v_settings
  from public.neroxa_storefront_settings s where s.organization_id = v_org;

  if v_settings is null then
    v_settings := jsonb_build_object(
      'payment_methods', jsonb_build_array('PIX'), 'delivery_enabled', true, 'pickup_enabled', true,
      'pickup_instructions', null, 'min_order_amount', 0, 'estimated_delivery_minutes', 45,
      'estimated_pickup_minutes', 20, 'description', null, 'whatsapp_phone', null,
      'address_street', null, 'address_number', null, 'address_neighborhood', null,
      'address_city', null, 'address_state', null, 'address_zip', null, 'logo_url', null,
      'hero_image_url', null, 'hero_title', null, 'hero_subtitle', null, 'hero_cta_label', null,
      'primary_color', '145 28% 32%', 'secondary_color', '42 35% 96%', 'font_family', 'inherit',
      'social_links', '{}'::jsonb, 'half_pizza_pricing_rule', 'highest_half',
      'half_pizza_fixed_price', null, 'loyalty_points_per_currency', 0, 'scheduling_enabled', false,
      'visual_overrides', '{}'::jsonb
    );
  else
    v_settings := jsonb_set(v_settings, '{visual_overrides}', coalesce(v_settings->'visual_overrides', '{}'::jsonb), true);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', z.id, 'name', z.name, 'neighborhoods', z.neighborhoods,
    'minimum_order', z.minimum_order, 'delivery_fee', z.delivery_fee,
    'estimated_minutes', z.estimated_minutes, 'active', z.active
  ) order by z.sort_order, z.name), '[]'::jsonb) into v_zones
  from public.neroxa_storefront_delivery_zones z
  where z.organization_id = v_org and z.active;

  return jsonb_build_object(
    'context', v_context, 'categories', v_categories, 'products', v_products,
    'settings', v_settings, 'delivery_zones', v_zones, 'addon_groups', v_addon_groups
  );
end;
$function$;
