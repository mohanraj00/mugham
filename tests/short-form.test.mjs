// The short form of a contract (format 3). The expected results come from catalog/schema/README.md.
// tests/vectors/short.json holds the cases that this resolver and tools/catalog.py share.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATALOG } from '../src/render/catalog.js';
import { BRAND, CONTRACTS, register } from '../src/render/registry.js';
import { labelOf, resolveContract } from '../src/render/resolve.js';
import { contractErrors, fillErrors } from '../src/render/validate.js';

const vectors = (name) => JSON.parse(readFileSync(new URL(`./vectors/${name}`, import.meta.url), 'utf8'));
const SHORT = vectors('short.json');
const RESOLVED = vectors('resolved.json');
// Two values with the same JSON text have the same keys in the same order.
const ordered = (value) => JSON.stringify(value);
// Node has no DOM, so the tests of register use a stand-in for the base class of the kit elements.
class MuElement {
  static [BRAND] = true;
  get fill() { return undefined; }
  set fill(value) {}
  get actor() { return undefined; }
  set actor(value) {}
}

test('each shared case gives the result and the errors of tools/catalog.py', () => {
  for (const item of SHORT.cases) {
    const before = ordered(item.contract);
    const { contract, errors } = resolveContract(item.contract);
    let found = errors;
    if (!errors.length) {
      // A case with no resolved key has a short form with no error and a full form with errors.
      if ('resolved' in item) assert.equal(ordered(contract), ordered(item.resolved), item.name);
      found = contractErrors(contract, SHORT.catalog);
    }
    assert.deepEqual(found, item.errors, item.name);
    assert.equal(ordered(item.contract), before, item.name);
  }
});

test('the catalog of the kit is equal to the recorded full form, key for key', () => {
  assert.deepEqual(Object.keys(CATALOG).sort(), Object.keys(RESOLVED).sort());
  for (const [name, full] of Object.entries(RESOLVED)) assert.equal(ordered(CATALOG[name]), ordered(full), name);
});

test('a label comes from the key', () => {
  assert.equal(labelOf('date_label'), 'Date label');
  assert.equal(labelOf('title'), 'Title');
});

test('a change to a result does not change the defaults', () => {
  const minimum = { name: 'seed-tray', description: 'A tray of seedlings.', data: {} };
  const first = resolveContract(minimum).contract;
  first.slots.authorship.required = false;
  first.accessibility.keyboard.push('Tab');
  first.tokens.push('space.1');
  assert.equal(ordered(resolveContract(minimum).contract), ordered(SHORT.cases[0].resolved));
});

test('register accepts a contract in the short form and keeps its full form', () => {
  class Tray extends MuElement {
    static component = 'short-tray';
  }
  const elements = { get: () => undefined, define: () => {} };
  const contract = { name: 'short-tray', description: 'A tray of seedlings.',
    data: { label: { type: 'text', required: true, size: 'line' } } };
  assert.equal(register(contract, Tray, elements), 'mu-app-short-tray');
  assert.equal(CONTRACTS['short-tray'].format, 2);
  assert.deepEqual(CONTRACTS['short-tray'].data.label, { type: 'text', label: 'Label', required: true, max_length: 80 });
  const fill = { component: 'short-tray', version: '0.1.0', data: { label: 'Tray A' },
    slots: { authorship: { type: 'agent', id: 'check' } } };
  assert.deepEqual(fillErrors(fill, CONTRACTS), []);
  assert.deepEqual(fillErrors({ ...fill, slots: undefined }, CONTRACTS).length > 0, true);
});

test('register refuses a short contract with an unknown size name', () => {
  class Tray extends MuElement {
    static component = 'wide-tray';
  }
  const contract = { name: 'wide-tray', description: 'A tray.', data: { label: { type: 'text', size: 'huge' } } };
  assert.throws(() => register(contract, Tray, { get: () => undefined, define: () => {} }),
    { name: 'TypeError', message: 'register: the contract wide-tray is not valid: data.label.size: no size has the name huge' });
  assert.equal('wide-tray' in CONTRACTS, false);
});
