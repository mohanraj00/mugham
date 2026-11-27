// The JavaScript validator gives the same result as tools/catalog.py for the rich text contracts.
// tests/test_rich_text.py has the same cases. The element rules are in tests/browser/rich-text.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolSchema } from '../src/kit.js';
import { CATALOG } from '../src/render/catalog.js';
import { parseLinkURL, RICH_TEXT_SCHEMES, richTextRules, richTextValueErrors } from '../src/render/rich-text-value.js';
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

test('a mail link has one mailbox and no query or fragment', () => {
  for (const address of ['reader@example.org', 'reader.one+notes@example.org', 'reader%40example.org']) {
    const target = 'mailto:' + address;
    assert.equal(parseLinkURL(target, RICH_TEXT_SCHEMES)?.href, target);
    assert.equal(parseLinkURL(target, ['https:']), null);
  }
  for (const address of ['', 'reader', '@example.org', 'reader@', 'reader@@example.org', 'reader@-example.org',
    'reader@exa mple.org', 'rea\tder@example.org', 'reader%20one@example.org', 'reader%00@example.org',
    'reader@example.org,other@example.org', 'reader@example.org;other@example.org',
    'reader%2Cone@example.org', 'reader%3Bone@example.org', 'reader%252Cone@example.org',
    'reader@example.org?subject=Note', 'reader@example.org#note', 'reader@example.org?', 'reader@example.org#',
    '//reader@example.org', 'reader%ZZ@example.org']) {
    assert.equal(parseLinkURL('mailto:' + address, RICH_TEXT_SCHEMES), null, address);
  }
});

test('the queue value check agrees with the nested catalog check and the shared rich text rules', () => {
  const value = (blocks, data = {}) => node('rich-text', { blocks, ...data });
  const paragraph = (content) => node('rich-paragraph', { content });
  const heading = (level) => node('rich-heading', { level, content: [SPAN] });
  const quote = (paragraphs) => node('rich-quote', { paragraphs });
  const maxParagraph = paragraph(Array(50).fill(SPAN));
  const maxInline = [quote(Array(20).fill(maxParagraph)), node('rich-list', { items: Array(20).fill(maxParagraph) })];
  const allNodes = [heading(1), heading(2), heading(3), heading(1), PARAGRAPH,
    node('rich-list', { ordered: true, items: [PARAGRAPH] }), node('rich-code', { text: 'make check' }),
    quote([PARAGRAPH]), paragraph(['emphasis', 'strong', 'code'].map((mark) => node('rich-span', { text: 'x', mark })))];

  for (const [name, sample, shapeValid, valid = shapeValid] of [
    ['each block and inline type', value(allNodes, { clamp: 20 }), true],
    ['empty blocks', value([]), true],
    ['inline count at the limit', value(maxInline), true],
    ['text with 2000 code points', value([paragraph([node('rich-span', { text: '🌱'.repeat(2000) })])]), true],
    ['mail link', value([paragraph([node('rich-link', { text: 'Mail', url: 'mailto:check@example.org' })])]), true],
    ['mail link with two recipients', value([paragraph([node('rich-link',
      { text: 'Mail', url: 'mailto:check@example.org,other@example.org' })])]), true, false],
    ['heading skips a level', value([heading(1), heading(3)]), true, false],
    ['inline count over the limit', value([...maxInline, paragraph([SPAN])]), true, false],
    ['refused link scheme in a quote', value([quote([paragraph([node('rich-link', { text: 'File', url: 'file:///rules' })])])]), true, false],
    ['unknown block field', value([node('rich-paragraph', { content: [SPAN], style: 'x' })]), false],
    ['wrong node in a list', value([node('rich-list', { items: [SPAN] })]), false],
    ['missing text', value([paragraph([node('rich-span', {})])]), false],
    ['invalid span mark', value([paragraph([node('rich-span', { text: 'x', mark: 'underline' })])]), false],
    ['text over the limit', value([paragraph([node('rich-span', { text: '🌱'.repeat(2001) })])]), false],
    ['list over its item limit', value([node('rich-list', { items: Array(51).fill(PARAGRAPH) })]), false],
    ['clamp over the limit', value([], { clamp: 21 }), false],
    ['unknown value version', { ...value([]), version: '0.2.0' }, false],
    ['slots on a nested value', { ...value([]), slots: {} }, false],
    ['sparse inline list', value([paragraph(Array(1))]), false],
  ]) {
    const catalogValid = fillErrors(sample, CATALOG, 'value', 1).length === 0;
    assert.equal(catalogValid, shapeValid, name);
    const catalogAndRulesValid = catalogValid && richTextRules(sample.data, RICH_TEXT_SCHEMES).length === 0;
    assert.equal(catalogAndRulesValid, valid, name);
    assert.equal(richTextValueErrors(sample, RICH_TEXT_SCHEMES).length === 0, catalogAndRulesValid, name);
  }
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

test('the tool schema of each rich text block omits approval', () => {
  const schema = toolSchema('rich-text');
  for (const name of BLOCKS) {
    const data = schema.$defs[name].properties.data;
    assert.equal(data.additionalProperties, false, name);
    assert.ok(!Object.hasOwn(data.properties, 'approval'), name);
    assert.ok(!Object.hasOwn(toolSchema(name).properties.data.properties, 'approval'), name);
  }
});
