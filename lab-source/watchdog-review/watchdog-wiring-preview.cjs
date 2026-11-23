'use strict';

// Integrates the LAB A private grant port with all three recovery invariants.
// REVIEW ONLY: no Worker entrypoint, real Cloudflare API client, pg package,
// credentials, or external I/O. Never import from a deployed Worker unbundled.

const {reconcileRecovery,LAB_A,ORIGINAL}=require('./recovery-contract.cjs');
const {makeLabARevoker}=require('./grant-revoke-adapter.cjs');

function makeWatchdogScheduledPreview({createDbClient,cloudflarePort}){
  if(typeof createDbClient!=='function' || !cloudflarePort)
    throw Error('WATCHDOG_PREVIEW_PORTS_REQUIRED');
  for(const name of ['isHostClosed','closeHost','isOriginalAt100','restoreOriginal100']){
    if(typeof cloudflarePort[name]!=='function')throw Error('CLOUDFLARE_PREVIEW_PORT_MISSING');
  }

  return async function scheduled(env,nowMs=Date.now()){
    // State is intentionally private and not logged/serialized. The flags
    // must be literal strings from the eventual Worker environment.
    if(!env || env.I04_WATCHDOG_ARMED!=='true')
      return Object.freeze({state:'IDLE_NOT_ARMED',authority:'NONE',commercialGo:'NO_GO'});

    const windowStarted=Date.parse(env.I04_WATCHDOG_WINDOW_STARTED_ISO||'');
    const windowEnds=Date.parse(env.I04_WATCHDOG_DEADLINE_ISO||'');
    const grantEnds=Date.parse(env.I04_TEMP_GRANT_EXPIRES_AT_ISO||'');
    if(!Number.isFinite(windowStarted)||!Number.isFinite(windowEnds)||
       !Number.isFinite(grantEnds) || grantEnds!==windowEnds ||
       windowEnds-windowStarted>15*60000 || windowEnds<=windowStarted)
       return Object.freeze({state:'HOLD_INVALID_OR_UNAUTHORIZED_WINDOW',authority:'NONE',
         commercialGo:'NO_GO'});

    const config={
      armed:true,guardEnabled:env.I04_GUARD_ENABLED==='true',
      targetInstance:LAB_A,originalVersion:ORIGINAL,
      startedAtMs:windowStarted,deadlineMs:windowEnds
    };
    // Do not open DB connections until due; incomplete/corrupt metadata
    // fails the recovery gate before any Cloudflare or database writes.
    if(config.guardEnabled!==true || !Number.isFinite(nowMs))
       return Object.freeze({state:'HOLD_INVALID_OR_UNAUTHORIZED_WINDOW',authority:'NONE',commercialGo:'NO_GO'});
    if(nowMs<windowEnds)
       return Object.freeze({state:'ARMED_NOT_DUE',authority:'NONE',commercialGo:'NO_GO'});

    let grant;
    try{
      grant=makeLabARevoker({
        createClient:createDbClient,grantId:env.I04_TEMP_GRANT_ID,
        createdAtIso:env.I04_WATCHDOG_WINDOW_STARTED_ISO,
        expiresAtIso:env.I04_TEMP_GRANT_EXPIRES_AT_ISO
      });
    }catch{
      // Missing grant metadata must NOT prevent emergency host closure or
      // restoration. Omit the grant port so the recovery contract reports
      // an explicit missing adapter while executing the other two ports.
      grant={};
    }
    const adapters={
      isHostClosed:cloudflarePort.isHostClosed,
      closeHost:cloudflarePort.closeHost,
      isOriginalAt100:cloudflarePort.isOriginalAt100,
      restoreOriginal100:cloudflarePort.restoreOriginal100,
      ...grant
    };
    return reconcileRecovery(config,adapters,nowMs);
  };
}
module.exports=Object.freeze({makeWatchdogScheduledPreview});
