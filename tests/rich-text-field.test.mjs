import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolSchema } from '../src/kit.js';
import { CATALOG } from '../src/render/catalog.js';
import { contractErrors, fillErrors } from '../src/render/validate.js';
import { readRichTree, readRichTransfer } from '../src/primitives/rich-text-field-model.js';
import { richTextValueErrors } from '../src/render/rich-text.js';

const fill = (component, data) => ({ component, version: '0.1.0', data });
const span = (text, mark) => fill('rich-span', mark ? { text, mark } : { text });
const paragraph = (...content) => fill('rich-paragraph', { content });
const rich = (...blocks) => fill('rich-text', { blocks });
const field = (value) => fill('rich-text-field', { name: 'note', label: 'Note', value });

// These nodes supply the same properties as the DOM nodes that the walk reads.
const html = 'http://www.w3.org/1999/xhtml';
const text = (data) => ({ nodeType: 3, data });
function element(localName, attributes = {}, ...nodes) {
  for (const [index, node] of nodes.entries()) node.nextSibling = nodes[index + 1] ?? null;
  return {
    nodeType: 1, namespaceURI: html, localName, firstChild: nodes[0] ?? null,
    getAttribute: (key) => Object.hasOwn(attributes, key) ? attributes[key] : null,
  };
}
const body = (...nodes) => element('body', {}, ...nodes);
const tag = (name, ...nodes) => element(name, {}, ...nodes);
const link = (url, words) => element('a', { href: url }, text(words));
const transfer = (html, plain = '') => ({ getData: (type) => type === 'text/html' ? html : plain });

function valid(result, expected) {
  assert.deepEqual(result, { value: expected });
  assert.deepEqual(richTextValueErrors(result.value), []);
  assert.deepEqual(fillErrors(field(result.value), CATALOG), []);
}

test('the catalog and tool schemas use the rich text value and the field protocol', () => {
  const contract = CATALOG['rich-text-field'];
  assert.equal(contract.field, true);
  assert.deepEqual(contractErrors(contract, CATALOG), []);
  assert.deepEqual(fillErrors(field(rich(paragraph(span('A note.')))), CATALOG), []);
  assert.ok(fillErrors(field('<p>A note.</p>'), CATALOG).length);
  const schema = toolSchema('rich-text-field');
  assert.equal(schema.properties.data.properties.value.$ref, '#/$defs/rich-text');
  assert.ok(schema.$defs['rich-text'].properties.data.properties.blocks);
  const form = toolSchema('editable-form');
  assert.ok(form.properties.data.properties.fields.items.oneOf.some(({ $ref }) => $ref === '#/$defs/rich-text-field'));
});

test('a tree gives each block and inline format as rich text data', () => {
  const tree = body(
    tag('p', text('Plain'), tag('em', text('emphasis')), tag('b', text('strong')), tag('code', text('code'))),
    tag('h2', text('First')), tag('h3', text('Second')), tag('h3', text('Next')),
    tag('ul', tag('li', text('Bullet'))), tag('ol', tag('li', text('Number'))),
    tag('blockquote', tag('p', text('Quote'))), tag('pre', tag('code', text('sample\n'))),
    tag('p', link('https://example.org/rules', 'Rules')),
  );
  valid(readRichTree(tree, { imported: true }), rich(
    paragraph(span('Plain'), span('emphasis', 'emphasis'), span('strong', 'strong'), span('code', 'code')),
    fill('rich-heading', { level: 1, content: [span('First')] }),
    fill('rich-heading', { level: 2, content: [span('Second')] }),
    fill('rich-heading', { level: 3, content: [span('Next')] }),
    fill('rich-list', { items: [paragraph(span('Bullet'))] }),
    fill('rich-list', { ordered: true, items: [paragraph(span('Number'))] }),
    fill('rich-quote', { paragraphs: [paragraph(span('Quote'))] }),
    fill('rich-code', { text: 'sample\n' }),
    paragraph(fill('rich-link', { text: 'Rules', url: 'https://example.org/rules' })),
  ));
});

test('the HTML walk keeps safe text and drops foreign nodes, unsafe text and attributes', () => {
  const svg = { ...tag('svg', text('foreign')), namespaceURI: 'http://www.w3.org/2000/svg' };
  const tree = body(tag('script', text('script')), tag('style', text('style')),
    tag('iframe', text('frame')), tag('object', text('object')), tag('embed'), svg,
    element('img', { onerror: 'ignored', src: 'ignored' }), tag('textarea', text('control')),
    element('p', { onclick: 'ignored', class: 'ignored', id: 'ignored', 'data-value': 'ignored' },
      element('span', { style: 'ignored' }, text('Note')), tag('unknown-element', text('unknown')),
      link('javascript:ignored', 'Script address'), link('data:text/plain,ignored', 'Data address'),
      link('http://example.org/', 'HTTP address')));
  let parsed = false;
  const parse = (source) => {
    parsed = true;
    assert.equal(source, '<p>HTML</p>');
    return tree;
  };
  valid(readRichTransfer(transfer('<p>HTML</p>', 'Fallback'), parse),
    rich(paragraph(span('Note'), span('Script address'), span('Data address'), span('HTTP address'))));
  assert.ok(parsed);
});

test('plain text stays text and is used if HTML cannot be read', () => {
  valid(readRichTransfer(transfer('<p>HTML</p>', '<b>Text</b>\r\nNext'), () => null),
    rich(paragraph(span('<b>Text</b>')), paragraph(span('Next'))));
});

test('a paste that exceeds a source, depth, or contract limit gives a refusal', () => {
  let parsed = false;
  assert.ok(readRichTransfer(transfer('x'.repeat(262145)), () => { parsed = true; }).problem);
  assert.equal(parsed, false);
  let deep = text('Hidden');
  for (let count = 0; count < 40; count += 1) deep = tag('div', deep);
  assert.ok(readRichTransfer(transfer('<div>Deep</div>'), () => body(deep)).problem);
  assert.ok(readRichTree(body(...Array.from({ length: 12001 }, () => tag('img')))).problem);
  assert.ok(readRichTransfer(transfer('', 'x'.repeat(2001))).problem);
  const items = Array.from({ length: 41 }, () => tag('p', ...Array.from({ length: 50 }, () => tag('em', text('x')))));
  assert.ok(readRichTree(body(...items)).problem);
});

test('the editable tree uses the same walk and retains the text of browser-made nodes', () => {
  valid(readRichTree(body(tag('div', element('font', { color: 'red' }, text('Edited'))))),
    rich(paragraph(span('Edited'))));
  valid(readRichTree(body(tag('p', tag('a', text('Rules')))), {
    editorLink: () => 'https://example.org/rules',
  }), rich(paragraph(fill('rich-link', { text: 'Rules', url: 'https://example.org/rules' }))));
});
