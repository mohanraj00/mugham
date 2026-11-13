// The contract validator of the browser gives the same errors as tools/catalog.py for each shared contract case.
// The registry of application contracts never changes the catalog. See catalog/README.md#application-contracts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contractErrors, fillErrors } from '../src/render/validate.js';
import { CATALOG } from '../src/render/catalog.js';
import { CONTRACTS, register } from '../src/render/registry.js';

const vectors = JSON.parse(readFileSync(new URL('./vectors/contracts.json', import.meta.url), 'utf8'));
// The valid contract of the vectors, with no component field. The kit catalog has no loan-card contract.
const VALID = structuredClone(vectors.cases[0].contract);
delete VALID.data.loan;

for (const item of vectors.cases) {
  test('contract: ' + item.name, () => {
    const before = JSON.stringify(item.contract);
    assert.deepEqual(contractErrors(item.contract, vectors.catalog), item.errors);
    assert.equal(JSON.stringify(item.contract), before, 'the validator must not change the contract');
  });
}

test('each catalog contract is valid for the browser validator', () => {
  for (const [name, contract] of Object.entries(CATALOG)) assert.deepEqual(contractErrors(contract, CATALOG), [], name);
});

test('the registry gives each catalog contract and no other', () => {
  assert.deepEqual(Object.keys(CONTRACTS).sort(), Object.keys(CATALOG).sort());
  for (const name of Object.keys(CATALOG)) assert.equal(CONTRACTS[name], CATALOG[name]);
  assert.equal(Object.hasOwn(CONTRACTS, 'constructor'), false);
  assert.equal(CONTRACTS.constructor, undefined);
});

test('a script cannot write the registry', () => {
  assert.throws(() => { CONTRACTS['seed-tray'] = VALID; }, TypeError);
  assert.throws(() => Object.defineProperty(CONTRACTS, 'seed-tray', { value: VALID }), TypeError);
  assert.throws(() => { delete CONTRACTS.card; }, TypeError);
  assert.equal(CONTRACTS['seed-tray'], undefined);
  assert.equal(CONTRACTS.card, CATALOG.card);
});

test('an undeclared component is refused through the registry', () => {
  const fill = { component: 'banner', version: '0.1.0', data: {} };
  assert.deepEqual(fillErrors(fill, CONTRACTS), ['component: no contract has the name banner']);
});

test('a registration with no contract fails with a clear error', () => {
  assert.throws(() => register(), { name: 'TypeError', message: 'register: a contract is necessary' });
  assert.throws(() => register(null, class {}), { name: 'TypeError', message: 'register: a contract is necessary' });
});

test('a registration of an invalid contract fails with the errors of the validator', () => {
  const contract = { ...VALID, states: ['empty'] };
  assert.throws(() => register(contract, class {}),
    { name: 'TypeError', message: 'register: the contract seed-tray is not valid: states: must include default' });
  assert.equal(CONTRACTS['seed-tray'], undefined);
});

test('a contract that is not JSON data is refused', () => {
  assert.throws(() => register({ ...VALID, script: () => 1 }, class {}),
    { name: 'TypeError', message: 'register: the contract must be JSON data' });
});

test('a registered contract cannot replace a catalog contract', () => {
  assert.throws(() => register({ ...structuredClone(CATALOG.card) }, class {}),
    { name: 'TypeError', message: 'register: card is the name of a catalog contract' });
  assert.equal(CONTRACTS.card, CATALOG.card);
});

test('an element that is not a mugham element is refused', () => {
  assert.throws(() => register(VALID, class {}),
    { name: 'TypeError', message: 'register: the element of seed-tray must be a class that extends MuElement' });
  assert.equal(CONTRACTS['seed-tray'], undefined);
});
