-- Neroxa Master security foundation
-- This migration creates internal platform authorization separately from
-- organization/customer authorization. It intentionally does not alter
-- storefront, checkout, or organization business logic.

create table if not exists public.neroxa_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.neroxa_permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.neroxa_role_permissions (
  role_id uuid not null references public.neroxa_roles(id) on delete cascade,
  permission_id uuid not null references public.neroxa_permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.neroxa_staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.neroxa_staff_roles (
  user_id uuid not null references public.neroxa_staff_members(user_id) on delete cascade,
  role_id uuid not null references public.neroxa_roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index if not exists neroxa_staff_roles_role_id_idx
  on public.neroxa_staff_roles (role_id);

create index if not exists neroxa_role_permissions_permission_id_idx
  on public.neroxa_role_permissions (permission_id);

alter table public.neroxa_roles enable row level security;
alter table public.neroxa_permissions enable row level security;
alter table public.neroxa_role_permissions enable row level security;
alter table public.neroxa_staff_members enable row level security;
alter table public.neroxa_staff_roles enable row level security;

create or replace function public.is_neroxa_staff(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
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
set search_path = public
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
set search_path = public
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

revoke all on function public.is_neroxa_staff(uuid) from public;
revoke all on function public.has_neroxa_role(text, uuid) from public;
revoke all on function public.has_neroxa_permission(text, uuid) from public;

grant execute on function public.is_neroxa_staff(uuid) to authenticated;
grant execute on function public.has_neroxa_role(text, uuid) to authenticated;
grant execute on function public.has_neroxa_permission(text, uuid) to authenticated;

drop policy if exists neroxa_roles_staff_read on public.neroxa_roles;
create policy neroxa_roles_staff_read
  on public.neroxa_roles
  for select
  to authenticated
  using (public.is_neroxa_staff());

drop policy if exists neroxa_permissions_staff_read on public.neroxa_permissions;
create policy neroxa_permissions_staff_read
  on public.neroxa_permissions
  for select
  to authenticated
  using (public.is_neroxa_staff());

drop policy if exists neroxa_role_permissions_staff_read on public.neroxa_role_permissions;
create policy neroxa_role_permissions_staff_read
  on public.neroxa_role_permissions
  for select
  to authenticated
  using (public.is_neroxa_staff());

drop policy if exists neroxa_staff_members_self_read on public.neroxa_staff_members;
create policy neroxa_staff_members_self_read
  on public.neroxa_staff_members
  for select
  to authenticated
  using (user_id = auth.uid() or public.has_neroxa_permission('staff.read'));

drop policy if exists neroxa_staff_roles_self_read on public.neroxa_staff_roles;
create policy neroxa_staff_roles_self_read
  on public.neroxa_staff_roles
  for select
  to authenticated
  using (user_id = auth.uid() or public.has_neroxa_permission('staff.read'));

insert into public.neroxa_roles (key, name, description)
values
  ('super_admin', 'Super administrador', 'Acesso completo à plataforma Neroxa.'),
  ('admin', 'Administrador', 'Administração operacional da Neroxa.'),
  ('finance', 'Financeiro', 'Operações financeiras e cobranças.'),
  ('support', 'Suporte', 'Atendimento e operação de suporte.')
on conflict (key) do nothing;

insert into public.neroxa_permissions (key, name, description)
values
  ('dashboard.read', 'Visualizar dashboard', 'Acessar indicadores da plataforma.'),
  ('clients.read', 'Visualizar clientes', 'Consultar clientes e organizações.'),
  ('clients.write', 'Gerenciar clientes', 'Criar e atualizar clientes e organizações.'),
  ('plans.read', 'Visualizar planos', 'Consultar catálogo comercial.'),
  ('plans.write', 'Gerenciar planos', 'Criar e atualizar planos e recursos.'),
  ('contracts.read', 'Visualizar contratos', 'Consultar contratos.'),
  ('contracts.write', 'Gerenciar contratos', 'Criar e atualizar contratos.'),
  ('billing.read', 'Visualizar financeiro', 'Consultar cobranças e pagamentos.'),
  ('billing.write', 'Gerenciar financeiro', 'Registrar e atualizar operações financeiras.'),
  ('implementation.read', 'Visualizar implantação', 'Consultar projetos de implantação.'),
  ('implementation.write', 'Gerenciar implantação', 'Atualizar tarefas e projetos.'),
  ('domains.read', 'Visualizar domínios', 'Consultar domínios da plataforma.'),
  ('domains.write', 'Gerenciar domínios', 'Gerenciar vínculos de domínio.'),
  ('support.read', 'Visualizar suporte', 'Consultar chamados.'),
  ('support.write', 'Gerenciar suporte', 'Gerenciar chamados.'),
  ('staff.read', 'Visualizar equipe', 'Consultar equipe interna e papéis.'),
  ('staff.write', 'Gerenciar equipe', 'Gerenciar equipe e permissões.'),
  ('audit.read', 'Visualizar auditoria', 'Consultar registros de auditoria.')
on conflict (key) do nothing;

insert into public.neroxa_role_permissions (role_id, permission_id)
select r.id, p.id
from public.neroxa_roles r
cross join public.neroxa_permissions p
where r.key = 'super_admin'
on conflict do nothing;

insert into public.neroxa_role_permissions (role_id, permission_id)
select r.id, p.id
from public.neroxa_roles r
join public.neroxa_permissions p
  on p.key in (
    'dashboard.read',
    'clients.read',
    'plans.read',
    'contracts.read',
    'billing.read',
    'implementation.read',
    'domains.read',
    'support.read',
    'audit.read'
  )
where r.key = 'admin'
on conflict do nothing;

insert into public.neroxa_role_permissions (role_id, permission_id)
select r.id, p.id
from public.neroxa_roles r
join public.neroxa_permissions p
  on p.key in (
    'dashboard.read',
    'clients.read',
    'billing.read',
    'billing.write',
    'contracts.read'
  )
where r.key = 'finance'
on conflict do nothing;

insert into public.neroxa_role_permissions (role_id, permission_id)
select r.id, p.id
from public.neroxa_roles r
join public.neroxa_permissions p
  on p.key in (
    'dashboard.read',
    'clients.read',
    'implementation.read',
    'implementation.write',
    'domains.read',
    'support.read',
    'support.write'
  )
where r.key = 'support'
on conflict do nothing;
