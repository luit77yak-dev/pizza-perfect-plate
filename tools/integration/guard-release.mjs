#!/usr/bin/env node
/**
 * NEROXA V1 — static release integration guard.
 * Read-only and offline. PASS is NOT production admission.
 * Usage: node tools/integration/guard-release.mjs food|master|institutional .
 */
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';

const [mode, rootInput]=process.argv.slice(2);
if(!['food','master','institutional'].includes(mode)||!rootInput){
  console.error('USAGE: node guard-release.mjs food|master|institutional /repo');
  process.exit(2);
}
const root=resolve(rootInput);
let checked=0;
const findings=[];
function check(ok,id,detail=''){
  checked++;
  if(!ok) findings.push({id,detail});
  process.stdout.write((ok?'PASS ':'FAIL ')+id+(detail?' :: '+detail:'')+'\n');
}
function source(p){return readFileSync(join(root,p),'utf8');}
function json(p){return JSON.parse(source(p));}
function safe(fn,id){
  try{fn();}
  catch(e){check(false,id,e instanceof Error?e.message:String(e));}
}
function sha256(data){return createHash('sha256').update(data).digest('hex');}

if(mode==='food')safe(()=>{
  const route=source('src/routes/api/checkout.ts');
  const closed=source('src/server/pilot-checkout-closed.ts');
  const gateway=source('src/server/checkout-gateway.ts');
  const panel=source('src/features/storefront/components/CheckoutPanel.tsx');
  check(/POST\s*:\s*async\s*\(\s*\{\s*request\s*\}\s*\)\s*=>\s*rejectPilotCheckout\s*\(\s*request\s*\)/s.test(route),'FOOD_ROUTE_CALLS_CLOSED_HANDLER');
  check(!/handlePrivateCheckout|createClient|service_role|SUPABASE_SERVICE_ROLE_KEY|\.rpc\s*\(/.test(route),'FOOD_ROUTE_HAS_NO_PRIVILEGED_FALLBACK');
  check(/enabled\s*:\s*false\b/.test(closed)&&/handleCheckoutRequest\s*\(/.test(closed),'FOOD_CLOSED_ADAPTER_DISABLED');
  check(/if\s*\(\s*!dependencies\.enabled\s*\)\s*return\s+result\s*\(\s*503\b/.test(gateway),'FOOD_GATEWAY_503_BEFORE_SIDE_EFFECT');
  check(!/\.rpc\s*\(\s*['"\x60](?:create_public_order|append_public_order_items_with_payment|get_public_order_status)['"\x60]/.test(panel),'FOOD_BROWSER_NO_LEGACY_RPC');
  check(/fetch\s*\(\s*['"]\/api\/checkout['"]/.test(panel),'FOOD_PANEL_USES_SERVER_ENDPOINT');
},'FOOD_SOURCE_READABLE');

if(mode==='master')safe(()=>{
  const manifest=json('audits/02a5/hosted-release/MANIFEST.json');
  const preflight=json('tools/hosted-admission/preflight-policy.json');
  check(manifest.execution_authorized===false&&manifest.approval===null&&/CLOSED/.test(manifest.status||''),'MASTER_HOSTED_RELEASE_CLOSED');
  check(typeof manifest.target_project==='string'&&manifest.target_project===preflight.project,'MASTER_PROJECT_CONSISTENT');
  check(typeof preflight.state==='string'&&preflight.state.startsWith('CLOSED'),'MASTER_PREFLIGHT_CLOSED');
  check(['host','role','caSha256','ref','founderLogin'].every(k=>preflight[k]===null)&&['publicKeyPem','keySha256','maxValidityMs'].every(k=>preflight.authority?.[k]===null),'MASTER_PREFLIGHT_TRUST_UNSET');
  const units=manifest.units;
  check(Array.isArray(units)&&units.length===33,'MASTER_SQL_MANIFEST_33');
  if(!Array.isArray(units))return;
  check(units.every((x,i)=>x.order===i+1&&typeof x.path==='string'&&/^audits\/02a5\/hosted-release\/\d{2}-[^/]+\.sql$/.test(x.path)),'MASTER_SQL_SEQUENCE_01_TO_33');
  check(new Set(units.map(x=>x.path)).size===units.length,'MASTER_SQL_UNIQUE_PATHS');
  for(const u of units){
    safe(()=>{
      const expected=String(u.sha256||'');
      const full=resolve(root,u.path);
      const acceptable=full.startsWith(root+'/')&&/^[0-9a-f]{64}$/.test(expected);
      check(acceptable,'MASTER_SQL_'+String(u.order).padStart(2,'0')+'_PATH_AND_HASH_FORMAT');
      if(acceptable&&existsSync(full)){
        check(sha256(readFileSync(full))===expected,'MASTER_SQL_'+String(u.order).padStart(2,'0')+'_SHA256');
      }else check(false,'MASTER_SQL_'+String(u.order).padStart(2,'0')+'_SHA256','missing or unsafe file');
    },'MASTER_SQL_'+u.order+'_READ');
  }
},'MASTER_SOURCE_READABLE');

if(mode==='institutional')safe(()=>{
  const files=readdirSync(join(root,'src/routes'));
  const old=files.filter(f=>/^master(?:[.\-$]|$)/i.test(f));
  check(old.length===0,'HUB_MASTER_ROUTES_ABSENT',old.join(', '));
  check(existsSync(join(root,'src/routes/index.tsx')),'HUB_HOME_PRESENT');
  check(/createFileRoute\s*\(\s*['"]\/['"]\s*\)/.test(source('src/routes/index.tsx')),'HUB_HOME_AT_ROOT');
},'HUB_SOURCE_READABLE');

const status=findings.length?'FAIL':'PASS';
process.stdout.write('INTEGRATION_STATIC_GATE='+status+' APP='+mode+' CHECKS='+checked+' FAILURES='+findings.length+'\n');
process.exit(findings.length?1:0);
