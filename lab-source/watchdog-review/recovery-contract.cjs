'use strict';
// NEROXA LAB watchdog recovery CONTRACT — review only, not a Worker entrypoint.
// No credentials, SQL client, Cloudflare HTTP, D1, deployment, or remote actions.
// The adapters in a future Worker MUST implement these methods with restricted auth.
// Every scheduled tick retries incomplete recovery: no "one-shot" guard can block retries.

const LAB_A='7e020000-0000-4000-8000-000000000001';
const ORIGINAL='33c3539b-b50a-48b5-b869-9a4aa6811fed';
const MAX_WINDOW_MS=15*60*1000;
const REQUIREMENTS=Object.freeze([
  Object.freeze({name:'HOST_CLOSED',read:'isHostClosed',write:'closeHost'}),
  Object.freeze({name:'LAB_A_GRANT_REVOKED',read:'isTemporaryLabAGrantRevoked',write:'revokeTemporaryLabAGrant'}),
  Object.freeze({name:'ORIGINAL_100',read:'isOriginalAt100',write:'restoreOriginal100'})
]);

function result(state,details){
  return Object.freeze({state,details:Object.freeze(details.slice()),authority:'NONE',
    access:'NOT_OPENED',commercialGo:'NO_GO'});
}
function authorizedWindow(config,now){
  if(!config||config.armed!==true||config.guardEnabled!==true)return false;
  if(config.targetInstance!==LAB_A||config.originalVersion!==ORIGINAL)return false;
  if(!Number.isFinite(now)||!Number.isFinite(config.startedAtMs)||!Number.isFinite(config.deadlineMs))return false;
  if(config.deadlineMs<=config.startedAtMs||config.deadlineMs-config.startedAtMs>MAX_WINDOW_MS)return false;
  return true;
}

/*
 * Each of the three effects is independent: one failing MUST NOT suppress the
 * other safety actions. Verify before and after applying, retry on every tick
 * when unverified, and never mark complete without grant revocation readback.
 * The current legacy watchdog has no grant-revocation adapter: that condition
 * is a blocking missing requirement, not an implicit PASS.
 */
async function reconcileRecovery(config,adapters,nowMs=Date.now()){
  if(!config||config.armed!==true)return result('IDLE_NOT_ARMED',[]);
  if(!authorizedWindow(config,nowMs))return result('HOLD_INVALID_OR_UNAUTHORIZED_WINDOW',['WINDOW_GATE']);
  if(nowMs<config.deadlineMs)return result('ARMED_NOT_DUE',[]);
  const notes=[];
  let verified=0;
  for(const {name,read,write} of REQUIREMENTS){
    // Adapters are mock-injected during review, never used against remote hosts.
    if(!adapters||typeof adapters[read]!=='function'||typeof adapters[write]!=='function'){
      notes.push(name+'_ADAPTER_MISSING');
      continue;
    }
    let already=false;
    try{already=await adapters[read]({instanceId:LAB_A,originalVersion:ORIGINAL})===true;}
    catch{notes.push(name+'_PRECHECK_ERROR');}
    if(!already){
      try{await adapters[write]({instanceId:LAB_A,originalVersion:ORIGINAL});}
      catch{notes.push(name+'_WRITE_FAILED');}
    }
    try{
      const confirmed=await adapters[read]({instanceId:LAB_A,originalVersion:ORIGINAL});
      if(confirmed===true){verified++;continue;}
      notes.push(name+'_READBACK_FAILED');
    }catch{notes.push(name+'_READBACK_ERROR');}
  }
  return result(verified===REQUIREMENTS.length?'RECOVERY_VERIFIED':'HOLD_RETRY_NEXT_TICK',notes);
}

module.exports={reconcileRecovery,authorizedWindow,REQUIREMENTS,MAX_WINDOW_MS,LAB_A,ORIGINAL};
