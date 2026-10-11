# Compatibility gate — Neroxa Master × Delivery (draft)

Scope: GitHub source comparison only. **Not** a production or test Supabase schema audit; do not apply migrations based on this document alone.

## Verified against Neroxa Master source
Source: `luit77yak-dev/neroxa-master/src/routes/master-catalogo.tsx` (default branch, inspected 2026-10-11).

- Master reads/writes `neroxa_storefront_categories`, `neroxa_storefront_products` and `neroxa_storefront_settings` directly as the signed-in user.
- Master category writes include `image_url` and `updated_at`. **Missing from the staged category CREATE TABLE** in `20261011150000_supplier_catalog_schema_and_rls.sql`. A fresh schema built solely from the candidate would break Master category edits.
- Master product writes include `updated_at`. The test fixture and staged product ALTER do **not** guarantee this column exists. A fresh schema built from the fixture would break Master product edits.
- Master settings upsert writes `organization_id`, `storefront_theme` and `updated_at`. The isolated fixture does not contain `storefront_theme` or `updated_at`; staged settings RLS does not add them.
- Master uses `getNeroxaPlatformAccess` and role checks on the client. RLS must enforce authorization on the server independently; client checks are not sufficient.
- Current staged catalog RLS allows **any active organization member** to write. The UI's `canManageCatalog` denies OPERATOR; role-aware RLS must be reconciled with authoritative Master role columns and semantics before release.
- Current staged settings/zones RLS grants active organization members full write permissions. Confirm which roles may modify prices, delivery fees, appearance and settings.
- Master `neroxa_system_instances` listing and platform access rely on separate grants/RLS, not covered by the two staged supplier migrations.
- Public catalog RPC is SECURITY DEFINER; confirm owner, execution grants and behavior under RLS against the real database.

## Read-only pre-deployment verification
Run only with explicit permission against a selected project; never alter schema or data:

```sql
select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name in (
 'neroxa_storefront_categories','neroxa_storefront_products',
 'neroxa_storefront_settings','neroxa_storefront_delivery_zones',
 'neroxa_organization_members','neroxa_platform_members',
 'neroxa_system_instances'
)
order by table_name,ordinal_position;

select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies
where schemaname='public' and tablename like 'neroxa_%'
order by tablename,policyname;

select n.nspname,p.proname,pg_get_userbyid(p.proowner) as owner,
 p.prosecdef as security_definer,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'get_public_storefront_catalog','get_public_storefront_context',
 'neroxa_is_platform_member','get_supplier_panel_context'
);
```

## Release blockers
1. Compare **actual** Master Supabase schema, policies, privileges, function owners and role fields against the staged migration and isolated fixture.
2. Resolve missing category/product/settings columns with additive, compatibility-tested migrations; don't infer from fixture alone.
3. Tighten RLS writes to intended organization roles and preserve Neroxa platform administrator access.
4. Add isolated regression tests for Master category image/timestamp, product timestamp, settings theme/timestamp, unauthorized OPERATOR writes and public catalog RPC.
5. Rerun full CI. Require separately approved backup/restore readiness and rollout plan before remote migrations.

Status: **compatibility not approved; no remote schema modifications**.
