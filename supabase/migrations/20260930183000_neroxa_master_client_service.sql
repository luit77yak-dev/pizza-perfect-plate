-- Neroxa Master client service layer
-- Makes the client lifecycle explicit and keeps writes behind audited RPCs.

alter table public.neroxa_clients
  alter column organization_id drop not null;

alter table public.neroxa_clients
  drop constraint if exists neroxa_clients_organization_id_key;

create unique index if not exists neroxa_clients_organization_id_unique_idx
  on public.neroxa_clients (organization_id)
  where organization_id is not null;

create or replace function public.create_neroxa_client(
  p_legal_name text default null,
  p_trade_name text default null,
  p_tax_id text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_legal_name text := nullif(trim(coalesce(p_legal_name, '')), '');
  v_trade_name text := nullif(trim(coalesce(p_trade_name, '')), '');
begin
  if not public.has_neroxa_permission('clients.write') then
    raise exception 'not authorized';
  end if;

  if v_legal_name is null and v_trade_name is null then
    raise exception 'legal_name or trade_name is required';
  end if;

  insert into public.neroxa_clients (
    legal_name,
    trade_name,
    tax_id,
    notes,
    acquired_at
  )
  values (
    v_legal_name,
    v_trade_name,
    nullif(trim(coalesce(p_tax_id, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    now()
  )
  returning id into v_client_id;

  perform public.record_neroxa_audit(
    'CLIENT_CREATED',
    'neroxa_client',
    v_client_id,
    null,
    null,
    jsonb_build_object(
      'legal_name', v_legal_name,
      'trade_name', v_trade_name,
      'status', 'LEAD'
    ),
    null
  );

  return v_client_id;
end;
$$;

create or replace function public.update_neroxa_client(
  p_client_id uuid,
  p_legal_name text default null,
  p_trade_name text default null,
  p_tax_id text default null,
  p_notes text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_legal_name text := nullif(trim(coalesce(p_legal_name, '')), '');
  v_trade_name text := nullif(trim(coalesce(p_trade_name, '')), '');
begin
  if not public.has_neroxa_permission('clients.write') then
    raise exception 'not authorized';
  end if;

  select to_jsonb(c) into v_before
  from public.neroxa_clients c
  where c.id = p_client_id;

  if v_before is null then
    raise exception 'client not found';
  end if;

  if v_legal_name is null and v_trade_name is null then
    raise exception 'legal_name or trade_name is required';
  end if;

  update public.neroxa_clients
  set
    legal_name = v_legal_name,
    trade_name = v_trade_name,
    tax_id = nullif(trim(coalesce(p_tax_id, '')), ''),
    notes = nullif(trim(coalesce(p_notes, '')), '')
  where id = p_client_id;

  select to_jsonb(c) into v_after
  from public.neroxa_clients c
  where c.id = p_client_id;

  perform public.record_neroxa_audit(
    'CLIENT_UPDATED',
    'neroxa_client',
    p_client_id,
    (v_after ->> 'organization_id')::uuid,
    v_before,
    v_after,
    null
  );

  return true;
end;
$$;

create or replace function public.link_neroxa_client_organization(
  p_client_id uuid,
  p_organization_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  if not public.has_neroxa_permission('clients.write') then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1
    from public.organizations o
    where o.id = p_organization_id
  ) then
    raise exception 'organization not found';
  end if;

  select to_jsonb(c) into v_before
  from public.neroxa_clients c
  where c.id = p_client_id;

  if v_before is null then
    raise exception 'client not found';
  end if;

  update public.neroxa_clients
  set organization_id = p_organization_id
  where id = p_client_id;

  if not found then
    raise exception 'client not found';
  end if;

  select to_jsonb(c) into v_after
  from public.neroxa_clients c
  where c.id = p_client_id;

  perform public.record_neroxa_audit(
    'CLIENT_ORGANIZATION_LINKED',
    'neroxa_client',
    p_client_id,
    p_organization_id,
    v_before,
    v_after,
    null
  );

  return true;
exception
  when unique_violation then
    raise exception 'organization already linked to another client';
end;
$$;

create or replace function public.transition_neroxa_client_status(
  p_client_id uuid,
  p_new_status public.neroxa_client_status
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_status public.neroxa_client_status;
  v_organization_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_allowed boolean := false;
begin
  if not public.has_neroxa_permission('clients.write') then
    raise exception 'not authorized';
  end if;

  select c.status, c.organization_id, to_jsonb(c)
  into v_current_status, v_organization_id, v_before
  from public.neroxa_clients c
  where c.id = p_client_id;

  if v_before is null then
    raise exception 'client not found';
  end if;

  if v_current_status = p_new_status then
    return true;
  end if;

  v_allowed :=
    (v_current_status = 'LEAD' and p_new_status in ('PROPOSAL', 'CANCELLED'))
    or (v_current_status = 'PROPOSAL' and p_new_status in ('NEGOTIATION', 'CONTRACTED', 'CANCELLED'))
    or (v_current_status = 'NEGOTIATION' and p_new_status in ('PROPOSAL', 'CONTRACTED', 'CANCELLED'))
    or (v_current_status = 'CONTRACTED' and p_new_status in ('IMPLEMENTATION', 'CANCELLED'))
    or (v_current_status = 'IMPLEMENTATION' and p_new_status in ('ACTIVE', 'PAUSED', 'CANCELLED'))
    or (v_current_status = 'ACTIVE' and p_new_status in ('PAUSED', 'DELINQUENT', 'CANCELLED'))
    or (v_current_status = 'PAUSED' and p_new_status in ('ACTIVE', 'DELINQUENT', 'CANCELLED'))
    or (v_current_status = 'DELINQUENT' and p_new_status in ('ACTIVE', 'CANCELLED'));

  if not v_allowed then
    raise exception 'invalid client status transition from % to %', v_current_status, p_new_status;
  end if;

  update public.neroxa_clients
  set
    status = p_new_status,
    contracted_at = case
      when p_new_status = 'CONTRACTED' and contracted_at is null then now()
      else contracted_at
    end,
    activated_at = case
      when p_new_status = 'ACTIVE' and activated_at is null then now()
      else activated_at
    end,
    paused_at = case
      when p_new_status = 'PAUSED' then now()
      else paused_at
    end,
    cancelled_at = case
      when p_new_status = 'CANCELLED' then now()
      else cancelled_at
    end
  where id = p_client_id;

  select to_jsonb(c) into v_after
  from public.neroxa_clients c
  where c.id = p_client_id;

  perform public.record_neroxa_audit(
    'CLIENT_STATUS_CHANGED',
    'neroxa_client',
    p_client_id,
    v_organization_id,
    v_before,
    v_after,
    jsonb_build_object(
      'from_status', v_current_status,
      'to_status', p_new_status
    )
  );

  return true;
end;
$$;

create or replace function public.create_neroxa_client_contact(
  p_client_id uuid,
  p_name text,
  p_role_title text default null,
  p_email text default null,
  p_phone text default null,
  p_whatsapp text default null,
  p_is_primary boolean default false,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact_id uuid;
  v_organization_id uuid;
begin
  if not public.has_neroxa_permission('clients.write') then
    raise exception 'not authorized';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'contact name is required';
  end if;

  select c.organization_id into v_organization_id
  from public.neroxa_clients c
  where c.id = p_client_id;

  if not found then
    raise exception 'client not found';
  end if;

  if p_is_primary then
    update public.neroxa_client_contacts
    set is_primary = false
    where client_id = p_client_id and active;
  end if;

  insert into public.neroxa_client_contacts (
    client_id,
    name,
    role_title,
    email,
    phone,
    whatsapp,
    is_primary,
    notes
  )
  values (
    p_client_id,
    trim(p_name),
    nullif(trim(coalesce(p_role_title, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_whatsapp, '')), ''),
    p_is_primary,
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_contact_id;

  perform public.record_neroxa_audit(
    'CLIENT_CONTACT_CREATED',
    'neroxa_client_contact',
    v_contact_id,
    v_organization_id,
    null,
    jsonb_build_object(
      'client_id', p_client_id,
      'name', trim(p_name),
      'is_primary', p_is_primary
    ),
    null
  );

  return v_contact_id;
end;
$$;

revoke all on function public.create_neroxa_client(text, text, text, text) from public, anon;
grant execute on function public.create_neroxa_client(text, text, text, text) to authenticated;

revoke all on function public.update_neroxa_client(uuid, text, text, text, text) from public, anon;
grant execute on function public.update_neroxa_client(uuid, text, text, text, text) to authenticated;

revoke all on function public.link_neroxa_client_organization(uuid, uuid) from public, anon;
grant execute on function public.link_neroxa_client_organization(uuid, uuid) to authenticated;

revoke all on function public.transition_neroxa_client_status(uuid, public.neroxa_client_status) from public, anon;
grant execute on function public.transition_neroxa_client_status(uuid, public.neroxa_client_status) to authenticated;

revoke all on function public.create_neroxa_client_contact(uuid, text, text, text, text, text, boolean, text) from public, anon;
grant execute on function public.create_neroxa_client_contact(uuid, text, text, text, text, text, boolean, text) to authenticated;
