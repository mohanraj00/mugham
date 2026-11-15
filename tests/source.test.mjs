// Tests of the offline data source interface. Each expected result comes from docs/contracts/data-source.md:
// a failed source shows an error and never old data as new data. The records are synthetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterErrors, read, statusFill } from '../src/offline/source.js';

const NOW = Date.parse('2026-11-15T10:00:00.000Z');
const CHECKED = '2026-11-15T09:30:00.000Z';
const LADDER = { key: 'T-01', name: 'Ladder', shelf: 'A', loans: 3, ready: true };
const DRILL = { key: 'T-02', name: 'Drill', shelf: 'B', loans: 0, ready: false };
const options = { now: () => NOW };

// A source that gives one fixed result for each call.
const fixed = (result) => ({ get: async () => result, list: async () => result });

test('a ready list shows frozen copies of the records', async () => {
  const records = [{ ...LADDER }, { ...DRILL }];
  const result = await read(fixed({ state: 'ready', records, checked: CHECKED }), { list: {} }, options);
  assert.deepEqual(result, { state: 'ready', records: [LADDER, DRILL], checked: CHECKED, reason: null });
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.records) && Object.isFrozen(result.records[0]));
  records[0].name = 'Changed';
  assert.equal(result.records[0].name, 'Ladder');
});

test('a get gives only the record with the requested key', async () => {
  const source = { get: async (key) => ({ state: 'ready', records: [LADDER].filter((item) => item.key === key), checked: CHECKED }) };
  assert.deepEqual((await read(source, { get: 'T-01' }, options)).records, [LADDER]);
  const wrong = await read(fixed({ state: 'ready', records: [DRILL], checked: CHECKED }), { get: 'T-01' }, options);
  assert.equal(wrong.state, 'error');
  assert.deepEqual(wrong.records, []);
  assert.deepEqual(wrong.errors, ['records[0].key: not the requested key']);
});

test('a list gives only records that agree with the filter and the limit', async () => {
  const both = fixed({ state: 'ready', records: [LADDER, DRILL], checked: CHECKED });
  const filtered = await read(both, { list: { where: { shelf: 'A' } } }, options);
  assert.equal(filtered.state, 'error');
  assert.deepEqual(filtered.errors, ['records[1]: does not agree with the filter']);
  const limited = await read(both, { list: { limit: 1 } }, options);
  assert.deepEqual(limited.errors, ['records: more than the limit 1']);
});

test('a source that fails shows an error and no records of an earlier read', async () => {
  let fail = false;
  const source = { list: async () => { if (fail) throw new Error('disk'); return { state: 'ready', records: [LADDER], checked: CHECKED }; } };
  assert.equal((await read(source, { list: {} }, options)).state, 'ready');
  fail = true;
  assert.deepEqual(await read(source, { list: {} }, options), { state: 'error', records: [], checked: null, reason: 'The source failed.' });
  const thrown = { list: () => { throw new Error('sync'); } };
  assert.equal((await read(thrown, { list: {} }, options)).reason, 'The source failed.');
});

test('an error result never has records', async () => {
  const result = await read(fixed({ state: 'error', records: [LADDER], checked: CHECKED, reason: 'The bundle is damaged.' }), { list: {} }, options);
  assert.deepEqual(result, { state: 'error', records: [], checked: CHECKED, reason: 'The bundle is damaged.' });
});

test('a source that does not answer shows an error', async () => {
  const silent = { list: () => new Promise(() => {}) };
  const result = await read(silent, { list: {} }, { ...options, timeout: 20 });
  assert.deepEqual(result, { state: 'error', records: [], checked: null, reason: 'The source did not answer.' });
});

test('the time of the read is the time of the answer', async () => {
  let clock = NOW;
  const source = { list: async () => { clock += 1000; return { state: 'ready', records: [LADDER], checked: new Date(clock).toISOString() }; } };
  assert.equal((await read(source, { list: {} }, { now: () => clock })).state, 'ready');
});

test('a ready result older than maxAge shows as stale', async () => {
  const old = fixed({ state: 'ready', records: [LADDER], checked: CHECKED });
  const result = await read(old, { list: {} }, { ...options, maxAge: 10 * 60 * 1000 });
  assert.deepEqual(result, { state: 'stale', records: [LADDER], checked: CHECKED, reason: 'The data is older than the limit.' });
  assert.equal((await read(old, { list: {} }, { ...options, maxAge: 60 * 60 * 1000 })).state, 'ready');
});

test('a stale result keeps its records, its time and its reason', async () => {
  const result = await read(fixed({ state: 'stale', records: [LADDER], checked: CHECKED, reason: 'The device is offline.' }), { list: {} }, options);
  assert.deepEqual(result, { state: 'stale', records: [LADDER], checked: CHECKED, reason: 'The device is offline.' });
});

test('a result that is not valid shows an error with each problem', async () => {
  const cases = [
    [null, 'the result must be an object'],
    [{ state: 'fresh', records: [] }, 'state: must be ready, stale, empty or error'],
    [{ state: 'ready', records: [], checked: CHECKED }, 'records: a ready or stale result needs at least one record'],
    [{ state: 'stale', records: [LADDER] }, 'checked: must be an ISO 8601 time in UTC'],
    [{ state: 'empty', records: [LADDER] }, 'records: an empty result has no record'],
    [{ state: 'error', records: [] }, 'reason: an error result needs a reason'],
    [{ state: 'ready', records: [LADDER], checked: '2026-11-15T10:05:00.000Z' }, 'checked: after the time of the read'],
    [{ state: 'ready', records: [LADDER], checked: '2026-11-15 09:30' }, 'checked: must be an ISO 8601 time in UTC'],
    [{ state: 'ready', records: 'Ladder', checked: CHECKED }, 'records: must be a list'],
    [{ state: 'ready', records: [{ name: 'Ladder' }], checked: CHECKED }, 'records[0].key: must be a text of 1 to 128 characters'],
    [{ state: 'ready', records: [{ ...LADDER, parts: ['rung'] }], checked: CHECKED }, 'records[0].parts: must be a text, a finite number, true or false'],
    [{ state: 'ready', records: [{ ...LADDER, loans: Infinity }], checked: CHECKED }, 'records[0].loans: must be a text, a finite number, true or false'],
    [{ state: 'ready', records: [{ ...LADDER, note: 'x'.repeat(2001) }], checked: CHECKED }, 'records[0].note: more than 2000 characters'],
    [{ state: 'stale', records: [LADDER], checked: CHECKED, reason: '' }, 'reason: must be a text of 1 to 200 characters'],
  ];
  for (const [given, error] of cases) {
    const result = await read(fixed(given), { list: {} }, options);
    assert.equal(result.state, 'error', JSON.stringify(given));
    assert.deepEqual(result.records, []);
    assert.equal(result.reason, 'The source gave a result that is not valid.');
    assert.deepEqual(result.errors, [error], JSON.stringify(given));
  }
});

test('the kit checks the request before it calls the source', async () => {
  let calls = 0;
  const counted = { get: async () => { calls += 1; }, list: async () => { calls += 1; } };
  assert.deepEqual(filterErrors({ where: { shelf: 'A' }, limit: 20 }), []);
  assert.deepEqual(filterErrors({ where: {} }), ['where: must have 1 to 10 keys']);
  assert.deepEqual(filterErrors({ limit: 501 }), ['limit: must be an integer from 1 to 500']);
  assert.deepEqual(filterErrors({ where: { shelf: { not: 'A' } } }), ['where.shelf: must be a text, a finite number, true or false']);
  assert.deepEqual(filterErrors({ sort: 'name' }), ['sort: not a key of the filter']);
  for (const request of [{ list: { limit: 0 } }, { get: '' }, { get: 'T-01', list: {} }, {}]) {
    const result = await read(counted, request, options);
    assert.equal(result.state, 'error', JSON.stringify(request));
    assert.equal(result.reason, 'The request is not valid.');
  }
  assert.equal((await read({}, { list: {} }, options)).reason, 'The request is not valid.');
  assert.equal(calls, 0);
});

test('the status fill gives the state, the time and the reason as data', () => {
  assert.deepEqual(statusFill('Tool library', { state: 'stale', records: [LADDER], checked: CHECKED, reason: 'The device is offline.' }),
    { component: 'source-status', version: '0.1.0', data: { label: 'Tool library', state: 'stale', checked: CHECKED, reason: 'The device is offline.' } });
  assert.deepEqual(statusFill('Tool library', { state: 'empty', records: [], checked: CHECKED, reason: null }),
    { component: 'source-status', version: '0.1.0', data: { label: 'Tool library', state: 'empty', checked: CHECKED } });
});
