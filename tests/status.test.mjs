// The JavaScript validator accepts only the states and text of catalog/status.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../src/render/catalog.js';
import { fillErrors } from '../src/render/validate.js';

const fill = (state, text = 'Synthetic check A.') => ({
  component: 'status', version: '0.1.0', data: { state, text },
  slots: { authorship: { type: 'agent', id: 'agent-check' } },
});

test('status accepts each state and markup as text', () => {
  for (const state of ['pending', 'passed', 'failed', 'unknown']) {
    assert.deepEqual(fillErrors(fill(state), CATALOG), []);
    assert.deepEqual(fillErrors(fill(state, '<img src=x onerror=alert(1)>'), CATALOG), []);
  }
});

test('status refuses an undeclared state value', () => {
  for (const state of ['complete', 'Passed', '', '<b>passed</b>', null, 1, true, {}]) {
    assert.deepEqual(fillErrors(fill(state), CATALOG), ['data.state: must be one of pending, passed, failed, unknown']);
  }
});

test('status requires short text and counts code points', () => {
  assert.deepEqual(fillErrors(fill('pending', '𝔸'.repeat(200)), CATALOG), []);
  assert.deepEqual(fillErrors(fill('pending', ''), CATALOG), ['data.text: fewer than 1 characters']);
  assert.deepEqual(fillErrors(fill('pending', '𝔸'.repeat(201)), CATALOG), ['data.text: more than 200 characters']);
  const missing = fill('pending');
  delete missing.data.state;
  assert.deepEqual(fillErrors(missing, CATALOG), ['data.state: a required field is missing']);
});
