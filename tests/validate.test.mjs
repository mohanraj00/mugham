// The browser validator gives the same errors as tools/catalog.py for each shared case.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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

// A copy of the text as an array of code points needs about 140 MB here. The heap limit is 64 MB.
test('a very long text gets its error with no copy of the text', () => {
  const code = `
    const { fillErrors } = await import(${JSON.stringify(new URL('../src/render/validate.js', import.meta.url).href)});
    const contract = { format: 1, name: 'note', version: '0.1.0', kind: 'primitive', description: 'A note.', ai_content: true,
      data: { text: { type: 'text', label: 'Text', required: true, max_length: 10 } }, states: ['default'], tokens: [],
      accessibility: { role: 'none', keyboard: [], forced_colors: true, reduced_motion: true } };
    const fill = (text) => ({ component: 'note', version: '0.1.0', data: { text } });
    console.log(JSON.stringify([fillErrors(fill('\\u{1F600}'.repeat(5000000)), { note: contract }),
      fillErrors(fill('\\u{1F600}'.repeat(10)), { note: contract })]));`;
  const run = spawnSync(process.execPath, ['--max-old-space-size=64', '--input-type=module', '-e', code], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr.slice(0, 400));
  assert.deepEqual(JSON.parse(run.stdout), [['data.text: more than 10 characters'], []]);
});

// An error for each item of 1,000,000 actions needs more than the heap limit of 64 MB.
test('a very long list of actions gets one size error and no error for each item', () => {
  const code = `
    const { fillErrors } = await import(${JSON.stringify(new URL('../src/render/validate.js', import.meta.url).href)});
    const contract = { format: 1, name: 'note', version: '0.1.0', kind: 'primitive', description: 'A note.', ai_content: true,
      data: { text: { type: 'text', label: 'Text', required: true, max_length: 10 } }, states: ['default'], tokens: [],
      accessibility: { role: 'none', keyboard: [], forced_colors: true, reduced_motion: true } };
    const fill = { component: 'note', version: '0.1.0', data: { text: 'A' }, actions: new Array(1000000).fill(null) };
    console.log(JSON.stringify(fillErrors(fill, { note: contract })));`;
  const run = spawnSync(process.execPath, ['--max-old-space-size=64', '--input-type=module', '-e', code], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr.slice(0, 400));
  assert.deepEqual(JSON.parse(run.stdout), ['actions: more than 10 items']);
});

// An error for each of 500,000 unknown keys needs more than the heap limit of 64 MB.
// Each object gets its own process, because two such objects do not fit in the heap.
for (const [where, expected] of [['a fill', '(fill): more than 10 unknown keys'], ['an action', 'actions[0]: more than 10 unknown keys']]) {
  test(`${where} with very many unknown keys gets one error and no error for each key`, () => {
    const code = `
      const { fillErrors } = await import(${JSON.stringify(new URL('../src/render/validate.js', import.meta.url).href)});
      const contract = { format: 1, name: 'note', version: '0.1.0', kind: 'primitive', description: 'A note.', ai_content: true,
        data: { text: { type: 'text', label: 'Text', required: true, max_length: 10 } }, states: ['default'], tokens: [],
        accessibility: { role: 'none', keyboard: [], forced_colors: true, reduced_motion: true } };
      const fill = { component: 'note', version: '0.1.0', data: { text: 'A' } };
      if (${JSON.stringify(where)} === 'an action') fill.actions = [{ action: 'save', arguments: {} }];
      const target = fill.actions ? fill.actions[0] : fill;
      for (let index = 0; index < 500000; index += 1) target['key_' + index] = 1;
      console.log(JSON.stringify(fillErrors(fill, { note: contract })));`;
    const run = spawnSync(process.execPath, ['--max-old-space-size=64', '--input-type=module', '-e', code], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr.slice(0, 400));
    assert.deepEqual(JSON.parse(run.stdout), [expected]);
  });
}

// A key of 5,000,000 characters must not go into the error text. The error shows only its first 40 characters.
test('a very long key name gets a short error', () => {
  const contract = vectors.catalog['loan-card'];
  const name = 'q'.repeat(5000000);
  const fill = { component: 'loan-card', version: contract.version,
    data: { title: 'A', due: '2026-12-01', renewals: 1, facts: [], [name]: 1 }, [name]: 1 };
  const errors = fillErrors(fill, vectors.catalog);
  assert.deepEqual(errors, [`${'q'.repeat(40)}...: unknown key`]);
  fill.actions = [{ action: 'renew', arguments: { loan_id: 'L-0001', [name]: 1 } }];
  delete fill[name];
  for (const error of fillErrors(fill, vectors.catalog)) assert.ok(error.length < 120, error.slice(0, 120));
});
