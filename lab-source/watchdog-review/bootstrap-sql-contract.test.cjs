'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.join(__dirname,'sql');
const bootstrap=fs.readFileSync(path.join(dir,'LAB_ONLY_bootstrap_no_login_20261123.sql'),'utf8');
const fix=fs.readFileSync(path.join(dir,'LAB_ONLY_fix_readback_volatility_20261123.sql'),'utf8');
const archived=fs.readFileSync(path.join(dir,'REVIEW_ONLY_lab_a_grant_revocation.sql'),'utf8');

test('applied bootstrap is explicitly limited to LAB project',()=>{
 assert.match(bootstrap,/Supabase LAB gomexvhvecvvfbdzhjct/);
 assert.doesNotMatch(bootstrap,/iefaoaqzltvpfabyeelj/);
 assert.match(bootstrap,/^BEGIN;/m);
 assert.match(bootstrap,/^COMMIT;/m);
});
test('role is NOLOGIN, NOINHERIT and cannot bypass RLS',()=>{
 assert.match(bootstrap,/CREATE ROLE neroxa_i04_lab_watchdog_revoke/);
 assert.match(bootstrap,/NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS/);
 assert.doesNotMatch(bootstrap,/\bPASSWORD\s+'[^']+'/i);
 assert.doesNotMatch(bootstrap,/\bALTER ROLE\b/i);
 assert.doesNotMatch(bootstrap,/\bGRANT\s+(SELECT|UPDATE|INSERT|DELETE)\s+ON\s+private\.neroxa_lab_operator_grants/i);
});
test('functions pin LAB A and exact expiry; reject grants beyond 15min',()=>{
 assert.match(bootstrap,/g\.instance_id = '7e020000-0000-4000-8000-000000000001'::uuid/g);
 assert.doesNotMatch(bootstrap,/7e020000-0000-4000-8000-000000000002/);
 assert.match(bootstrap,/g\.id = p_grant_id/g);
 assert.match(bootstrap,/g\.expires_at = p_expires_at/g);
 assert.match(bootstrap,/g\.expires_at <= g\.created_at \+ interval '15 minutes'/g);
 assert.match(bootstrap,/g\.revoked_at IS NOT NULL/);
 assert.match(bootstrap,/g\.revoked_at IS NULL/);
});
test('function ACL is private, no anonymous/Auth/Service API privilege',()=>{
 assert.match(bootstrap,/CREATE FUNCTION private\.neroxa_i04_watchdog_lab_a_grant_revoked/);
 assert.match(bootstrap,/CREATE FUNCTION private\.neroxa_i04_watchdog_lab_a_revoke_grant/);
 assert.match(bootstrap,/SECURITY DEFINER/g);
 assert.match(bootstrap,/SET search_path = ''/g);
 assert.match(bootstrap,/FROM PUBLIC, anon, authenticated, service_role, authenticator/g);
 assert.match(bootstrap,/GRANT EXECUTE ON FUNCTION private\.neroxa_i04_watchdog_lab_a_revoke_grant/);
 assert.match(bootstrap,/TO neroxa_i04_lab_watchdog_revoke/);
});
test('same-statement readback visibility is corrected in follow-up migration',()=>{
 assert.match(bootstrap,/STABLE/);
 assert.match(fix,/ALTER FUNCTION private\.neroxa_i04_watchdog_lab_a_grant_revoked\(uuid,timestamptz\)/);
 assert.match(fix,/\bVOLATILE;/);
});
test('obsolete draft is deliberately non-executable',()=>{
 assert.match(archived,/ARCHIVED_REVIEW_SQL_NOT_EXECUTABLE/);
 assert.match(archived,/RAISE EXCEPTION 'ARCHIVED_REVIEW_SQL_NOT_EXECUTABLE'/);
 assert.match(archived,/NOLOGIN NOINHERIT PASSWORD NULL/);
});
