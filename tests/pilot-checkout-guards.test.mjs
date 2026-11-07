import test from 'node:test';
import assert from 'node:assert/strict';
import {sameDeliveryBackend} from '../src/core/delivery/backend-binding.ts';
import {groupedContract, GroupContractError} from '../src/server/group-contract.ts';

test('backend binding accepts only matching HTTPS origins and loopback HTTP', () => {
  assert.equal(sameDeliveryBackend('https://example.invalid', 'https://example.invalid/'), true);
  assert.equal(sameDeliveryBackend('http://127.0.0.1:54321/', 'http://127.0.0.1:54321'), true);
  assert.equal(sameDeliveryBackend('http://localhost:54321', 'http://localhost:54321'), true);
  assert.equal(sameDeliveryBackend('https://example.invalid', 'https://other.invalid'), false);
  assert.equal(sameDeliveryBackend('http://example.invalid', 'http://example.invalid'), false);
  assert.equal(sameDeliveryBackend('http://localhost:54321', 'http://localhost:54322'), false);
});

test('backend binding rejects injected URL components and invalid values', () => {
  for (const bad of [
    'https://user:pass@example.invalid', 'https://example.invalid/other',
    'https://example.invalid/?token=abc', 'https://example.invalid/#hash',
    'not-an-origin', '', null, undefined, 42,
  ]) assert.equal(sameDeliveryBackend(bad, 'https://example.invalid'), false);
  assert.equal(sameDeliveryBackend('https://example.invalid', 'https://example.invalid:444'), false);
});

test('grouped contract rejects empty or nonarray input', () => {
  for (const input of [null, undefined, [], {}, 'items']) {
    assert.throws(() => groupedContract(input, false), GroupContractError);
  }
});

test('grouped contract permits legacy only when private group flag is disabled', () => {
  assert.equal(groupedContract([{product_id: 'a'}], false), false);
  assert.throws(() => groupedContract([{product_id: 'a'}], true), GroupContractError);
});

test('grouped contract requires all items to advertise version when privately enabled', () => {
  assert.equal(groupedContract([{selection_contract:'GROUP_ADDONS_V1'}], true), true);
  assert.throws(() => groupedContract([{selection_contract:'GROUP_ADDONS_V1'}], false), GroupContractError);
  assert.throws(() => groupedContract([{selection_contract:'GROUP_ADDONS_V1'}, {product_id:'b'}], true), GroupContractError);
  assert.throws(() => groupedContract([{product_id:'a'}, {selection_contract:'GROUP_ADDONS_V1'}], false), GroupContractError);
});
