-- Cutover: only the token-authorized RPC is exposed to clients.
-- Apply after checkout migration and client rollout are coordinated.
revoke all on function public.append_public_order_items_with_payment(uuid,text,jsonb,text)
  from public, anon, authenticated;

create or replace function public.append_authorized_order_items(
  p_order_id uuid, p_amendment_token text, p_items jsonb, p_payment_method text
)
returns table(order_id uuid, order_number bigint, subtotal numeric, total numeric)
language plpgsql security definer set search_path = ''
as 'declare
  v_order public.neroxa_orders%rowtype;
begin
  if coalesce(length(p_amendment_token),0) <> 64
     or p_amendment_token !~ ''^[0-9a-f]{64}'' then
    raise exception ''Credencial inválida'';
  end if;
  select o.* into v_order from public.neroxa_orders o
  where o.id = p_order_id for update;
  if not found then raise exception ''Pedido não disponível''; end if;
  if not exists (
    select 1 from public.neroxa_order_amendment_credentials c
    where c.order_id = v_order.id
      and c.token_hash = sha256(convert_to(p_amendment_token,''UTF8''))
      and c.revoked_at is null and c.expires_at > now()
  ) then raise exception ''Credencial inválida ou expirada''; end if;
  if v_order.status not in (''RECEIVED'',''CONFIRMED'') then
    raise exception ''Este pedido não aceita novos itens sem autorização da loja'';
  end if;
  return query select a.order_id,a.order_number,a.subtotal,a.total
  from public.append_public_order_items_with_payment(
    v_order.id,v_order.customer_phone,p_items,p_payment_method
  ) a;
end;';

revoke all on function public.append_authorized_order_items(uuid,text,jsonb,text) from public;
grant execute on function public.append_authorized_order_items(uuid,text,jsonb,text)
  to anon, authenticated;
