-- Internal payment settlement entry point. Only a trusted backend holding the
-- service role may invoke this AFTER verifying the provider webhook signature,
-- amount, currency, transaction status and merchant account independently.
-- No anonymous/customer/restaurant RPC is exposed for marking charges paid.
create unique index if not exists neroxa_addition_event_external_unique
on public.neroxa_order_addition_charge_events(external_event_id)
where external_event_id is not null;

create or replace function public.neroxa_confirm_addition_payment(
  p_charge_id uuid,
  p_provider text,
  p_provider_reference text,
  p_external_event_id text
)
returns public.neroxa_order_addition_charges
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_charge public.neroxa_order_addition_charges%rowtype;
begin
  if nullif(trim(p_provider),'') is null
    or nullif(trim(p_provider_reference),'') is null
    or nullif(trim(p_external_event_id),'') is null
    or length(p_provider)>100
    or length(p_provider_reference)>200
    or length(p_external_event_id)>200 then
    raise exception 'Invalid verified payment reference';
  end if;

  select c.* into v_charge from public.neroxa_order_addition_charges c
    where c.id=p_charge_id for update;
  if not found then raise exception 'Charge not found'; end if;
  if v_charge.status='PAID' then
    if v_charge.provider=p_provider
      and v_charge.provider_reference=p_provider_reference then
      return v_charge; -- repeated webhook: no duplicate financial event
    end if;
    raise exception 'Charge already settled with another payment';
  end if;
  if v_charge.status<>'PENDING' then
    raise exception 'Charge cannot be settled from current status';
  end if;
  if not exists (
    select 1 from public.neroxa_order_addition_requests r
    where r.id=v_charge.request_id and r.order_id=v_charge.order_id
      and r.status='APPROVED'
  ) then
    raise exception 'Charge request not approved';
  end if;

  update public.neroxa_order_addition_charges c
  set status='PAID',provider=p_provider,
      provider_reference=p_provider_reference,paid_at=now()
  where c.id=p_charge_id returning c.* into v_charge;

  insert into public.neroxa_order_addition_charge_events(
    charge_id,previous_status,next_status,external_event_id,note
  ) values (
    v_charge.id,'PENDING','PAID',p_external_event_id,
    'Trusted backend confirmed provider payment'
  );
  return v_charge;
end;
$fn$;

revoke all on function public.neroxa_confirm_addition_payment(uuid,text,text,text)
  from public,anon,authenticated;
grant execute on function public.neroxa_confirm_addition_payment(uuid,text,text,text)
  to service_role;
