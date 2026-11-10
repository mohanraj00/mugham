// The browser validator gives the same errors as tools/catalog.py for each shared case.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fillErrors, schemaErrors } from '../src/render/validate.js';

const vectors = JSON.parse(readFileSync(new URL('./vectors/fills.json', import.meta.url), 'utf8'));

for (const item of vectors.cases) {
  test(item.name, () => {
    const before = JSON.stringify(item.fill);
    assert.deepEqual(fillErrors(item.fill, vectors.catalog), item.errors);
    assert.equal(JSON.stringify(item.fill), before, 'the validator must not change the fill');
  });
}

test('an unknown schema keyword is refused', () => {
  assert.throws(() => schemaErrors({}, { type: 'object', format: 'email' }));
});

test('a catalog key from the object prototype is not a contract', () => {
  const fill = { component: 'constructor', version: '0.1.0', data: {} };
  assert.deepEqual(fillErrors(fill, vectors.catalog), ['component: no contract has the name constructor']);
});
