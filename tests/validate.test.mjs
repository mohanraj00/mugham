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
