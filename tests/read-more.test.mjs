// Expected limits come from catalog/text.json, catalog/excerpt.json and catalog/rich-text.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../src/render/catalog.js';
import { contractErrors, fillErrors } from '../src/render/validate.js';

const author = { type: 'agent', id: 'agent-notes' };
const data = { text: { text: 'A short note.' }, excerpt: { passage: 'A short note.', span_start: 0, span_end: 1 },
  'rich-text': { blocks: [] } };
const fill = (name, values) => ({ component: name, version: '0.1.0', data: values,
  ...(name === 'text' ? {} : { slots: { authorship: author, ...(name === 'excerpt'
    ? { citation: { source: 'Synthetic notes', locator: 'https://example.org/notes' } } : {}) } }) });

for (const name of Object.keys(data)) {
  test(`${name}: clamp is optional and accepts 1 through 20`, () => {
    assert.deepEqual(contractErrors(CATALOG[name], CATALOG), []);
    assert.deepEqual(fillErrors(fill(name, data[name]), CATALOG), []);
    for (const clamp of [1, 3, 20]) assert.deepEqual(fillErrors(fill(name, { ...data[name], clamp }), CATALOG), []);
  });
  test(`${name}: clamp refuses zero, negative, large and noninteger values`, () => {
    for (const [clamp, reason] of [[0, 'less than the minimum 1'], [-1, 'less than the minimum 1'],
      [21, 'more than the maximum 20'], [1.5, 'must be an integer'], ['3', 'must be an integer'],
      [null, 'must be an integer'], [true, 'must be an integer']]) {
      assert.deepEqual(fillErrors(fill(name, { ...data[name], clamp }), CATALOG), [`data.clamp: ${reason}`]);
    }
    assert.ok(fillErrors(fill(name, { ...data[name], read_more_label: 'Other' }), CATALOG).length);
  });
}
