-- Candidate additive compatibility patch for Master catalog UI.
-- No remote database changes; validate actual Master schema before rollout.
alter table public.neroxa_storefront_categories
 add column if not exists image_url text,
 add column if not exists updated_at timestamptz not null default now();
alter table public.neroxa_storefront_products
 add column if not exists updated_at timestamptz not null default now();
alter table public.neroxa_storefront_settings
 add column if not exists storefront_theme text not null default 'neroxa-classic',
 add column if not exists updated_at timestamptz not null default now();
-- Existing Master app explicitly sets updated_at. Do not replace its update triggers.
-- This migration intentionally does not alter role semantics or existing data.
