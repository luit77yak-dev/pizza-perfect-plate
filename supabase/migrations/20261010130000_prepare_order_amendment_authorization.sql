-- Draft hardening: additive authorization infrastructure for order amendments.
-- Do not deploy until checkout uses an issuance flow and status tracking is migrated.
-- This migration intentionally does not enable a new public write path.

create table if not exists public.neroxa_order_amendment_credentials (
  order_id uuid primary key references public.neroxa_orders(id) on delete cascade,
  token_hash bytea not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.neroxa_order_amendment_credentials enable row level security;
revoke all on public.neroxa_order_amendment_credentials from public, anon, authenticated;
revoke all on function public.append_public_order_items_with_payment(uuid,text,jsonb,text)
  from public, anon, authenticated;

-- Token generation must occur atomically with checkout in a later cutover.
-- Only the token hash belongs in this table; never persist a plaintext bearer token.
-- A separate, token-authorized RPC must enforce order status and payment approval.
-- IMPORTANT: the legacy phone-authorized write RPC is deliberately disabled here.
-- Do not run this migration until callers are switched to the new flow.
