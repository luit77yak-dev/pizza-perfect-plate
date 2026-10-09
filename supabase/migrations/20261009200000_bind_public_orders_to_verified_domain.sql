-- Bind public order creation to the verified storefront domain.
-- Development branch only: review and apply separately; this migration is not applied.
create or replace function public.create_public_order(p_order jsonb)
returns table(order_id uuid, order_number bigint, total numeric)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
 v_domain text := lower(trim(trailing '.' from trim(coalesce(p_order->>'storefront_domain',''))));
 v_client_org uuid := nullif(p_order->>'organization_id','')::uuid;
 v_org uuid;
 v_instance uuid;
 v_order_id uuid;
 v_number bigint;
 v_subtotal numeric(12,2) := 0;
 v_delivery_fee numeric(12,2) := 0;
 v_total numeric(12,2);
 v_fulfillment text := coalesce(p_order->>'fulfillment','DELIVERY');
 v_payment text := coalesce(p_order->>'payment_method','PIX');
 v_phone text := trim(coalesce(p_order->>'customer_phone',''));
 v_item jsonb;
 v_unit numeric;
 v_qty integer;
 v_zone record;
 v_neighborhood text;
begin
 if v_domain = '' then raise exception 'Domínio da loja obrigatório'; end if;

 -- Resolve tenant from a verified, active domain; never trust the browser's tenant ID.
 select ctx.organization_id, ctx.instance_id
   into v_org, v_instance
 from public.get_public_storefront_context(v_domain) ctx
 limit 1;

 if v_org is null or v_instance is null then
   raise exception 'Loja indisponível para este domínio';
 end if;

 if v_client_org is not null and v_client_org <> v_org then
   raise exception 'O domínio não corresponde à loja selecionada';
 end if;

 if v_phone = '' or trim(coalesce(p_order->>'customer_name','')) = '' then
   raise exception 'Dados do cliente incompletos';
 end if;

 if jsonb_typeof(p_order->'items') <> 'array'
    or jsonb_array_length(coalesce(p_order->'items','[]'::jsonb)) = 0 then
   raise exception 'O pedido precisa ter pelo menos um item';
 end if;

 if v_fulfillment not in ('DELIVERY','PICKUP')
    or v_payment not in ('CASH','PIX','CARD_ON_DELIVERY','CARD_ON_SITE') then
   raise exception 'Forma de recebimento ou pagamento inválida';
 end if;

 if nullif(p_order->>'idempotency_key','') is not null then
   select o.id, o.order_number, o.total
     into v_order_id, v_number, v_total
   from public.neroxa_orders o
   where o.instance_id = v_instance
     and o.idempotency_key = (p_order->>'idempotency_key')::uuid;

   if v_order_id is not null then
     order_id := v_order_id;
     order_number := v_number;
     total := v_total;
     return next;
     return;
   end if;
 end if;

 if v_fulfillment = 'DELIVERY' then
   v_neighborhood := trim(coalesce(p_order->>'address_neighborhood',''));
   if v_neighborhood = '' then raise exception 'Bairro de entrega obrigatório'; end if;

   select z.* into v_zone
   from public.neroxa_storefront_delivery_zones z
   where z.organization_id = v_org
     and z.active
     and exists (
       select 1 from unnest(z.neighborhoods) n
       where lower(trim(n)) = lower(v_neighborhood)
     )
   order by z.sort_order
   limit 1;

   if not found then raise exception 'Bairro não atendido pela loja'; end if;
   v_delivery_fee := coalesce(v_zone.delivery_fee, 0);
 end if;

 -- Serialize order numbering within the resolved instance.
 perform pg_advisory_xact_lock(hashtext(v_instance::text));
 select coalesce(max(o.order_number),0)+1
   into v_number
 from public.neroxa_orders o
 where o.instance_id = v_instance;

 insert into public.neroxa_orders(
   instance_id, organization_id, order_number, customer_name, customer_phone,
   fulfillment, payment_method, status, delivery_fee, address_street,
   address_number, address_neighborhood, address_complement, address_reference,
   notes, idempotency_key
 ) values (
   v_instance, v_org, v_number, trim(p_order->>'customer_name'), v_phone,
   v_fulfillment, v_payment, 'RECEIVED', v_delivery_fee,
   nullif(trim(p_order->>'address_street'),''),
   nullif(trim(p_order->>'address_number'),''),
   nullif(trim(p_order->>'address_neighborhood'),''),
   nullif(trim(p_order->>'address_complement'),''),
   nullif(trim(p_order->>'address_reference'),''),
   nullif(trim(p_order->>'notes'),''),
   nullif(p_order->>'idempotency_key','')::uuid
 ) returning id into v_order_id;

 for v_item in select * from jsonb_array_elements(p_order->'items') loop
   v_qty := greatest(1, least(99, coalesce((v_item->>'quantity')::integer,1)));
   v_unit := public.calculate_public_order_line_price(
     v_instance,
     nullif(v_item->>'product_id','')::uuid,
     nullif(v_item->>'second_product_id','')::uuid,
     nullif(v_item->>'size_id',''),
     nullif(v_item->>'crust_id',''),
     coalesce(v_item->'addons','[]'::jsonb),
     coalesce(v_item->'complements','[]'::jsonb)
   );

   insert into public.neroxa_order_items(
     order_id, product_id, product_name, product_image_url, second_product_id,
     second_product_name, is_half, size_id, size_name, crust_id, crust_name,
     crust_price, addons, complements, quantity, notes, unit_price, line_total
   )
   select
     v_order_id, p.id, p.name, p.image_url,
     nullif(v_item->>'second_product_id','')::uuid, p2.name,
     coalesce((v_item->>'is_half')::boolean,false),
     case when v_item->>'size_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
     coalesce((v_item->>'crust_price')::numeric,0),
     coalesce(v_item->'addons','[]'::jsonb),
     coalesce(v_item->'complements','[]'::jsonb),
     v_qty, nullif(v_item->>'notes',''), v_unit, v_unit*v_qty
   from public.neroxa_storefront_products p
   left join public.neroxa_storefront_products p2
     on p2.id = nullif(v_item->>'second_product_id','')::uuid
    and p2.instance_id = v_instance
   where p.id = nullif(v_item->>'product_id','')::uuid
     and p.instance_id = v_instance
     and p.active
     and coalesce((p.metadata->>'available')::boolean,true);

   if not found then raise exception 'Produto não disponível'; end if;
   v_subtotal := v_subtotal + v_unit*v_qty;
 end loop;

 v_total := v_subtotal + v_delivery_fee;
 update public.neroxa_orders
 set subtotal = v_subtotal, total = v_total, updated_at = now()
 where id = v_order_id;

 insert into public.neroxa_order_status_history(order_id,to_status,note)
 values(v_order_id,'RECEIVED','Pedido criado pelo site');

 order_id := v_order_id;
 order_number := v_number;
 total := v_total;
 return next;
end;
$function$;

revoke all on function public.create_public_order(jsonb) from public;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;
 then (v_item->>'size_id')::uuid else null end,
     coalesce(
       nullif(v_item->>'size_name',''),
       (select choice->>'name'
        from jsonb_array_elements(coalesce(p.metadata->'options','[]'::jsonb)) opt
        cross join lateral jsonb_array_elements(coalesce(opt->'choices','[]'::jsonb)) choice
        where opt->>'id'='tamanho' and choice->>'id'=v_item->>'size_id'
        limit 1)
     ),
     case when v_item->>'crust_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
     coalesce((v_item->>'crust_price')::numeric,0),
     coalesce(v_item->'addons','[]'::jsonb),
     coalesce(v_item->'complements','[]'::jsonb),
     v_qty, nullif(v_item->>'notes',''), v_unit, v_unit*v_qty
   from public.neroxa_storefront_products p
   left join public.neroxa_storefront_products p2
     on p2.id = nullif(v_item->>'second_product_id','')::uuid
    and p2.instance_id = v_instance
   where p.id = nullif(v_item->>'product_id','')::uuid
     and p.instance_id = v_instance
     and p.active
     and coalesce((p.metadata->>'available')::boolean,true);

   if not found then raise exception 'Produto não disponível'; end if;
   v_subtotal := v_subtotal + v_unit*v_qty;
 end loop;

 v_total := v_subtotal + v_delivery_fee;
 update public.neroxa_orders
 set subtotal = v_subtotal, total = v_total, updated_at = now()
 where id = v_order_id;

 insert into public.neroxa_order_status_history(order_id,to_status,note)
 values(v_order_id,'RECEIVED','Pedido criado pelo site');

 order_id := v_order_id;
 order_number := v_number;
 total := v_total;
 return next;
end;
$function$;

revoke all on function public.create_public_order(jsonb) from public;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;
 then (v_item->>'crust_id')::uuid else null end,
     coalesce(
       nullif(v_item->>'crust_name',''),
       (select choice->>'name'
        from jsonb_array_elements(coalesce(p.metadata->'options','[]'::jsonb)) opt
        cross join lateral jsonb_array_elements(coalesce(opt->'choices','[]'::jsonb)) choice
        where opt->>'id'='borda' and choice->>'id'=v_item->>'crust_id'
        limit 1)
     ),
     coalesce((v_item->>'crust_price')::numeric,0),
     coalesce(v_item->'addons','[]'::jsonb),
     coalesce(v_item->'complements','[]'::jsonb),
     v_qty, nullif(v_item->>'notes',''), v_unit, v_unit*v_qty
   from public.neroxa_storefront_products p
   left join public.neroxa_storefront_products p2
     on p2.id = nullif(v_item->>'second_product_id','')::uuid
    and p2.instance_id = v_instance
   where p.id = nullif(v_item->>'product_id','')::uuid
     and p.instance_id = v_instance
     and p.active
     and coalesce((p.metadata->>'available')::boolean,true);

   if not found then raise exception 'Produto não disponível'; end if;
   v_subtotal := v_subtotal + v_unit*v_qty;
 end loop;

 v_total := v_subtotal + v_delivery_fee;
 update public.neroxa_orders
 set subtotal = v_subtotal, total = v_total, updated_at = now()
 where id = v_order_id;

 insert into public.neroxa_order_status_history(order_id,to_status,note)
 values(v_order_id,'RECEIVED','Pedido criado pelo site');

 order_id := v_order_id;
 order_number := v_number;
 total := v_total;
 return next;
end;
$function$;

revoke all on function public.create_public_order(jsonb) from public;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;
