-- Server-side price quote for an addition request.
-- No client-provided unit price or total is trusted.
create or replace function public.neroxa_calculate_addition_amount(
  p_instance_id uuid, p_items jsonb
)
returns numeric
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_item jsonb;
  v_product uuid;
  v_second uuid;
  v_qty integer;
  v_unit numeric;
  v_total numeric := 0;
begin
  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>50 then
    raise exception 'Invalid addition items';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) as e(value) loop
    if jsonb_typeof(v_item) <> 'object'
      or coalesce(v_item->>'quantity','') !~ '^[0-9]{1,2}$' then
      raise exception 'Invalid item quantity';
    end if;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 99 then raise exception 'Invalid item quantity'; end if;
    if coalesce(v_item->>'product_id','') !~* '^[0-9a-f-]{36}$' then
      raise exception 'Invalid product identifier';
    end if;
    v_product := (v_item->>'product_id')::uuid;
    if not exists (
      select 1 from public.neroxa_storefront_products p
      where p.id=v_product and p.instance_id=p_instance_id and p.active
        and coalesce((p.metadata->>'available')::boolean,true)
    ) then raise exception 'Product unavailable in this restaurant'; end if;
    v_second := null;
    if nullif(v_item->>'second_product_id','') is not null then
      v_second := (v_item->>'second_product_id')::uuid;
      if not exists (
        select 1 from public.neroxa_storefront_products p
        where p.id=v_second and p.instance_id=p_instance_id and p.active
          and coalesce((p.metadata->>'available')::boolean,true)
      ) then raise exception 'Second product unavailable in this restaurant'; end if;
    end if;
    v_unit := public.calculate_public_order_line_price(
      p_instance_id,v_product,v_second,
      nullif(v_item->>'size_id',''),nullif(v_item->>'crust_id',''),
      coalesce(v_item->'addons','[]'::jsonb),
      coalesce(v_item->'complements','[]'::jsonb)
    );
    if v_unit is null or v_unit < 0 then raise exception 'Invalid calculated price'; end if;
    v_total := v_total + round(v_unit*v_qty,2);
    if v_total > 9999999999.99 then raise exception 'Addition amount too large'; end if;
  end loop;
  if v_total <= 0 then raise exception 'Addition amount must be positive'; end if;
  return round(v_total,2);
end;
$fn$;

revoke all on function public.neroxa_calculate_addition_amount(uuid,jsonb)
  from public,anon,authenticated;
-- Only server-side security-definer workflows may call this helper.
