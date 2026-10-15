import assert from 'node:assert/strict';
import { test } from 'node:test';
import { orderAmendmentEnabled } from '../src/server/order-amendment-backend.ts';
const env={NEROXA_PRIVATE_TRACKING_ENABLED:'true',NEROXA_BACKEND_MODE:'homologation',NEROXA_TEST_PROJECT_REF:'local-disposable',NEROXA_TRACKING_PROXY_CONTRACT:'direct-canonical-host-v1',SUPABASE_URL:'http://127.0.0.1:54321',NEROXA_DELIVERY_BACKEND_URL:'http://127.0.0.1:54321',NEROXA_TRACKING_CANONICAL_DOMAINS:'a.synthetic.invalid',NEROXA_TRACKING_QUOTA_SECRET:'t'.repeat(32),NEROXA_CHECKOUT_RATE_LIMIT_SECRET:'a'.repeat(32),NEROXA_CHECKOUT_GATEWAY_ENABLED:'true',NEROXA_CHECKOUT_AMENDMENTS_ENABLED:'true'};
test('amendments require the explicit local disposable contract and both flags',()=>{
 assert.equal(orderAmendmentEnabled(env),true);
 for(const change of [{NEROXA_BACKEND_MODE:'production'},{SUPABASE_URL:'https://hosted.synthetic.invalid'},{NEROXA_CHECKOUT_GATEWAY_ENABLED:'false'},{NEROXA_CHECKOUT_AMENDMENTS_ENABLED:'false'},{NEROXA_CHECKOUT_RATE_LIMIT_SECRET:'short'},{NEROXA_TRACKING_CANONICAL_DOMAINS:'food.synthetic.example'}])assert.equal(orderAmendmentEnabled({...env,...change}),false);
});
