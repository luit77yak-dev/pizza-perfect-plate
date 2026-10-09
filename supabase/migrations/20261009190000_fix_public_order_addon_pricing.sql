-- Fix public order pricing for normalized addon groups while preserving legacy product-based addons.
-- This migration is committed to the development branch only; it is not applied to Supabase.

create or replace function public.calculate_public_order_line_price(
  p_instance_id uuid,
  p_product_id uuid,
  p_second_product_id uuid,
  p_size_id text,
  p_crust_id text,
  p_addons jsonb,
  p_complements jsonb
)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_product record;
  v_second record;
  v_org uuid;
  v_rule text := 'highest_half';
  v_fixed numeric;
  v_base numeric := 0;
  v_second_base numeric := 0;
  v_crust numeric := 0;
  v_addons numeric := 0;
  v_complements numeric := 0;
  v_choice jsonb;
  v_item jsonb;
  v_id uuid;
  v_addon_price numeric;
  v_selected_addon_count integer;
begin
  select p.*, i.organization_id
    into v_product
  from public.neroxa_storefront_products p
  join public.neroxa_system_instances i on i.id = p.instance_id
  where p.id = p_product_id
    and p.instance_id = p_instance_id
    and p.active
    and coalesce((p.metadata->>'available')::boolean, true);

  if not found then
    raise exception 'Produto não disponível';
  end if;

  v_org := v_product.organization_id;

  select s.half_pizza_pricing_rule, s.half_pizza_fixed_price
    into v_rule, v_fixed
  from public.neroxa_storefront_settings s
  where s.organization_id = v_org;

  v_base := coalesce(v_product.price, 0);

  if p_size_id is not null then
    select choice into v_choice
    from jsonb_array_elements(coalesce(v_product.metadata->'options', '[]'::jsonb)) opt
    cross join lateral jsonb_array_elements(coalesce(opt->'choices', '[]'::jsonb)) choice
    where opt->>'id' = 'tamanho'
      and choice->>'id' = p_size_id
    limit 1;
    if v_choice is null then raise exception 'Tamanho não disponível para o produto'; end if;
    v_base := v_base + coalesce((v_choice->>'price')::numeric, 0);
  end if;

  if p_second_product_id is not null then
    select * into v_second
    from public.neroxa_storefront_products
    where id = p_second_product_id
      and instance_id = p_instance_id
      and active
      and coalesce((metadata->>'available')::boolean, true);

    if not found then raise exception 'Segundo sabor não disponível'; end if;
    if coalesce(v_second.metadata->>'kind', '') <> 'PIZZA' then
      raise exception 'O segundo sabor precisa ser uma pizza';
    end if;

    v_second_base := coalesce(v_second.price, 0);
    if p_size_id is not null then
      v_choice := null;
      select choice into v_choice
      from jsonb_array_elements(coalesce(v_second.metadata->'options', '[]'::jsonb)) opt
      cross join lateral jsonb_array_elements(coalesce(opt->'choices', '[]'::jsonb)) choice
      where opt->>'id' = 'tamanho'
        and choice->>'id' = p_size_id
      limit 1;
      if v_choice is null then raise exception 'Tamanho não disponível para o segundo sabor'; end if;
      v_second_base := v_second_base + coalesce((v_choice->>'price')::numeric, 0);
    end if;

    if coalesce(v_rule, 'highest_half') = 'average_halves' then
      v_base := (v_base + v_second_base) / 2;
    elsif coalesce(v_rule, 'highest_half') = 'fixed_price' and v_fixed is not null then
      v_base := v_fixed;
    else
      v_base := greatest(v_base, v_second_base);
    end if;
  end if;

  if p_crust_id is not null then
    v_choice := null;
    select choice into v_choice
    from jsonb_array_elements(coalesce(v_product.metadata->'options', '[]'::jsonb)) opt
    cross join lateral jsonb_array_elements(coalesce(opt->'choices', '[]'::jsonb)) choice
    where opt->>'id' = 'borda'
      and choice->>'id' = p_crust_id
    limit 1;
    if v_choice is null then raise exception 'Borda não disponível para o produto'; end if;
    v_crust := coalesce((v_choice->>'price')::numeric, 0);
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_addons, '[]'::jsonb)) loop
    v_id := nullif(v_item->>'id', '')::uuid;
    if v_id is null then raise exception 'Adicional inválido'; end if;

    -- Preferred path: normalized addon belongs to an active group assigned to
    -- the selected product (or either half of a half-and-half pizza).
    select a.price_delta into v_addon_price
    from public.neroxa_storefront_addons a
    join public.neroxa_storefront_addon_groups g on g.id = a.group_id
    join public.neroxa_storefront_product_addon_groups l on l.group_id = g.id
    where a.id = v_id
      and a.active
      and g.active
      and g.instance_id = p_instance_id
      and l.product_id in (p_product_id, p_second_product_id)
    limit 1;

    if not found then
      -- Backward compatibility for legacy addons represented as products.
      select p.price into v_addon_price
      from public.neroxa_storefront_products p
      where p.id = v_id
        and p.instance_id = p_instance_id
        and p.active
        and coalesce((p.metadata->>'available')::boolean, true)
        and exists (
          select 1
          from public.neroxa_storefront_categories c
          where c.id = p.category_id
            and c.instance_id = p_instance_id
            and c.active
            and lower(c.name) like '%adicional%'
        )
        and exists (
          select 1
          from public.neroxa_storefront_product_addons pa
          where pa.addon_id = p.id
            and pa.product_id in (p_product_id, p_second_product_id)
        )
      limit 1;

      if not found then raise exception 'Adicional não disponível para este produto'; end if;
    end if;

    v_addons := v_addons + coalesce(v_addon_price, 0);
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_complements, '[]'::jsonb)) loop
    v_id := nullif(v_item->>'productId', '')::uuid;
    if v_id is null then raise exception 'Acompanhamento inválido'; end if;

    select p.price into v_addon_price
    from public.neroxa_storefront_products p
    where p.id = v_id
      and p.instance_id = p_instance_id
      and p.active
      and coalesce((p.metadata->>'available')::boolean, true);

    if not found then raise exception 'Acompanhamento não disponível'; end if;
    v_complements := v_complements + coalesce(v_addon_price, 0);
  end loop;

  return v_base + v_crust + v_addons + v_complements;
end;
$function$;
