-- Unify public checkout, tracking, add-ons and admin order operations on the Neroxa storefront model.
-- Development branch only. Review and apply separately; this does not change any deployed database.

create table if not exists public.neroxa_orders (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_number bigint not null,
  customer_name text not null,
  customer_phone text not null,
  fulfillment public.fulfillment_type not null default 'DELIVERY',
  payment_method public.payment_method not null default 'PIX',
  status public.order_status not null default 'RECEIVED',
  subtotal numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  address_street text,
  address_number text,
  address_neighborhood text,
  address_complement text,
  address_reference text,
  notes text,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instance_id, order_number),
  unique (instance_id, idempotency_key)
);

create table if not exists public.neroxa_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.neroxa_orders(id) on delete cascade,
  product_id uuid,
  product_name text not null,
  product_image_url text,
  second_product_id uuid,
  second_product_name text,
  is_half boolean not null default false,
  size_id text,
  size_name text,
  crust_id text,
  crust_name text,
  crust_price numeric(12,2) not null default 0,
  addons jsonb not null default '[]'::jsonb,
  complements jsonb not null default '[]'::jsonb,
  quantity integer not null default 1 check (quantity between 1 and 99),
  notes text,
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.neroxa_order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.neroxa_orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

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
returns table(
  order_id uuid,
  order_number integer,
  status public.order_status,
  fulfillment public.fulfillment_type,
  created_at timestamptz,
  updated_at timestamptz,
  subtotal numeric,
  delivery_fee numeric,
  total numeric,
  items jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.order_number::integer,
    o.status,
    o.fulfillment,
    o.created_at,
    o.updated_at,
    o.subtotal,
    o.delivery_fee,
    o.total,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'lineId', oi.id::text,
        'productId', oi.product_id,
        'productName', oi.product_name,
        'imageUrl', oi.product_image_url,
        'secondProductId', oi.second_product_id,
        'secondProductName', oi.second_product_name,
        'isHalf', oi.is_half,
        'sizeId', oi.size_id,
        'sizeName', oi.size_name,
        'crustId', oi.crust_id,
        'crustName', oi.crust_name,
        'crustPrice', oi.crust_price,
        'addons', coalesce(oi.addons, '[]'::jsonb),
        'complements', coalesce(oi.complements, '[]'::jsonb),
        'quantity', oi.quantity,
        'notes', oi.notes,
        'unitPrice', oi.unit_price
      ) order by oi.created_at)
      from public.neroxa_order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb)
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
  p_payment_method public.payment_method
)
returns table(
  order_id uuid,
  order_number integer,
  subtotal numeric,
  delivery_fee numeric,
  total numeric,
  status public.order_status
)
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
  v_size_name text;
  v_crust_name text;
begin
  if p_payment_method is null then
    raise exception 'Forma de pagamento obrigatória';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
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

  update public.neroxa_orders
  set payment_method = p_payment_method, updated_at = now()
  where id = v_order.id;

  for v_item in select value from jsonb_array_elements(p_items) as x(value) loop
    v_second_id := null;
    v_second_name := null;
    v_qty := greatest(1, least(99, coalesce((v_item->>'quantity')::integer, 1)));

    select p.* into v_product
    from public.neroxa_storefront_products p
    where p.id = nullif(v_item->>'product_id','')::uuid
      and p.instance_id = v_order.instance_id
      and p.active
      and coalesce((p.metadata->>'available')::boolean,true);
    if not found then raise exception 'Produto não disponível'; end if;

    if nullif(v_item->>'second_product_id','') is not null then
      select p.id, p.name into v_second_id, v_second_name
      from public.neroxa_storefront_products p
      where p.id = (v_item->>'second_product_id')::uuid
        and p.instance_id = v_order.instance_id
        and p.active
        and coalesce((p.metadata->>'available')::boolean,true);
      if not found then raise exception 'Segundo sabor não disponível'; end if;
    end if;

    v_unit := public.calculate_public_order_line_price(
      v_order.instance_id,
      v_product.id,
      nullif(v_item->>'second_product_id','')::uuid,
      nullif(v_item->>'size_id',''),
      nullif(v_item->>'crust_id',''),
      coalesce(v_item->'addons','[]'::jsonb),
      coalesce(v_item->'complements','[]'::jsonb)
    );

    v_size_name := nullif(v_item->>'size_name','');
    if v_size_name is null and nullif(v_item->>'size_id','') is not null then
      select choice->>'name' into v_size_name
      from jsonb_array_elements(coalesce(v_product.metadata->'options','[]'::jsonb)) opt
      cross join lateral jsonb_array_elements(coalesce(opt->'choices','[]'::jsonb)) choice
      where opt->>'id' = 'tamanho' and choice->>'id' = v_item->>'size_id'
      limit 1;
    end if;

    v_crust_name := nullif(v_item->>'crust_name','');
    if v_crust_name is null and nullif(v_item->>'crust_id','') is not null then
      select choice->>'name' into v_crust_name
      from jsonb_array_elements(coalesce(v_product.metadata->'options','[]'::jsonb)) opt
      cross join lateral jsonb_array_elements(coalesce(opt->'choices','[]'::jsonb)) choice
      where opt->>'id' = 'borda' and choice->>'id' = v_item->>'crust_id'
      limit 1;
    end if;

    insert into public.neroxa_order_items(
      order_id, product_id, product_name, product_image_url, second_product_id,
      second_product_name, is_half, size_id, size_name, crust_id, crust_name,
      crust_price, addons, complements, quantity, notes, unit_price, line_total
    ) values (
      v_order.id, v_product.id, v_product.name, v_product.image_url,
      v_second_id, v_second_name,
      coalesce((v_item->>'is_half')::boolean,false),
      nullif(v_item->>'size_id',''), v_size_name,
      nullif(v_item->>'crust_id',''), v_crust_name,
      coalesce((v_item->>'crust_price')::numeric,0),
      coalesce(v_item->'addons','[]'::jsonb),
      coalesce(v_item->'complements','[]'::jsonb),
      v_qty, nullif(v_item->>'notes',''), v_unit, v_unit * v_qty
    );

    v_added := v_added + v_unit * v_qty;
  end loop;

  update public.neroxa_orders
  set subtotal = round(coalesce(subtotal,0) + v_added,2),
      total = round(coalesce(subtotal,0) + v_added + coalesce(delivery_fee,0),2),
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  return query select v_order.id, v_order.order_number::integer, v_order.subtotal,
                      v_order.delivery_fee, v_order.total, v_order.status;
end;
$$;

revoke all on function public.append_public_order_items_with_payment(uuid, text, jsonb, public.payment_method) from public;
grant execute on function public.append_public_order_items_with_payment(uuid, text, jsonb, public.payment_method) to anon, authenticated;

create or replace function public.get_admin_orders(
  p_instance_id uuid,
  p_status public.order_status default null
)
returns table(
  id uuid,
  instance_id uuid,
  organization_id uuid,
  order_number bigint,
  customer_name text,
  customer_phone text,
  fulfillment public.fulfillment_type,
  payment_method public.payment_method,
  status public.order_status,
  subtotal numeric,
  delivery_fee numeric,
  total numeric,
  address_street text,
  address_number text,
  address_neighborhood text,
  address_complement text,
  address_reference text,
  notes text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_org uuid;
begin
  select i.organization_id into v_org
  from public.neroxa_system_instances i
  where i.id = p_instance_id;
  if v_org is null or not public.is_org_staff(v_org) then
    raise exception 'Acesso não autorizado aos pedidos desta loja';
  end if;

  return query
  select o.id, o.instance_id, o.organization_id, o.order_number,
         o.customer_name, o.customer_phone, o.fulfillment, o.payment_method,
         o.status, o.subtotal, o.delivery_fee, o.total, o.address_street,
         o.address_number, o.address_neighborhood, o.address_complement,
         o.address_reference, o.notes, o.created_at
  from public.neroxa_orders o
  where o.instance_id = p_instance_id
    and (p_status is null or o.status = p_status)
  order by o.created_at desc;
end;
$$;

revoke all on function public.get_admin_orders(uuid, public.order_status) from public;
grant execute on function public.get_admin_orders(uuid, public.order_status) to authenticated;

create or replace function public.update_admin_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_note text default null
)
returns setof public.neroxa_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.neroxa_orders%rowtype;
  v_previous_status public.order_status;
begin
  select o.* into v_order
  from public.neroxa_orders o
  where o.id = p_order_id
  for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if not public.is_org_staff(v_order.organization_id) then
    raise exception 'Acesso não autorizado a este pedido';
  end if;
  if p_status = v_order.status then return next v_order; return; end if;
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
  set status = p_status, updated_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into public.neroxa_order_status_history(order_id,from_status,to_status,changed_by,note)
  values(v_order.id, v_previous_status, p_status, auth.uid(), nullif(trim(p_note), ''));

  return next v_order;
end;
$$;

revoke all on function public.update_admin_order_status(uuid, public.order_status, text) from public;
grant execute on function public.update_admin_order_status(uuid, public.order_status, text) to authenticated;
