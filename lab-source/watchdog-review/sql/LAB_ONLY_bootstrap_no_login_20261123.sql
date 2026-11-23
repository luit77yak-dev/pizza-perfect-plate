-- NEROXA V1 LAB A ONLY. Transactional bootstrap; NOLOGIN by design.
-- This file is applied only to Supabase LAB gomexvhvecvvfbdzhjct.
-- NO password, NO direct table privileges, NO public schema exposure.
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles
             WHERE rolname='neroxa_i04_lab_watchdog_revoke') THEN
    RAISE EXCEPTION 'NEROXA_LAB_REVOKER_ROLE_ALREADY_EXISTS';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='private'
      AND p.proname IN (
        'neroxa_i04_watchdog_lab_a_grant_revoked',
        'neroxa_i04_watchdog_lab_a_revoke_grant'
      )
  ) THEN RAISE EXCEPTION 'NEROXA_LAB_REVOKER_FUNCTION_ALREADY_EXISTS'; END IF;

  CREATE ROLE neroxa_i04_lab_watchdog_revoke
    NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
END;
$$;

CREATE FUNCTION private.neroxa_i04_watchdog_lab_a_grant_revoked(
  p_grant_id uuid, p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $read_revoke$
  SELECT EXISTS(
    SELECT 1 FROM private.neroxa_lab_operator_grants AS g
    WHERE p_grant_id IS NOT NULL
      AND p_expires_at IS NOT NULL
      AND g.id = p_grant_id
      AND g.instance_id = '7e020000-0000-4000-8000-000000000001'::uuid
      AND g.expires_at = p_expires_at
      AND g.expires_at > g.created_at
      AND g.expires_at <= g.created_at + interval '15 minutes'
      AND g.revoked_at IS NOT NULL
  );
$read_revoke$;

CREATE FUNCTION private.neroxa_i04_watchdog_lab_a_revoke_grant(
  p_grant_id uuid, p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $revoke_grant$
BEGIN
  IF p_grant_id IS NULL OR p_expires_at IS NULL THEN
    RETURN false;
  END IF;
  UPDATE private.neroxa_lab_operator_grants AS g
     SET revoked_at = pg_catalog.clock_timestamp()
   WHERE g.id = p_grant_id
     AND g.instance_id = '7e020000-0000-4000-8000-000000000001'::uuid
     AND g.expires_at = p_expires_at
     AND g.expires_at > g.created_at
     AND g.expires_at <= g.created_at + interval '15 minutes'
     AND g.revoked_at IS NULL;

  RETURN private.neroxa_i04_watchdog_lab_a_grant_revoked(p_grant_id,p_expires_at);
END;
$revoke_grant$;

-- Explicitly remove DEFAULT EXECUTE for PUBLIC within the same transaction.
REVOKE ALL ON FUNCTION private.neroxa_i04_watchdog_lab_a_grant_revoked(uuid,timestamptz)
  FROM PUBLIC, anon, authenticated, service_role, authenticator;
REVOKE ALL ON FUNCTION private.neroxa_i04_watchdog_lab_a_revoke_grant(uuid,timestamptz)
  FROM PUBLIC, anon, authenticated, service_role, authenticator;

GRANT USAGE ON SCHEMA private TO neroxa_i04_lab_watchdog_revoke;
GRANT EXECUTE ON FUNCTION private.neroxa_i04_watchdog_lab_a_grant_revoked(uuid,timestamptz)
  TO neroxa_i04_lab_watchdog_revoke;
GRANT EXECUTE ON FUNCTION private.neroxa_i04_watchdog_lab_a_revoke_grant(uuid,timestamptz)
  TO neroxa_i04_lab_watchdog_revoke;

-- Do NOT grant LOGIN, a database password, table DML, RLS bypass,
-- public Data API access, or memberships. No grant row is changed.
COMMIT;