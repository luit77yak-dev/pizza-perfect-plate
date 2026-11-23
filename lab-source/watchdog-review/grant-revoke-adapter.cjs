'use strict';

/**
 * NEROXA LAB A — restricted PostgreSQL revocation adapter (REVIEW ONLY).
 *
 * This is a port for recovery-contract.cjs, not a deployed Worker.
 * A separately provisioned PostgreSQL role may EXECUTE only two functions
 * in the non-exposed private schema. No direct table DML, no service_role,
 * no credentials in GitHub or logs. Client factory is injected for tests.
 */
const LAB_A='7e020000-0000-4000-8000-000000000001';
const DB_ROLE='neroxa_i04_lab_watchdog_revoke';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTITY_SQL="SELECT current_user AS actor, session_user AS session_actor, current_database() AS db, (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS ssl";
const READ_SQL='SELECT private.neroxa_i04_watchdog_lab_a_grant_revoked($1::uuid,$2::timestamptz) AS revoked';
const REVOKE_SQL='SELECT private.neroxa_i04_watchdog_lab_a_revoke_grant($1::uuid,$2::timestamptz) AS revoked';

function isValidConfig(options) {
  if (!options || typeof options!=='object') return false;
  const {grantId,createdAtIso,expiresAtIso,createClient}=options;
  if(typeof createClient!=='function' || typeof grantId!=='string'||!UUID.test(grantId))return false;
  if(typeof createdAtIso!=='string'||typeof expiresAtIso!=='string')return false;
  const start=Date.parse(createdAtIso),end=Date.parse(expiresAtIso);
  return Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end-start<=15*60000;
}

function makeLabARevoker(options){
  if(!isValidConfig(options))throw Error('LAB_REVOKER_CONFIG_NOT_ADMITTED');
  const params=Object.freeze([options.grantId,options.expiresAtIso]);
  const {createClient}=options;

  async function queryVerified(sql){
    const client=createClient();
    if(!client || typeof client.connect!=='function' ||
       typeof client.query!=='function'||typeof client.end!=='function')
       throw Error('LAB_DB_CLIENT_UNAVAILABLE');
    let connected=false;
    try{
      await client.connect();connected=true;
      const i=await client.query(IDENTITY_SQL);
      if(i?.rows?.length!==1 || i.rows[0].actor!==DB_ROLE ||
         i.rows[0].session_actor!==DB_ROLE ||
         i.rows[0].db!=='postgres'||i.rows[0].ssl!==true)
        throw Error('LAB_DB_IDENTITY_OR_TLS_DENIED');
      const r=await client.query(sql,params.slice());
      if(r?.rows?.length!==1 || r.rows[0].revoked!==true)
        throw Error('LAB_GRANT_REVOCATION_UNVERIFIED');
      return true;
    }finally{
      // Do not leak credentials/query payloads to logs or errors.
      if(connected)await client.end().catch(()=>{});
    }
  }
  function admission(context){
    if(!context||context.instanceId!==LAB_A)
      throw Error('LAB_A_ONLY');
  }
  return Object.freeze({
    async isTemporaryLabAGrantRevoked(context){
      admission(context);return queryVerified(READ_SQL);
    },
    async revokeTemporaryLabAGrant(context){
      admission(context);return queryVerified(REVOKE_SQL);
    }
  });
}
module.exports=Object.freeze({LAB_A,DB_ROLE,IDENTITY_SQL,READ_SQL,REVOKE_SQL,isValidConfig,makeLabARevoker});
