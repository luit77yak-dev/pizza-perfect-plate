-- Storefront-only configuration. Does not alter catalog, pricing, cart, checkout, orders or payments.
alter table public.neroxa_storefront_settings
  add column if not exists visual_overrides jsonb not null default '{}'::jsonb;

alter table public.neroxa_storefront_settings
  drop constraint if exists neroxa_storefront_settings_visual_overrides_object;

alter table public.neroxa_storefront_settings
  add constraint neroxa_storefront_settings_visual_overrides_object
  check (jsonb_typeof(visual_overrides) = 'object');
