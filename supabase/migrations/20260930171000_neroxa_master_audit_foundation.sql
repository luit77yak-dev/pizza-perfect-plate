-- Neroxa Master audit foundation
-- Audit records are separate from organization/customer audit records.

create table if not exists public.neroxa_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists neroxa_audit_logs_created_at_idx
  on public.neroxa_audit_logs (created_at desc);

create index if not exists neroxa_audit_logs_organization_id_idx
  on public.neroxa_audit_logs (organization_id, created_at desc);

create index if not exists neroxa_audit_logs_entity_idx
  on public.neroxa_audit_logs (entity_type, entity_id, created_at desc);

alter table public.neroxa_audit_logs enable row level security;

drop policy if exists neroxa_audit_logs_staff_read on public.neroxa_audit_logs;
create policy neroxa_audit_logs_staff_read
  on public.neroxa_audit_logs
  for select
  to authenticated
  using (public.has_neroxa_permission('audit.read'));

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
set search_path = public
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

revoke all on function public.record_neroxa_audit(text, text, uuid, uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.record_neroxa_audit(text, text, uuid, uuid, jsonb, jsonb, jsonb) to authenticated;
