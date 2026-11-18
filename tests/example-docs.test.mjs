// The sample fills of the docs panel (issue 100). Each sample of examples/docs.json is a valid fill for the
// browser validator, and the type text of the panel comes from the contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATALOG } from '../src/render/catalog.js';
import { fillErrors } from '../src/render/validate.js';

const DOCS = JSON.parse(readFileSync(new URL('../examples/docs.json', import.meta.url), 'utf8'));

test('each sample of the docs panel is a valid fill of its contract', () => {
  for (const [name, docs] of Object.entries(DOCS.components)) {
    assert.equal(docs.sample.component, name);
    assert.deepEqual(fillErrors(docs.sample, CATALOG), [], name);
  }
});

test('a sample with an undeclared key is refused', () => {
  const sample = structuredClone(DOCS.components.card.sample);
  sample.data.html = '<b>x</b>';
  assert.deepEqual(fillErrors(sample, CATALOG), ['data.html: the contract does not declare this field']);
});
