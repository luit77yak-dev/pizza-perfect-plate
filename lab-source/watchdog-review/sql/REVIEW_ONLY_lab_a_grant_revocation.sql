-- NEROXA LAB A — SECURITY REVIEW ONLY / NOT APPLIED.
-- This is a proposed private PostgreSQL contract, NOT a migration.
-- Do not execute without explicit DB-write approval, independent review,
-- private password provisioning, a rollback plan and confirmation that the
-- "private" schema is not exposed by the Supabase Data API.
-- Current project: gomexvhvecvvfbdzhjct (LAB); NEVER commercial Supabase.
--
-- Threat reduction: the login role has no raw table privileges. SECURITY
-- DEFINER executes as owner (with RLS bypass), so the function deliberately
-- pins *instance_id* to LAB A, pins grant UUID AND exact expiry, and accepts
-- only grants with <= 15-minute duration. A stolen role still has the ability
-- to revoke a correctly identified 15-minute LAB A grant: review this risk.
--
-- Password is NULL intentionally; connection is impossible until secure
-- password provisioning through a private channel and a separate Hyperdrive
-- configuration restricted to the LAB database. Do not add service_role keys.

BEGIN;

DO $create_restricted_role$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='neroxa_i04_lab_watchdog_revoke') THEN
  CREATE ROLE neroxa_i04_lab_watchdog_revoke LOGIN NOINHERIT PASSWORD NULL;
 END IF;
END
$create_restricted_role$;

CREATE OR REPLACE FUNCTION private.neroxa_i04_watchdog_lab_a_grant_revoked(
  p_grant_id uuid, p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
 SELECT EXISTS(
   SELECT 1 FROM private.neroxa_lab_operator_grants g
   WHERE p_grant_id IS NOT NULL
     AND p_expires_at IS NOT NULL
     AND g.id = p_grant_id
     AND g.instance_id = '7e020000-0000-4000-8000-000000000001'::uuid
     AND g.expires_at = p_expires_at
     AND g.expires_at > g.created_at
     AND g.expires_at <= g.created_at + interval '15 minutes'
     AND g.revoked_at IS NOT NULL
 );
$function$;

CREATE OR REPLACE FUNCTION private.neroxa_i04_watchdog_lab_a_revoke_grant(
  p_grant_id uuid, p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
 IF p_grant_id IS NULL OR p_expires_at IS NULL THEN RETURN false; END IF;
 -- Never accepts arbitrary instance_id: LAB A is immutable in this routine.
 UPDATE private.neroxa_lab_operator_grants g
 SET revoked_at = pg_catalog.clock_timestamp()
 WHERE g.id = p_grant_id
   AND g.instance_id = '7e020000-0000-4000-8000-000000000001'::uuid
   AND g.expires_at = p_expires_at
   AND g.expires_at > g.created_at
   AND g.expires_at <= g.created_at + interval '15 minutes'
   AND g.revoked_at IS NULL;

 RETURN private.neroxa_i04_watchdog_lab_a_grant_revoked(
   p_grant_id, p_expires_at
 );
END;
$function$;

-- IMPORTANT: public EXECUTE is PostgreSQL's default for new functions;
-- revoke it in the SAME transaction before exposing the new routines.
REVOKE ALL ON FUNCTION private.neroxa_i04_watchdog_lab_a_grant_revoked(uuid,timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.neroxa_i04_watchdog_lab_a_revoke_grant(uuid,timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT USAGE ON SCHEMA private TO neroxa_i04_lab_watchdog_revoke;
GRANT EXECUTE ON FUNCTION private.neroxa_i04_watchdog_lab_a_grant_revoked(uuid,timestamptz)
  TO neroxa_i04_lab_watchdog_revoke;
GRANT EXECUTE ON FUNCTION private.neroxa_i04_watchdog_lab_a_revoke_grant(uuid,timestamptz)
  TO neroxa_i04_lab_watchdog_revoke;

-- The role should have ZERO SELECT/UPDATE access to the private grants table,
-- ZERO DDL rights, ZERO membership in postgres/service_role.
-- A role must not be allowed to call the functions via any public Data API.
COMMIT;

-- Additional mandatory independent CHECKS before considering this SQL approved:
--   pg_get_functiondef(), has_function_privilege(), has_table_privilege(),
--   schema exposure, role memberships, password privacy and role TLS.
-- Revoke-by-id test must prove: A one 15min grant revoked, repeat idempotent,
-- wrong grant id false, wrong expiry false, LAB B denied, >15min denied,
-- no function EXECUTE to PUBLIC/anon/authenticated/service_role.
-- DO NOT use the above as proof that any remote migration has occurred.
