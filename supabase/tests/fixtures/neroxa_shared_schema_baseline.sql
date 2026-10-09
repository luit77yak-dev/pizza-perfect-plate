-- Test-only contract for the shared Neroxa master/storefront dependencies.
-- This is NOT an application migration and must never be applied to production.
-- It intentionally defines only the minimum schema needed to exercise the three
-- order-storage migrations in this PR. It does not claim to recreate the full Master schema.

create table if not exists public.neroxa_organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  active boolean not null default true
);

create table if not exists public.neroxa_systems (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  system_type text not null,
  active boolean not null default true
);

create table if not exists public.neroxa_system_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.neroxa_organizations(id) on delete cascade,
  system_id uuid references public.neroxa_systems(id) on delete set null,
  name text not null,
  slug text not null,
  system_type text not null,
  status text not null default 'PROVISIONING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.neroxa_system_domains (
  id uuid primary key default gen_random_uuid(),
  system_instance_id uuid not null references public.neroxa_system_instances(id) on delete cascade,
  domain text not null unique,
  status text not null default 'PENDING',
  verified_at timestamptz
);

create table if not exists public.neroxa_storefront_settings (
  organization_id uuid primary key references public.neroxa_organizations(id) on delete cascade,
  half_pizza_pricing_rule text not null default 'highest_half',
  half_pizza_fixed_price numeric
);

create table if not exists public.neroxa_storefront_delivery_zones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.neroxa_organizations(id) on delete cascade,
  name text not null,
  neighborhoods text[] not null default '{}',
  minimum_order numeric not null default 0,
  delivery_fee numeric not null default 0,
  estimated_minutes integer,
  active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.neroxa_storefront_products (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.neroxa_system_instances(id) on delete cascade,
  name text not null,
  slug text not null,
  image_url text,
  price numeric,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  unique (instance_id, slug)
);

create table if not exists public.neroxa_organization_members (
  organization_id uuid not null references public.neroxa_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  primary key (organization_id, user_id)
);

create table if not exists public.neroxa_platform_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true
);

create or replace function public.neroxa_is_platform_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1 from public.neroxa_platform_members m
    where m.user_id = auth.uid() and m.active
  );
$function$;

create or replace function public.get_public_storefront_context(p_domain text)
returns table(
  domain text,
  instance_id uuid,
  instance_slug text,
  instance_name text,
  instance_status text,
  organization_id uuid,
  organization_name text,
  system_id uuid,
  system_slug text,
  system_name text,
  system_type text
)
language sql
stable
security definer
set search_path = public
as $function$
  select d.domain, i.id, i.slug, i.name, i.status,
         o.id, o.trade_name, s.id, s.slug, s.name, s.system_type
  from public.neroxa_system_domains d
  join public.neroxa_system_instances i on i.id = d.system_instance_id
  join public.neroxa_organizations o on o.id = i.organization_id
  left join public.neroxa_systems s on s.id = i.system_id
  where lower(d.domain) = lower(trim(trailing '.' from trim(p_domain)))
    and d.status = 'VERIFIED'
    and i.status = 'ACTIVE'
    and o.active = true
    and (s.id is null or s.active = true)
  limit 1;
$function$;

create or replace function public.calculate_public_order_line_price(
  p_instance_id uuid,
  p_product_id uuid,
  p_second_product_id uuid,
  p_size_id text,
  p_crust_id text,
  p_addons jsonb,
  p_complements jsonb
)
returns numeric
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_product record;
  v_second record;
  v_org uuid;
  v_rule text := 'highest_half';
  v_fixed numeric;
  v_base numeric := 0;
  v_second_base numeric := 0;
  v_crust numeric := 0;
  v_addons numeric := 0;
  v_complements numeric := 0;
  v_choice jsonb;
  v_item jsonb;
  v_id uuid;
  v_addon_price numeric;
begin
  select p.*, i.organization_id into v_product
  from public.neroxa_storefront_products p
  join public.neroxa_system_instances i on i.id = p.instance_id
  where p.id = p_product_id and p.instance_id = p_instance_id and p.active;
  if not found then raise exception 'Produto não disponível'; end if;

  v_org := v_product.organization_id;
  select s.half_pizza_pricing_rule, s.half_pizza_fixed_price
    into v_rule, v_fixed
  from public.neroxa_storefront_settings s where s.organization_id = v_org;

  v_base := coalesce(v_product.price, 0);
  if p_size_id is not null then
    select choice into v_choice
    from jsonb_array_elements(coalesce(v_product.metadata->'options','[]'::jsonb)) opt
    cross join lateral jsonb_array_elements(coalesce(opt->'choices','[]'::jsonb)) choice
    where opt->>'id' = 'tamanho' and choice->>'id' = p_size_id limit 1;
    v_base := v_base + coalesce((v_choice->>'price')::numeric, 0);
  end if;

  if p_second_product_id is not null then
    select * into v_second from public.neroxa_storefront_products
    where id = p_second_product_id and instance_id = p_instance_id and active;
    if not found then raise exception 'Segundo sabor não disponível'; end if;
    v_second_base := coalesce(v_second.price, 0);
    if p_size_id is not null then
      select choice into v_choice
      from jsonb_array_elements(coalesce(v_second.metadata->'options','[]'::jsonb)) opt
      cross join lateral jsonb_array_elements(coalesce(opt->'choices','[]'::jsonb)) choice
      where opt->>'id' = 'tamanho' and choice->>'id' = p_size_id limit 1;
      v_second_base := v_second_base + coalesce((v_choice->>'price')::numeric, 0);
    end if;
    if coalesce(v_rule, 'highest_half') = 'average_halves' then
      v_base := (v_base + v_second_base) / 2;
    elsif coalesce(v_rule, 'highest_half') = 'fixed_price' and v_fixed is not null then
      v_base := v_fixed;
    else
      v_base := greatest(v_base, v_second_base);
    end if;
  end if;

  if p_crust_id is not null then
    select coalesce((choice->>'price')::numeric, 0) into v_crust
    from jsonb_array_elements(coalesce(v_product.metadata->'options','[]'::jsonb)) opt
    cross join lateral jsonb_array_elements(coalesce(opt->'choices','[]'::jsonb)) choice
    where opt->>'id' = 'borda' and choice->>'id' = p_crust_id limit 1;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_addons,'[]'::jsonb)) loop
    v_id := nullif(v_item->>'id','')::uuid;
    if v_id is null then raise exception 'Adicional inválido'; end if;
    select price into v_addon_price from public.neroxa_storefront_products
    where id = v_id and instance_id = p_instance_id and active;
    if not found then raise exception 'Adicional não disponível'; end if;
    v_addons := v_addons + coalesce(v_addon_price, 0);
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_complements,'[]'::jsonb)) loop
    v_id := nullif(v_item->>'productId','')::uuid;
    if v_id is null then raise exception 'Acompanhamento inválido'; end if;
    select price into v_addon_price from public.neroxa_storefront_products
    where id = v_id and instance_id = p_instance_id and active;
    if not found then raise exception 'Acompanhamento não disponível'; end if;
    v_complements := v_complements + coalesce(v_addon_price, 0);
  end loop;

  return v_base + v_crust + v_addons + v_complements;
end;
$function$;
