-- REVIEW ONLY; NOT RUN. No safe replacement for this legacy schema is validated.
-- This is an OFFLINE disposable rehearsal quarantine, NOT a live cutover script.
-- It intentionally disables legacy storefront/admin/phone-tracking consumers.
-- Do not apply to the Master neroxa_* profile or a mixed schema.
BEGIN;
DO $guard$ BEGIN
 IF current_setting('neroxa.mission02a2_disposable',true) IS DISTINCT FROM 'on' THEN
  RAISE EXCEPTION '02A2 disposable intent missing'; END IF;
 IF to_regclass('public.orders') IS NULL OR to_regclass('public.organization_members') IS NULL
 OR to_regprocedure('public.update_order_status(uuid,uuid,public.order_status,text)') IS NULL
 OR to_regclass('public.neroxa_orders') IS NOT NULL THEN
  RAISE EXCEPTION '02A2 legacy profile mismatch; do not mix Master candidate artifacts'; END IF;
END $guard$;

-- Remove table AND column ACL paths. Existing policies/grants must still be
-- inventoried for inherited roles, views, definer functions and external clients.
DO $tables$
DECLARE t text; c text;
BEGIN
 FOREACH t IN ARRAY ARRAY['organizations','organization_members','organization_settings',
 'products','categories','product_sizes','product_prices','product_addons',
 'product_crusts','product_addon_links','store_hours','special_hours',
 'delivery_zones','orders','order_items','order_status_history','drivers','loyalty_accounts'] LOOP
  IF to_regclass(format('public.%I',t)) IS NULL THEN
   RAISE EXCEPTION '02A2 legacy relation missing: %',t; END IF;
  EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC,anon,authenticated',t);
  FOR c IN SELECT attname FROM pg_attribute
   WHERE attrelid=to_regclass(format('public.%I',t)) AND attnum>0 AND NOT attisdropped LOOP
   EXECUTE format('REVOKE SELECT (%I), INSERT (%I), UPDATE (%I), REFERENCES (%I) ON TABLE public.%I FROM PUBLIC,anon,authenticated',c,c,c,c,t);
  END LOOP;
 END LOOP;
END $tables$;

-- Revoke every overload of these known legacy entrypoints. Preserve owner and
-- existing service ACLs; no new service privileges, no DROP FUNCTION or data DDL.
DO $rpc$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid, p.oid::regprocedure AS signature FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
 AND p.proname=ANY(ARRAY['claim_first_owner','update_order_status',
 'get_public_storefront_settings','get_public_order_status','create_public_order',
 'append_public_order_items','append_public_order_items_with_payment']) LOOP
  EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  IF has_function_privilege('anon',f.oid,'EXECUTE') OR
     has_function_privilege('authenticated',f.oid,'EXECUTE') THEN
   RAISE EXCEPTION '02A2 inherited RPC privilege remains: %',f.signature;
  END IF;
 END LOOP;
END $rpc$;

-- Bucket quarantine is restrictive (AND), not an extra permissive policy.
-- Images are retained. Public URLs/reads also become unavailable in this profile.
-- Storage native RLS must already be enabled. The managed executor may create
-- policies but cannot ALTER the protected relation; do not transfer ownership.
DO $$ BEGIN IF NOT coalesce((SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass),false) THEN RAISE EXCEPTION 'Native Storage RLS prerequisite missing'; END IF; END $$;
DROP POLICY IF EXISTS mission02a2_legacy_images_quarantine ON storage.objects;
CREATE POLICY mission02a2_legacy_images_quarantine ON storage.objects
 AS RESTRICTIVE FOR ALL TO anon,authenticated
 USING (bucket_id <> 'product-images') WITH CHECK (bucket_id <> 'product-images');
COMMIT;
-- No automatic inverse GRANT or route reactivation is an acceptable rollback.
-- On failure ROLLBACK the rehearsal transaction, keep pilot unavailable; restore
-- only into another disposable target, then apply a reviewed safe successor.
