-- Unify public checkout, tracking, add-ons and admin order operations on the Neroxa storefront model.
-- Development branch only. Review and apply separately; this does not change any deployed database.

-- Canonical order tables are created before checkout in 20261009195000_create_neroxa_order_storage.sql.

create index if not exists neroxa_orders_instance_created_idx
  on public.neroxa_orders(instance_id, created_at desc);
create index if not exists neroxa_orders_instance_status_idx
  on public.neroxa_orders(instance_id, status);
create index if not exists neroxa_order_items_order_idx
  on public.neroxa_order_items(order_id);
create index if not exists neroxa_order_status_history_order_idx
  on public.neroxa_order_status_history(order_id, created_at);

alter table public.neroxa_orders enable row level security;
alter table public.neroxa_order_items enable row level security;
alter table public.neroxa_order_status_history enable row level security;

-- All public access goes through narrowly scoped SECURITY DEFINER RPCs.
revoke all on public.neroxa_orders from anon, authenticated;
revoke all on public.neroxa_order_items from anon, authenticated;
revoke all on public.neroxa_order_status_history from anon, authenticated;

create or replace function public.get_public_order_status(
  p_order_id uuid,
  p_customer_phone text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id, 'order_id', o.id, 'order_number', o.order_number,
    'status', o.status, 'customer_name', o.customer_name, 'customer_phone', o.customer_phone,
    'fulfillment', o.fulfillment, 'payment_method', o.payment_method,
    'subtotal', o.subtotal, 'delivery_fee', o.delivery_fee, 'total', o.total,
    'address_street', o.address_street, 'address_number', o.address_number,
    'address_neighborhood', o.address_neighborhood, 'address_complement', o.address_complement,
    'address_reference', o.address_reference, 'notes', o.notes,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'lineId', oi.id::text, 'productId', oi.product_id, 'productName', oi.product_name,
        'imageUrl', oi.product_image_url, 'secondProductId', oi.second_product_id,
        'secondProductName', oi.second_product_name, 'isHalf', oi.is_half,
        'sizeId', oi.size_id, 'sizeName', oi.size_name, 'crustId', oi.crust_id,
        'crustName', oi.crust_name, 'crustPrice', oi.crust_price,
        'addons', oi.addons, 'complements', oi.complements, 'quantity', oi.quantity,
        'notes', oi.notes, 'unitPrice', oi.unit_price
      ) order by oi.created_at)
      from public.neroxa_order_items oi where oi.order_id = o.id
    ), '[]'::jsonb),
    'created_at', o.created_at, 'updated_at', o.updated_at
  )
  from public.neroxa_orders o
  where o.id = p_order_id
    and regexp_replace(o.customer_phone, '[^0-9]', '', 'g')
      = regexp_replace(coalesce(p_customer_phone, ''), '[^0-9]', '', 'g')
  limit 1;
$$;

revoke all on function public.get_public_order_status(uuid, text) from public;
grant execute on function public.get_public_order_status(uuid, text) to anon, authenticated;

create or replace function public.append_public_order_items_with_payment(
  p_order_id uuid,
  p_customer_phone text,
  p_items jsonb,
  p_payment_method text
)
returns table(order_id uuid, order_number bigint, subtotal numeric, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.neroxa_orders%rowtype;
  v_item jsonb;
  v_product record;
  v_second_id uuid;
  v_second_name text;
  v_qty integer;
  v_unit numeric(12,2);
  v_added numeric(12,2) := 0;
begin
  if p_payment_method is null or p_payment_method not in ('CASH','PIX','CARD_ON_DELIVERY','CARD_ON_SITE') then
    raise exception 'Forma de pagamento inválida';
  end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then
    raise exception 'Adicione pelo menos um item';
  end if;

  select o.* into v_order
  from public.neroxa_orders o
  where o.id = p_order_id
    and regexp_replace(o.customer_phone, '[^0-9]', '', 'g')
      = regexp_replace(coalesce(p_customer_phone, ''), '[^0-9]', '', 'g')
  for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if v_order.status not in ('RECEIVED','CONFIRMED','PREPARING','READY') then
    raise exception 'Este pedido não pode mais receber novos itens';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) as x(value) loop
    v_second_id := null;
    v_second_name := null;
    v_qty := greatest(1, least(99, coalesce((v_item->>'quantity')::integer,1)));

    select p.* into v_product
    from public.neroxa_storefront_products p
    where p.id = nullif(v_item->>'product_id','')::uuid
      and p.instance_id = v_order.instance_id
      and p.active
      and coalesce((p.metadata->>'available')::boolean,true);
    if not found then raise exception 'Produto não disponível'; end if;

    if nullif(v_item->>'second_product_id','') is not null then
      select p.id,p.name into v_second_id,v_second_name
      from public.neroxa_storefront_products p
      where p.id = (v_item->>'second_product_id')::uuid
        and p.instance_id = v_order.instance_id and p.active
        and coalesce((p.metadata->>'available')::boolean,true);
      if not found then raise exception 'Segundo sabor não disponível'; end if;
    end if;

    v_unit := public.calculate_public_order_line_price(
      v_order.instance_id, v_product.id, v_second_id,
      nullif(v_item->>'size_id',''), nullif(v_item->>'crust_id',''),
      coalesce(v_item->'addons','[]'::jsonb), coalesce(v_item->'complements','[]'::jsonb)
    );

    insert into public.neroxa_order_items(
      order_id,product_id,product_name,product_image_url,second_product_id,second_product_name,
      is_half,size_id,size_name,crust_id,crust_name,crust_price,addons,complements,
      quantity,notes,unit_price,line_total
    ) values (
      v_order.id,v_product.id,v_product.name,v_product.image_url,v_second_id,v_second_name,
      coalesce((v_item->>'is_half')::boolean,false),
      case when v_item->>'size_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (v_item->>'size_id')::uuid else null end,
      nullif(v_item->>'size_name',''),
      case when v_item->>'crust_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (v_item->>'crust_id')::uuid else null end,
      nullif(v_item->>'crust_name',''),
      coalesce((v_item->>'crust_price')::numeric,0),
      coalesce(v_item->'addons','[]'::jsonb),coalesce(v_item->'complements','[]'::jsonb),
      v_qty,nullif(v_item->>'notes',''),v_unit,v_unit*v_qty
    );
    v_added := v_added + v_unit*v_qty;
  end loop;

  update public.neroxa_orders as o
  set payment_method=p_payment_method,
      subtotal=round(coalesce(v_order.subtotal,0)+v_added,2),
      total=round(coalesce(v_order.subtotal,0)+v_added+coalesce(v_order.delivery_fee,0),2),
      updated_at=now()
  where o.id=v_order.id returning o.* into v_order;

  order_id:=v_order.id; order_number:=v_order.order_number;
  subtotal:=v_order.subtotal; total:=v_order.total;
  return next;
end;
$$;

revoke all on function public.append_public_order_items_with_payment(uuid,text,jsonb,text) from public;
grant execute on function public.append_public_order_items_with_payment(uuid,text,jsonb,text) to anon, authenticated;

create or replace function public.get_admin_orders(
  p_instance_id uuid,
  p_status text default null
)
returns setof public.neroxa_orders
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select i.organization_id into v_org
  from public.neroxa_system_instances i where i.id = p_instance_id;
  if v_org is null then raise exception 'Loja não encontrada'; end if;
  if not public.neroxa_is_platform_member()
     and not exists (
       select 1 from public.neroxa_organization_members m
       where m.organization_id = v_org and m.user_id = auth.uid() and m.active
     ) then
    raise exception 'Acesso não autorizado aos pedidos desta loja';
  end if;

  return query
  select o.* from public.neroxa_orders o
  where o.instance_id = p_instance_id and (p_status is null or o.status = p_status)
  order by o.created_at desc;
end;
$$;

revoke all on function public.get_admin_orders(uuid,text) from public;
grant execute on function public.get_admin_orders(uuid,text) to authenticated;

create or replace function public.update_admin_order_status(
  p_order_id uuid,
  p_status text,
  p_note text default null
)
returns public.neroxa_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.neroxa_orders%rowtype;
  v_previous_status text;
begin
  select o.* into v_order from public.neroxa_orders o where o.id=p_order_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if not public.neroxa_is_platform_member()
     and not exists (
       select 1 from public.neroxa_organization_members m
       where m.organization_id=v_order.organization_id and m.user_id=auth.uid() and m.active
     ) then
    raise exception 'Acesso não autorizado a este pedido';
  end if;
  if p_status not in ('RECEIVED','CONFIRMED','PREPARING','READY','OUT_FOR_DELIVERY','DELIVERED','CANCELLED') then
    raise exception 'Status inválido';
  end if;
  if p_status = v_order.status then return v_order; end if;
  v_previous_status := v_order.status;

  if not (
    (v_order.status = 'RECEIVED' and p_status in ('CONFIRMED','CANCELLED')) or
    (v_order.status = 'CONFIRMED' and p_status in ('PREPARING','CANCELLED')) or
    (v_order.status = 'PREPARING' and p_status in ('READY','CANCELLED')) or
    (v_order.status = 'READY' and p_status = 'CANCELLED') or
    (v_order.status = 'READY' and v_order.fulfillment = 'PICKUP' and p_status = 'DELIVERED') or
    (v_order.status = 'READY' and v_order.fulfillment = 'DELIVERY' and p_status = 'OUT_FOR_DELIVERY') or
    (v_order.status = 'OUT_FOR_DELIVERY' and p_status in ('DELIVERED','CANCELLED'))
  ) then
    raise exception 'Transição de status inválida: % -> %', v_order.status, p_status;
  end if;

  update public.neroxa_orders
  set status=p_status, updated_at=now(),
      confirmed_at=case when p_status='CONFIRMED' and confirmed_at is null then now() else confirmed_at end,
      preparing_at=case when p_status='PREPARING' and preparing_at is null then now() else preparing_at end,
      ready_at=case when p_status='READY' and ready_at is null then now() else ready_at end,
      out_for_delivery_at=case when p_status='OUT_FOR_DELIVERY' and out_for_delivery_at is null then now() else out_for_delivery_at end,
      delivered_at=case when p_status='DELIVERED' and delivered_at is null then now() else delivered_at end,
      cancelled_at=case when p_status='CANCELLED' and cancelled_at is null then now() else cancelled_at end
  where id=p_order_id returning * into v_order;

  insert into public.neroxa_order_status_history(
    order_id,from_status,to_status,changed_by_user_id,note
  ) values(v_order.id,v_previous_status,p_status,auth.uid(),nullif(trim(p_note),''));
  return v_order;
end;
$$;

revoke all on function public.update_admin_order_status(uuid,text,text) from public;
grant execute on function public.update_admin_order_status(uuid,text,text) to authenticated;

