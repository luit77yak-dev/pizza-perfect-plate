-- Neroxa Master security hardening
-- Tightens grants and SECURITY DEFINER search paths without changing
-- storefront or organization/customer behavior.

-- These internal Master tables must never be publicly readable.
revoke all on table
  public.neroxa_roles,
  public.neroxa_permissions,
  public.neroxa_role_permissions,
  public.neroxa_staff_members,
  public.neroxa_staff_roles,
  public.neroxa_audit_logs
from anon, authenticated;

-- Authenticated staff access is granted only where RLS policies permit it.
grant select on table
  public.neroxa_roles,
  public.neroxa_permissions,
  public.neroxa_role_permissions,
  public.neroxa_staff_members,
  public.neroxa_staff_roles,
  public.neroxa_audit_logs
to authenticated;

-- SECURITY DEFINER functions use an empty search_path and fully qualified
-- relations, reducing search-path hijacking risk.
create or replace function public.is_neroxa_staff(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.neroxa_staff_members sm
    where sm.user_id = coalesce(p_user_id, auth.uid())
      and sm.active
  );
$$;

create or replace function public.has_neroxa_role(
  p_role_key text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.neroxa_staff_members sm
    join public.neroxa_staff_roles sr on sr.user_id = sm.user_id
    join public.neroxa_roles r on r.id = sr.role_id
    where sm.user_id = coalesce(p_user_id, auth.uid())
      and sm.active
      and r.active
      and r.key = p_role_key
  );
$$;

create or replace function public.has_neroxa_permission(
  p_permission_key text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.neroxa_staff_members sm
    join public.neroxa_staff_roles sr on sr.user_id = sm.user_id
    join public.neroxa_roles r on r.id = sr.role_id
    join public.neroxa_role_permissions rp on rp.role_id = r.id
    join public.neroxa_permissions p on p.id = rp.permission_id
    where sm.user_id = coalesce(p_user_id, auth.uid())
      and sm.active
      and r.active
      and p.key = p_permission_key
  );
$$;

create or replace function public.record_neroxa_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_organization_id uuid default null,
  p_before_data jsonb default null,
  p_after_data jsonb default null,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_neroxa_staff() then
    raise exception 'not authorized';
  end if;

  insert into public.neroxa_audit_logs (
    actor_user_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  )
  values (
    auth.uid(),
    p_organization_id,
    nullif(trim(p_action), ''),
    nullif(trim(p_entity_type), ''),
    p_entity_id,
    p_before_data,
    p_after_data,
    p_metadata
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.is_neroxa_staff(uuid) from public, anon;
revoke all on function public.has_neroxa_role(text, uuid) from public, anon;
revoke all on function public.has_neroxa_permission(text, uuid) from public, anon;
revoke all on function public.record_neroxa_audit(text, text, uuid, uuid, jsonb, jsonb, jsonb) from public, anon;

grant execute on function public.is_neroxa_staff(uuid) to authenticated;
grant execute on function public.has_neroxa_role(text, uuid) to authenticated;
grant execute on function public.has_neroxa_permission(text, uuid) to authenticated;
grant execute on function public.record_neroxa_audit(text, text, uuid, uuid, jsonb, jsonb, jsonb) to authenticated;
