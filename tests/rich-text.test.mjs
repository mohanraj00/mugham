// The JavaScript validator gives the same result as tools/catalog.py for the rich text contracts.
// tests/test_rich_text.py has the same cases. The element rules are in tests/browser/rich-text.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../src/render/catalog.js';
import { contractErrors, fillErrors } from '../src/render/validate.js';

const BLOCKS = ['rich-paragraph', 'rich-heading', 'rich-list', 'rich-code', 'rich-quote'];
const node = (component, data) => ({ component, version: '0.1.0', data });
const SPAN = node('rich-span', { text: 'Keep the tray dry.' });
const LINK = node('rich-link', { text: 'Synthetic rules', url: 'https://example.org/rules' });
const PARAGRAPH = node('rich-paragraph', { content: [SPAN, LINK] });
const errors = (blocks) => fillErrors({ component: 'rich-text', version: '0.1.0', data: { blocks },
  slots: { authorship: { type: 'agent', id: 'agent-check' } } }, CATALOG);

test('each rich text contract is valid', () => {
  for (const name of ['rich-text', ...BLOCKS, 'rich-span', 'rich-link']) assert.deepEqual(contractErrors(CATALOG[name], CATALOG), [], name);
});

test('a tree with each node type is valid', () => {
  assert.deepEqual(errors([
    node('rich-heading', { level: 1, content: [SPAN] }), PARAGRAPH,
    node('rich-list', { ordered: true, items: [PARAGRAPH] }), node('rich-code', { text: 'make check' }),
    node('rich-quote', { paragraphs: [PARAGRAPH] }),
    node('rich-paragraph', { content: ['emphasis', 'strong', 'code'].map((mark) => node('rich-span', { text: 'x', mark })) }),
  ]), []);
  assert.deepEqual(errors([]), []);
});

test('an unknown node type is refused', () => {
  const blocks = 'data.blocks[0].component: must be ' + BLOCKS.join(' or ');
  assert.deepEqual(errors([node('rich-table', { rows: [] })]), [blocks]);
  assert.deepEqual(errors([SPAN]), [blocks]);
  assert.deepEqual(errors([node('rich-paragraph', { content: [PARAGRAPH] })]),
    ['data.blocks[0].data.content[0].component: must be rich-span or rich-link']);
  assert.deepEqual(errors([node('rich-list', { items: [SPAN] })]), ['data.blocks[0].data.items[0].component: must be rich-paragraph']);
});

test('no node can set a style, a class, a handler or an undeclared attribute', () => {
  for (const key of ['style', 'class', 'onclick', 'href', 'id', 'html', 'target']) {
    assert.deepEqual(errors([node('rich-paragraph', { content: [SPAN], [key]: 'x' })]),
      [`data.blocks[0].data.${key}: the contract does not declare this field`]);
    for (const inline of [SPAN, LINK]) {
      assert.deepEqual(errors([node('rich-paragraph', { content: [node(inline.component, { ...inline.data, [key]: 'x' })] })]),
        [`data.blocks[0].data.content[0].data.${key}: the contract does not declare this field`]);
    }
  }
});

test('markup is text for the validator, and the limits come from the contracts', () => {
  const markup = '<img src=x onerror=alert(1)><script>alert(1)</script>';
  assert.deepEqual(errors([node('rich-paragraph', { content: [node('rich-span', { text: markup })] }), node('rich-code', { text: markup })]), []);
  assert.deepEqual(errors(Array(101).fill(PARAGRAPH)), ['data.blocks: more than 100 items']);
  assert.deepEqual(errors([node('rich-paragraph', { content: Array(51).fill(SPAN) })]), ['data.blocks[0].data.content: more than 50 items']);
  assert.deepEqual(errors([node('rich-heading', { level: 4, content: [SPAN] })]), ['data.blocks[0].data.level: more than the maximum 3']);
  assert.deepEqual(errors([node('rich-paragraph', { content: [node('rich-span', { text: 'x', mark: 'underline' })] })]),
    ['data.blocks[0].data.content[0].data.mark: must be one of emphasis, strong, code']);
  assert.deepEqual(errors([{ ...PARAGRAPH, slots: { authorship: { type: 'human', id: 'person-1' } } }]),
    ['data.blocks[0].slots: a nested fill takes the slots of its outer fill']);
});
