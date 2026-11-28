import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const guard=new URL('./guard-release.mjs',import.meta.url).pathname;
function write(root,path,content){
  const target=join(root,path);
  mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,content);
}
function run(mode,root){
  return spawnSync(process.execPath,[guard,mode,root],{encoding:'utf8'});
}
const sha256=s=>createHash('sha256').update(s).digest('hex');

test('Food: closed checkout accepted; privileged handler rejected',()=>{
  const root=mkdtempSync(join(tmpdir(),'neroxa-food-gate-'));
  try{
    write(root,'src/routes/api/checkout.ts','POST: async ({ request }) => rejectPilotCheckout(request)');
    write(root,'src/server/pilot-checkout-closed.ts','return handleCheckoutRequest(request, { enabled: false });');
    write(root,'src/server/checkout-gateway.ts','if (!dependencies.enabled) return result(503, "disabled");');
    write(root,'src/features/storefront/components/CheckoutPanel.tsx','await submitCommercialCheckout({});');
    write(root,'src/features/storefront/services/commercial-checkout-client.ts','fetch("/api/commercial/checkout", {});');
    write(root,'src/components/storefront/Storefront.tsx','const records = [];');
    write(root,'src/routes/api/order-track.ts','POST: async ({ request }) => handleClosedPrivateTracking(request)');
    write(root,'src/server/private-tracking-closed.ts','const deps = {enabled: false};');
    assert.equal(run('food',root).status,0);
    write(root,'src/components/storefront/Storefront.tsx','await supabase.rpc("get_public_order_status", {});');
    assert.equal(run('food',root).status,1);
    write(root,'src/components/storefront/Storefront.tsx','const records = [];');
    write(root,'src/server/private-tracking-closed.ts','const deps = {enabled: true};');
    assert.equal(run('food',root).status,1);
    write(root,'src/server/private-tracking-closed.ts','const deps = {enabled: false};');
    write(root,'src/routes/api/checkout.ts','POST: async ({ request }) => handlePrivateCheckout(request)');
    assert.equal(run('food',root).status,1);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('Master: 33 SQL hashes and closed admission required',()=>{
  const root=mkdtempSync(join(tmpdir(),'neroxa-master-gate-'));
  try{
    const units=[];
    for(let i=1;i<=33;i++){
      const n=String(i).padStart(2,'0');
      const path='audits/02a5/hosted-release/'+n+'-synthetic.candidate.sql';
      const sql='-- synthetic fixture '+n+'\nSELECT '+i+';\n';
      write(root,path,sql);
      units.push({order:i,path,sha256:sha256(sql)});
    }
    const manifest={status:'CANDIDATE; hosted execution CLOSED',target_project:'synthetic-only',execution_authorized:false,approval:null,units};
    write(root,'audits/02a5/hosted-release/MANIFEST.json',JSON.stringify(manifest));
    const policy={state:'CLOSED',project:'synthetic-only',host:null,role:null,caSha256:null,ref:null,founderLogin:null,authority:{publicKeyPem:null,keySha256:null,maxValidityMs:null}};
    write(root,'tools/hosted-admission/preflight-policy.json',JSON.stringify(policy));
    assert.equal(run('master',root).status,0);
    write(root,units[17].path,'-- altered SQL\n');
    assert.equal(run('master',root).status,1);
    write(root,units[17].path,'-- synthetic fixture 18\nSELECT 18;\n');
    manifest.execution_authorized=true;
    write(root,'audits/02a5/hosted-release/MANIFEST.json',JSON.stringify(manifest));
    assert.equal(run('master',root).status,1);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('Institutional: legacy Master route must remain absent',()=>{
  const root=mkdtempSync(join(tmpdir(),'neroxa-hub-gate-'));
  try{
    write(root,'src/routes/index.tsx','export const Route = createFileRoute("/")({});');
    assert.equal(run('institutional',root).status,0);
    write(root,'src/routes/master.tsx','export const Route = createFileRoute("/master")({});');
    assert.equal(run('institutional',root).status,1);
  }finally{rmSync(root,{recursive:true,force:true});}
});
