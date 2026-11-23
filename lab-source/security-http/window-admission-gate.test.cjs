'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {evaluateAdmission,PINS,MAX_WINDOW_MS}=require('./window-admission-gate.cjs');
const NOW=Date.parse('2026-11-23T16:00:00.000Z');
function fullReceipt(){
 return {
  cloudflare:{worker:PINS.worker,deployedVersion:PINS.original,deployedPercent:100,workersDev:false,previews:false},
  stage:{version:PINS.closedStaging,deployed:false,modulesVerified:53,duplicateModules:0,assetsMatch:true,quotaSecretInherited:true,deadline:PINS.closedDeadline},
  access:{appId:PINS.accessApp,workerTag:PINS.accessWorkerTag,policyDecisionAllow:true,bypassPolicyPresent:false,runtimeAnonymousDenied:true,runtimeAuthenticatedVerified:true},
  hyperdrive:{id:PINS.hyperdrive,project:PINS.labProject,sslmode:'verify-full'},
  database:{project:PINS.labProject,healthy:true},
  grants:{activeA:1,activeB:0,revokedA:5,temporaryGrantDeadlineMatch:true,grantPreparedViaPrivateChannel:true},
  watchdog:{workerPresent:true,cronTriggers:1,guardEnabled:true,armed:true,rollbackTarget:PINS.original,restoreProven:true,hostCloseProven:true,grantRevocationProven:true,deadlineMatch:true},
  futureWindow:{freshVersionVerified:true,deployable:true,version:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',deadline:new Date(NOW+10*60*1000).toISOString(),assetParityVerified:true,workerModulesVerified:53,publicCheckoutOff:true,isolatedLabA:true}
 };
}
function reasons(mutator){
 const sample=fullReceipt();mutator(sample);
 return evaluateAdmission(sample,NOW).reasons;
}
test('no observation: fail closed; never grants deployment authority',()=>{
 const r=evaluateAdmission(null,NOW);
 assert.equal(r.state,'HOLD');assert.ok(r.reasons.includes('OBSERVATION_REQUIRED'));assert.equal(r.authority,'NONE');
});
test('synthetic complete receipt can only reach review, never operational GO',()=>{
 const r=evaluateAdmission(fullReceipt(),NOW);
 assert.equal(r.state,'REVIEW_READY_NOT_AUTHORIZED');
 assert.equal(r.authority,'NONE');assert.equal(r.network,'NONE');assert.equal(r.writes,'NONE');
 assert.equal(r.liveHttp,'NOT_RUN');assert.equal(r.commercialGo,'NO_GO');
});
test('actual known blockers reject admission (watchdog off, no cron, no active grant, no live candidate, no Access runtime proof)',()=>{
 const r=fullReceipt();
 r.watchdog.guardEnabled=false;r.watchdog.armed=false;r.watchdog.cronTriggers=0;
 r.access.runtimeAnonymousDenied=false;r.access.runtimeAuthenticatedVerified=false;
 r.grants.activeA=0;r.grants.temporaryGrantDeadlineMatch=false;
 r.futureWindow.version=PINS.closedStaging;r.futureWindow.deadline=PINS.closedDeadline;
 const outcome=evaluateAdmission(r,NOW);
 assert.equal(outcome.state,'HOLD');
 for(const reason of ['INDEPENDENT_WATCHDOG_UNARMED','ACCESS_RUNTIME_PROOF_MISSING','LAB_GRANT_ADMISSION_MISSING','FRESH_BOUNDED_CANDIDATE_MISSING'])assert.ok(outcome.reasons.includes(reason),reason);
});
test('cannot replace independent rollback with a scheduled handler alone',()=>{
 const result=reasons(x=>{x.watchdog.cronTriggers=0;x.watchdog.guardEnabled=false;x.watchdog.armed=false;x.watchdog.restoreProven=false;});
 assert.ok(result.includes('INDEPENDENT_WATCHDOG_UNARMED'));
 assert.ok(result.includes('AUTOMATIC_CLOSURE_NOT_PROVEN'));
});
test('refuses expiry beyond 15 minutes, expired windows and stopped clocks',()=>{
 assert.equal(MAX_WINDOW_MS,900000);
 for(const deadline of [NOW+900001,NOW,NOW-1]){
   assert.ok(reasons(x=>{x.futureWindow.deadline=new Date(deadline).toISOString()}).includes('FRESH_BOUNDED_CANDIDATE_MISSING'));
 }
 assert.ok(evaluateAdmission(fullReceipt(),NaN).reasons.includes('CLOCK_INVALID'));
});
test('host opening before admission is always denied, even with a good rollback receipt',()=>{
 assert.ok(reasons(x=>{x.cloudflare.workersDev=true}).includes('HOST_NOT_CLOSED'));
 assert.ok(reasons(x=>{x.cloudflare.previews=true}).includes('HOST_NOT_CLOSED'));
 assert.ok(reasons(x=>{x.cloudflare.deployedPercent=99}).includes('ORIGINAL_NOT_AT_100'));
});
test('wrong LAB binding, bypass Access, revoked grant and cross-tenant A/B state must fail',()=>{
 assert.ok(reasons(x=>{x.hyperdrive.project='wrong'}).includes('LAB_HYPERDRIVE_UNVERIFIED'));
 assert.ok(reasons(x=>{x.access.bypassPolicyPresent=true}).includes('ACCESS_POLICY_MISMATCH'));
 assert.ok(reasons(x=>{x.grants.activeA=0}).includes('LAB_GRANT_ADMISSION_MISSING'));
 assert.ok(reasons(x=>{x.grants.activeB=1}).includes('LAB_GRANT_ADMISSION_MISSING'));
});
test('inert stage and composition required; cannot use closed stage as live candidate',()=>{
 assert.ok(reasons(x=>{x.stage.deadline='2026-11-23T16:10:00Z'}).includes('STAGE_NOT_FAIL_CLOSED'));
 assert.ok(reasons(x=>{x.stage.modulesVerified=52}).includes('STAGE_NOT_FAIL_CLOSED'));
 assert.ok(reasons(x=>{x.futureWindow.version=PINS.closedStaging}).includes('FRESH_BOUNDED_CANDIDATE_MISSING'));
 assert.ok(reasons(x=>{x.futureWindow.assetParityVerified=false}).includes('LIVE_COMPOSITION_UNVERIFIED'));
});
test('deny secret fields in observation even if synthetic conditions are green',()=>{
 const sample=fullReceipt();sample.operators={token_sha256:'deadbeef'};
 const r=evaluateAdmission(sample,NOW);
 assert.equal(r.state,'HOLD');assert.ok(r.reasons.includes('SENSITIVE_CONTENT_NOT_ALLOWED'));
 const inner=fullReceipt();inner.evidence={operator:{bearer:'private'}};
 assert.ok(evaluateAdmission(inner,NOW).reasons.includes('SENSITIVE_CONTENT_NOT_ALLOWED'));
});
