// The JavaScript validator gives the same result as tools/catalog.py for the upload contract.
// tests/test_upload.py has the same cases. The element rules are in tests/browser/upload.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../src/render/catalog.js';
import { contractErrors, fillErrors } from '../src/render/validate.js';

const DATA = { label: 'Attach receipts', help: 'Add the receipts of the ticket.', accept: ['application/pdf', '.pdf'], max_size: 2000000, max_files: 3 };
const errors = (change = {}, slots = { authorship: { type: 'agent', id: 'agent-check' } }) => fillErrors(
  { component: 'upload', version: '0.1.0', data: { ...DATA, ...change }, ...(slots ? { slots } : {}) }, CATALOG);

test('the upload contract is valid and declares the label, the limits and the states', () => {
  assert.deepEqual(contractErrors(CATALOG.upload, CATALOG), []);
  assert.deepEqual(Object.keys(CATALOG.upload.data), ['label', 'help', 'accept', 'max_size', 'max_files']);
  assert.deepEqual(CATALOG.upload.states, ['default', 'disabled', 'pending', 'done', 'error', 'refused']);
  assert.equal(CATALOG.upload.ai_content, true);
});

test('a fill gives the label and the help text, and it needs a named author', () => {
  assert.deepEqual(errors(), []);
  assert.deepEqual(fillErrors({ component: 'upload', version: '0.1.0', data: { label: 'Attach receipts' },
    slots: { authorship: { type: 'agent', id: 'agent-check' } } }, CATALOG), []);
  assert.deepEqual(errors({}, null), ['slots.authorship: a required slot is missing']);
});

test('a fill cannot set a target', () => {
  for (const key of ['target', 'tool', 'url', 'arguments', 'action', 'files', 'preview']) {
    assert.deepEqual(errors({ [key]: 'ticket.attach' }), [`data.${key}: the contract does not declare this field`]);
  }
});

test('the limits of a fill have the type and the range of the contract', () => {
  for (const [change, error] of [
    [{ label: '' }, 'data.label: fewer than 1 characters'],
    [{ label: 'x'.repeat(81) }, 'data.label: more than 80 characters'],
    [{ help: 'x'.repeat(201) }, 'data.help: more than 200 characters'],
    [{ accept: 'application/pdf' }, 'data.accept: must be a list'],
    [{ accept: Array(21).fill('application/pdf') }, 'data.accept: more than 20 items'],
    [{ accept: ['x'] }, 'data.accept[0]: fewer than 2 characters'],
    [{ max_size: 0 }, 'data.max_size: less than the minimum 1'],
    [{ max_size: 1000000001 }, 'data.max_size: more than the maximum 1000000000'],
    [{ max_size: '2000000' }, 'data.max_size: must be an integer'],
    [{ max_files: 0 }, 'data.max_files: less than the minimum 1'],
    [{ max_files: 21 }, 'data.max_files: more than the maximum 20'],
    [{ max_files: 1.5 }, 'data.max_files: must be an integer'],
  ]) assert.deepEqual(errors(change), [error]);
});
