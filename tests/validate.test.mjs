// The browser validator gives the same errors as tools/catalog.py for each shared case.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { actorErrors, authorErrors, fillErrors, schemaErrors } from '../src/render/validate.js';

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
    const contract = { format: 2, name: 'note', version: '0.1.0', kind: 'primitive', description: 'A note.', ai_content: true,
      data: { text: { type: 'text', label: 'Text', required: true, max_length: 10 } }, states: ['default'], tokens: [],
      accessibility: { role: 'none', keyboard: [], forced_colors: true, reduced_motion: true } };
    const fill = (text) => ({ component: 'note', version: '0.1.0', data: { text } });
    console.log(JSON.stringify([fillErrors(fill('\\u{1F600}'.repeat(5000000)), { note: contract }),
      fillErrors(fill('\\u{1F600}'.repeat(10)), { note: contract })]));`;
  const run = spawnSync(process.execPath, ['--max-old-space-size=64', '--input-type=module', '-e', code], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr.slice(0, 400));
  assert.deepEqual(JSON.parse(run.stdout), [['data.text: more than 10 characters'], []]);
});

// Format 2 has no actions list. A fill with 1,000,000 actions gets one error, and no error for each item.
test('a very long list of actions gets one error and no error for each item', () => {
  const code = `
    const { fillErrors } = await import(${JSON.stringify(new URL('../src/render/validate.js', import.meta.url).href)});
    const contract = { format: 2, name: 'note', version: '0.1.0', kind: 'primitive', description: 'A note.', ai_content: true,
      data: { text: { type: 'text', label: 'Text', required: true, max_length: 10 } }, states: ['default'], tokens: [],
      accessibility: { role: 'none', keyboard: [], forced_colors: true, reduced_motion: true } };
    const fill = { component: 'note', version: '0.1.0', data: { text: 'A' }, actions: new Array(1000000).fill(null) };
    console.log(JSON.stringify(fillErrors(fill, { note: contract })));`;
  const run = spawnSync(process.execPath, ['--max-old-space-size=64', '--input-type=module', '-e', code], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr.slice(0, 400));
  assert.deepEqual(JSON.parse(run.stdout), ['actions: unknown key']);
});

// An error for each of 500,000 unknown keys needs more than the heap limit of 64 MB.
// Each object gets its own process, because two such objects do not fit in the heap.
for (const [where, expected] of [['a fill', '(fill): more than 10 unknown keys']]) {
  test(`${where} with very many unknown keys gets one error and no error for each key`, () => {
    const code = `
      const { fillErrors } = await import(${JSON.stringify(new URL('../src/render/validate.js', import.meta.url).href)});
      const contract = { format: 2, name: 'note', version: '0.1.0', kind: 'primitive', description: 'A note.', ai_content: true,
        data: { text: { type: 'text', label: 'Text', required: true, max_length: 10 } }, states: ['default'], tokens: [],
        accessibility: { role: 'none', keyboard: [], forced_colors: true, reduced_motion: true } };
      const fill = { component: 'note', version: '0.1.0', data: { text: 'A' } };
      for (let index = 0; index < 500000; index += 1) fill['key_' + index] = 1;
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
});

// The author in a fill must be the actor that the application or the thread gives.
test('the author of a fill must be the bound actor', () => {
  const agent = { type: 'agent', id: 'agent-check' };
  const fill = { component: 'card', version: '0.1.0', data: {}, slots: { authorship: agent } };
  assert.deepEqual(authorErrors(fill, agent), []);
  assert.deepEqual(authorErrors({ ...fill, slots: {} }, null), []);
  assert.deepEqual(authorErrors(fill, null), ['slots.authorship: no actor is bound, so the author cannot be checked']);
  assert.deepEqual(authorErrors(fill, { type: 'human', id: 'agent-check' }), ['slots.authorship: the author is not the bound actor']);
  assert.deepEqual(authorErrors(fill, { type: 'agent', id: 'agent-other' }), ['slots.authorship: the author is not the bound actor']);
  assert.deepEqual(actorErrors(null), []);
  assert.deepEqual(actorErrors(agent), []);
  assert.deepEqual(actorErrors({ type: 'person', id: 'x' }), ['type: must be human, agent or system']);
  assert.deepEqual(actorErrors({ type: 'agent', id: '' }), ['id: must be a string of 1 to 128 characters']);
  assert.deepEqual(actorErrors('agent'), ['must be an object or null']);
});
