-- Restaurant-only decision for a pending addition request.
-- Payment confirmation intentionally remains unavailable in this migration.
create or replace function public.decide_order_addition_request(
  p_request_id uuid, p_approve boolean
)
returns public.neroxa_order_addition_requests
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_request public.neroxa_order_addition_requests%rowtype;
  v_order public.neroxa_orders%rowtype;
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  select r.* into v_request from public.neroxa_order_addition_requests r
  where r.id=p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  select o.* into v_order from public.neroxa_orders o
  where o.id=v_request.order_id for update;
  if not found or v_order.instance_id <> v_request.instance_id then
    raise exception 'Request/order mismatch';
  end if;
  select i.organization_id into v_org
  from public.neroxa_system_instances i where i.id=v_request.instance_id;
  if v_org is null or v_org <> v_order.organization_id then
    raise exception 'Organization mismatch';
  end if;
  if not public.neroxa_is_platform_member()
    and not exists (
      select 1 from public.neroxa_organization_members m
      where m.organization_id=v_org and m.user_id=auth.uid() and m.active
    ) then
    raise exception 'Not authorized for this restaurant' using errcode='42501';
  end if;
  if v_request.status <> 'REQUESTED' then
    raise exception 'Request already decided';
  end if;
  if v_order.status not in ('RECEIVED','CONFIRMED') then
    raise exception 'Order no longer accepts additions';
  end if;
  update public.neroxa_order_addition_requests r
  set status=case when p_approve then 'APPROVED' else 'REJECTED' end,
      decided_at=now(), decided_by=auth.uid()
  where r.id=p_request_id returning r.* into v_request;
  return v_request;
end;
$fn$;

revoke all on function public.decide_order_addition_request(uuid,boolean)
  from public,anon,authenticated;
grant execute on function public.decide_order_addition_request(uuid,boolean)
  to authenticated;
