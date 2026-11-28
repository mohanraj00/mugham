// The kit passes the conformance set of conformance/v1/, as a consumer runs it against a pinned release.
// The expected results come from docs/decisions/0008-stable-contract.md, section 3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const run = (...args) => {
  const result = spawnSync(process.env.PYTHON || 'python3', ['-I', '-B', 'conformance/run.py', ...args],
    { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  return { code: result.status, report: JSON.parse(result.stdout) };
};
const KINDS = ['fill', 'contract', 'short', 'resolve', 'envelope', 'stream'];

for (const mode of [[], ['--full-text']]) {
  test(`the kit passes each case of the set ${mode.length ? 'with full error texts' : 'with error paths'}`, () => {
    const { code, report } = run('--kit', '.', ...mode);
    assert.deepEqual(report.failed, []);
    assert.equal(report.passed, true);
    assert.equal(code, 0);
    assert.deepEqual(Object.keys(report.cases), KINDS);
    for (const kind of KINDS) assert.ok(report.cases[kind] > 0, kind);
    assert.deepEqual(report.skipped, {});
  });
}

test('a kit folder with no kit stops the run', () => {
  const { code, report } = run('--kit', 'docs', '--kind', 'fill');
  assert.equal(code, 2);
  assert.equal(report.passed, false);
  assert.match(report.error, /the command stopped with the code 1/);
  const all = run('--kit', 'docs');
  assert.equal(all.code, 2);
  assert.match(all.report.error, /the kit has no catalog folder/);
});
