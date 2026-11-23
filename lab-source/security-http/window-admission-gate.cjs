'use strict';

/*
 * NEROXA LAB — offline admission assessment only.
 * No network, no DB, no Cloudflare API, no secret reads and no deploy.
 * A successful synthetic receipt NEVER authorizes a live window.
 */
const PINS=Object.freeze({
  worker:'neroxa-v1-i04-api-lab',
  original:'33c3539b-b50a-48b5-b869-9a4aa6811fed',
  closedStaging:'de02bde8-0254-4b8a-af20-3dc238169d61',
  accessApp:'072eef2c-ea7e-4544-a5bc-b92fd6a406c2',
  accessWorkerTag:'4c8123c299764d12b767673e47d79837',
  hyperdrive:'e7570caf4da24a53838d3cb9a234d9ac',
  labProject:'gomexvhvecvvfbdzhjct',
  closedDeadline:'2000-01-01T00:00:00Z'
});
const MAX_WINDOW_MS=15*60*1000;
const SENSITIVE_KEY=/(^|_)(token|bearer|jwt|cookie|secret|password|authorization|session_id|sha256|credentials)(_|$)/i;

function hasSensitiveInput(value,depth=0){
  if(depth>10)return true;
  if(!value || typeof value!=='object')return false;
  for(const [key,item] of Object.entries(value)){
    if(SENSITIVE_KEY.test(key))return true;
    if(hasSensitiveInput(item,depth+1))return true;
  }
  return false;
}
function evaluateAdmission(observation,clockMs=Date.now()){
  const blocked=[];
  const hold=code=>{if(!blocked.includes(code))blocked.push(code)};
  const o=observation;
  if(!o || typeof o!=='object'||Array.isArray(o)){
    return Object.freeze({state:'HOLD',reasons:['OBSERVATION_REQUIRED'],authority:'NONE',network:'NONE',writes:'NONE'});
  }
  if(hasSensitiveInput(o))hold('SENSITIVE_CONTENT_NOT_ALLOWED');
  if(!Number.isFinite(clockMs))hold('CLOCK_INVALID');

  const c=o.cloudflare||{}, s=o.stage||{}, a=o.access||{}, h=o.hyperdrive||{};
  const d=o.database||{},g=o.grants||{},w=o.watchdog||{},f=o.futureWindow||{};
  if(c.worker!==PINS.worker||c.deployedVersion!==PINS.original||c.deployedPercent!==100)hold('ORIGINAL_NOT_AT_100');
  if(c.workersDev!==false || c.previews!==false)hold('HOST_NOT_CLOSED');

  if(s.version!==PINS.closedStaging || s.deployed!==false || s.modulesVerified!==53 ||
     s.duplicateModules!==0 || s.assetsMatch!==true ||
     s.quotaSecretInherited!==true || s.deadline!==PINS.closedDeadline)hold('STAGE_NOT_FAIL_CLOSED');
  if(h.id!==PINS.hyperdrive || h.project!==PINS.labProject || h.sslmode!=='verify-full')hold('LAB_HYPERDRIVE_UNVERIFIED');

  if(a.appId!==PINS.accessApp || a.workerTag!==PINS.accessWorkerTag ||
     a.policyDecisionAllow!==true || a.bypassPolicyPresent!==false)hold('ACCESS_POLICY_MISMATCH');
  if(a.runtimeAnonymousDenied!==true || a.runtimeAuthenticatedVerified!==true)
    hold('ACCESS_RUNTIME_PROOF_MISSING');

  if(d.project!==PINS.labProject || d.healthy!==true)hold('LAB_DATABASE_UNVERIFIED');
  if(g.activeA!==1 || g.activeB!==0 || !Number.isInteger(g.revokedA) ||
     g.revokedA<1 || g.temporaryGrantDeadlineMatch!==true ||
     g.grantPreparedViaPrivateChannel!==true)hold('LAB_GRANT_ADMISSION_MISSING');

  if(w.workerPresent!==true || !Number.isInteger(w.cronTriggers) || w.cronTriggers<1 ||
     w.guardEnabled!==true || w.armed!==true)hold('INDEPENDENT_WATCHDOG_UNARMED');
  if(w.rollbackTarget!==PINS.original || w.restoreProven!==true ||
     w.hostCloseProven!==true || w.grantRevocationProven!==true ||
     w.deadlineMatch!==true)hold('AUTOMATIC_CLOSURE_NOT_PROVEN');

  const expiry=typeof f.deadline==='string'?Date.parse(f.deadline):NaN;
  if(f.freshVersionVerified!==true || f.deployable!==true ||
     f.version===PINS.closedStaging || typeof f.version!=='string' ||
     !Number.isFinite(expiry)||!Number.isFinite(clockMs)||
     expiry<=clockMs||expiry-clockMs>MAX_WINDOW_MS)hold('FRESH_BOUNDED_CANDIDATE_MISSING');
  if(f.assetParityVerified!==true || f.workerModulesVerified!==53)hold('LIVE_COMPOSITION_UNVERIFIED');
  if(f.publicCheckoutOff!==true || f.isolatedLabA!==true)hold('PUBLIC_OR_TENANT_BOUNDARY_UNVERIFIED');

  // Even an all-green receipt is only a *human review input*. Runtime evidence
  // is independently rechecked immediately before any separately approved writes.
  return Object.freeze({
    state:blocked.length?'HOLD':'REVIEW_READY_NOT_AUTHORIZED',
    reasons:Object.freeze(blocked),
    authority:'NONE',
    network:'NONE',writes:'NONE',
    liveHttp:'NOT_RUN',commercialGo:'NO_GO'
  });
}
module.exports={evaluateAdmission,PINS,MAX_WINDOW_MS};
