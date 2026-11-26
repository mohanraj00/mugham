import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolSchema } from '../src/kit.js';
import { CATALOG } from '../src/render/catalog.js';
import { contractErrors, fillErrors } from '../src/render/validate.js';
import { readRichTree, readRichTransfer } from '../src/primitives/rich-text-field-model.js';
import { richTextValueErrors } from '../src/render/rich-text.js';
import { isPlannedPolicyReport, richTextFieldChecks } from './browser/rich-text-field.js';

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

const policyReport = {
  source: 'security',
  level: 'error',
  text: "Executing inline event handler violates the following Content Security Policy directive 'script-src 'self''."
    + " Either the 'unsafe-inline' keyword, a hash ('sha256-...'), or a nonce ('nonce-...') is required to enable inline execution."
    + " Note that hashes do not apply to event handlers, style attributes and javascript: navigations unless the 'unsafe-hashes' keyword is present."
    + ' The action has been blocked.',
  stackTrace: { callFrames: [{ url: 'http://127.0.0.1:8000/src/primitives/rich-text-field-model.js' }] },
};
const otherScript = 'http://127.0.0.1:8000/examples/apps/library-note.js';
const otherReport = {
  ...policyReport,
  stackTrace: { callFrames: [{ url: otherScript }, ...policyReport.stackTrace.callFrames] },
};
const styleReport = {
  ...policyReport,
  text: "Applying inline style violates the following Content Security Policy directive 'style-src 'self''."
    + " Either the 'unsafe-inline' keyword, a hash ('sha256-p0bF+un5yUb9MBO6xRb8kPHlY2BdpHVtLiFkDrZPF64='), or a nonce ('nonce-...') is required to enable inline execution."
    + ' The action has been blocked.',
};
const styleAttributeReport = {
  ...policyReport,
  text: "Applying inline style violates the following Content Security Policy directive 'style-src 'self''."
    + " Either the 'unsafe-inline' keyword, a hash ('sha256-8f935d27GvUutRyY9yWScUMiFUk4WTdZURISiYfPOeQ='), or a nonce ('nonce-...') is required to enable inline execution."
    + " Note that hashes do not apply to event handlers, style attributes and javascript: navigations unless the 'unsafe-hashes' keyword is present."
    + ' The action has been blocked.',
};

test('a planned policy report has the exact source, level, text and first script URL', () => {
  assert.equal(isPlannedPolicyReport(policyReport), true);
  for (const [name, entry] of [
    ['a different first script URL', otherReport],
    ['a different source', { ...policyReport, source: 'javascript' }],
    ['a different directive', { ...policyReport, text: policyReport.text.replace('script-src', 'style-src') }],
    ['different text with the same directive', { ...policyReport, text: policyReport.text + ' Extra text.' }],
    ['a warning', { ...policyReport, level: 'warning' }],
    ['no stack trace', { ...policyReport, stackTrace: undefined }],
    ['no frame URL', { ...policyReport, stackTrace: { callFrames: [{}] } }],
    ['a page error', { text: 'Uncaught Error: The page failed.', url: otherScript }],
  ]) {
    assert.equal(isPlannedPolicyReport(entry), false, name);
  }
});

test('the style reports match only the specified text, hash and source', () => {
  assert.equal(isPlannedPolicyReport(styleReport), true);
  assert.equal(isPlannedPolicyReport(styleAttributeReport), true);
  for (const [name, entry] of [
    ['a different directive', { ...styleReport, text: styleReport.text.replace('style-src', 'img-src') }],
    ['different text', { ...styleReport, text: styleReport.text.replace('Applying', 'Loading') }],
    ['a short hash', { ...styleReport, text: styleReport.text.replace('F64=', 'F6=') }],
    ['a long hash', { ...styleReport, text: styleReport.text.replace('F64=', 'F644=') }],
    ['a different first script URL', { ...otherReport, text: styleReport.text }],
    ['a different source', { ...styleReport, source: 'javascript' }],
    ['a warning', { ...styleReport, level: 'warning' }],
    ['extra text', { ...styleAttributeReport, text: styleAttributeReport.text + '\n' }],
  ]) {
    assert.equal(isPlannedPolicyReport(entry), false, name);
  }
});

async function runPasteChecks(events) {
  const problems = [policyReport.text];
  const listenerCounts = [];
  const networkCommands = [];
  const sessionId = 'note';
  const recordPageError = (event) => {
    if (event.sessionId !== sessionId) return;
    if (event.method === 'Log.entryAdded') problems.push(event.params.entry.text);
    if (event.method === 'Runtime.exceptionThrown') problems.push(event.params.exceptionDetails.text);
  };
  let width;
  const session = {
    listeners: [recordPageError],
    send(method, params, target) {
      if (method === 'Emulation.setDeviceMetricsOverride') width = params.width;
      if (method.startsWith('Network.')) networkCommands.push([width, method, target]);
    },
  };
  const emit = (method, params, target = sessionId) => {
    for (const listener of session.listeners) listener({ sessionId: target, method, params });
  };
  const steps = await richTextFieldChecks(session, sessionId, 'http://127.0.0.1:8000', { light: [] }, {
    open() {},
    key() {},
    pageRules: () => [],
    evaluate(_session, _id, expression) {
      if (expression.startsWith('(async function exercisePasteAndDrop(')) {
        listenerCounts.push(session.listeners.length);
        networkCommands.push([width, 'paste', sessionId]);
        events(emit, width);
        return [];
      }
      if (expression.startsWith('(async function exerciseEditor(')) {
        listenerCounts.push(session.listeners.length);
        return { headingOrder: true, failures: [] };
      }
      if (expression.includes("'noteScriptExecuted' in window")) return false;
      return { tabStops: [] };
    },
  }, problems);
  assert.deepEqual(listenerCounts, [2, 1, 2, 1]);
  assert.deepEqual(session.listeners, [recordPageError]);
  return {
    problems, networkCommands,
    pasteSteps: steps.filter(({ step }) => step.endsWith('planned policy reports and no handler runs')),
    networkSteps: steps.filter(({ step }) => step.endsWith('a paste of URL tags starts no request')),
  };
}

test('an unplanned report fails the paste check and stays in the page errors', async () => {
  const pageError = 'Uncaught Error: The page failed.';
  const otherStyleReport = { ...otherReport, text: styleReport.text };
  const { pasteSteps, networkSteps, problems } = await runPasteChecks((emit, width) => {
    emit('Log.entryAdded', { entry: policyReport });
    emit('Log.entryAdded', { entry: styleReport });
    emit('Log.entryAdded', { entry: styleAttributeReport });
    if (width === 1280) {
      emit('Log.entryAdded', { entry: otherReport });
      emit('Log.entryAdded', { entry: otherStyleReport });
      emit('Runtime.exceptionThrown', { exceptionDetails: { text: pageError, url: otherScript } });
    }
  });
  assert.deepEqual(pasteSteps.map(({ ok }) => ok), [true, false]);
  assert.deepEqual(JSON.parse(pasteSteps[1].detail).detail, {
    count: 3,
    other: [otherReport.text, otherStyleReport.text, pageError].map((text) => ({ text, url: otherScript })),
  });
  assert.deepEqual(problems, [policyReport.text, otherReport.text, otherStyleReport.text, pageError]);
  assert.deepEqual(networkSteps.map(({ ok }) => ok), [true, false]);
});

test('style reports alone fail the inline handler check', async () => {
  const { pasteSteps, problems } = await runPasteChecks((emit) => {
    emit('Log.entryAdded', { entry: styleReport });
    emit('Log.entryAdded', { entry: styleAttributeReport });
  });
  assert.deepEqual(pasteSteps.map(({ ok }) => ok), [false, false]);
  assert.match(JSON.parse(pasteSteps[0].detail).reason, /inline handler policy report/);
  assert.deepEqual(problems, [policyReport.text]);
});

test('the URL paste check records requests for its own session during paste and drop', async () => {
  const probeURL = 'http://127.0.0.1:8000/probe-paste/img.png';
  const { networkSteps, networkCommands } = await runPasteChecks((emit, width) => {
    emit('Log.entryAdded', { entry: policyReport });
    emit('Network.requestWillBeSent', { request: { url: 'http://127.0.0.1:8000/favicon.ico' } });
    emit('Network.requestWillBeSent', { request: { url: probeURL } }, 'other');
    if (width === 1280) emit('Network.requestWillBeSent', { request: { url: probeURL } });
  });
  assert.deepEqual(networkCommands, [375, 1280].flatMap((width) =>
    ['Network.enable', 'paste', 'Network.disable'].map((method) => [width, method, 'note'])));
  assert.deepEqual(networkSteps.map(({ ok }) => ok), [true, false]);
  const failure = JSON.parse(networkSteps[1].detail);
  assert.match(failure.reason, /started a request/);
  assert.deepEqual(failure.detail.urls, [probeURL]);
});
