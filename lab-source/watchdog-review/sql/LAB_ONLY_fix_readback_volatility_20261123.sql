-- NEROXA LAB ONLY: align snapshot visibility for UPDATE then same-statement readback.
-- PostgreSQL STABLE can see statement-start snapshot; VOLATILE is required
-- for the revocation read helper called after an UPDATE in the same SQL command.
-- Keep function body, owner, ACL, private schema and NOLOGIN role unchanged.
BEGIN;
ALTER FUNCTION private.neroxa_i04_watchdog_lab_a_grant_revoked(uuid,timestamptz)
  VOLATILE;
COMMIT;