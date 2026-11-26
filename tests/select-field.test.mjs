import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createKit, fill, validateFill } from '../src/kit.js';

// The DOM calls used by the field and form. The browser checks cover focus order, layout and the accessibility tree.
class TestNode extends EventTarget {
  children = [];
  attributes = new Map();
  dataset = {};
  ownerDocument = document;
  hidden = false;

  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  get id() { return this.getAttribute('id'); }
  get textContent() { return this.children.map((node) => node.textContent).join(''); }
  set textContent(value) { this.replaceChildren({ textContent: String(value) }); }
  focus() {}
  scrollIntoView() {}
}

const elements = new Map();
globalThis.customElements = {
  define: (name, constructor) => elements.set(name, constructor),
  get: (name) => elements.get(name),
};
globalThis.document = Object.assign(new EventTarget(), {
  createElement(tag) {
    const Element = elements.get(tag) ?? TestNode;
    return Object.assign(new Element(), { tag });
  },
  createTextNode: (textContent) => ({ textContent }),
});
globalThis.Node = TestNode;
globalThis.HTMLElement = class extends TestNode {
  attachShadow() { return (this.shadowRoot = new TestNode()); }
};
globalThis.CSSStyleSheet = class { replaceSync() {} };

const { define } = await import('../src/components/index.js');
define();

const DATA = { name: 'branch', label: 'Pickup branch', value: 'North Wing',
  choices: ['North Wing', 'East Annex', 'South Wing', 'Hill', 'Bay', 'Grove', 'Lake', 'West Annex'] };
const kit = createKit({ actor: { type: 'agent', id: 'agent-library' } });
const find = (node, match) => match(node) ? node : node.children?.map((child) => find(child, match)).find(Boolean);
const part = (root, name) => find(root, (node) => node.getAttribute?.('part') === name);
const keys = (node, ...names) => names.forEach((key) => node.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key })));
const type = (node, value) => {
  node.value = value;
  node.dispatchEvent(new Event('input'));
};

test('the select fill refuses a value outside its choices and lists longer than 500 items', () => {
  assert.deepEqual(validateFill(fill('select-field', DATA)), []);
  const choices = Array.from({ length: 500 }, (_, index) => 'Branch ' + index);
  assert.deepEqual(validateFill(fill('select-field', { ...DATA, choices, value: choices.at(-1) })), []);
  for (const [change, reason] of [
    [{ value: 'Other' }, 'value: the value is not one of the choices'],
    [{ value: '' }, 'value: the value is not one of the choices'],
    [{ value: 'north wing' }, 'value: the value is not one of the choices'],
    [{ choices: [] }, 'choices: give at least one choice'],
    [{ choices: ['North Wing', 'North Wing'] }, 'choices: the choices must be unique'],
    [{ choices: [...choices, 'Other'] }, 'choices: more than 500 items'],
  ]) {
    assert.deepEqual(validateFill(fill('select-field', { ...DATA, ...change })), ['data.' + reason]);
  }
  const invalid = fill('select-field', { ...DATA, value: 'Other' });
  const form = kit.outer('editable-form', { title: 'Pickup details', submit_label: 'Save', fields: [invalid] });
  assert.deepEqual(validateFill(form), ['data.fields[0].data.value: the value is not one of the choices']);
});

test('the search matches text in any position and the empty result keeps the value', () => {
  const field = kit.mount('select-field', DATA);
  const root = field.shadowRoot;
  const control = part(root, 'control');
  const search = part(root, 'search');
  const list = part(root, 'listbox');
  const status = part(root, 'status');
  const edits = [];
  field.addEventListener('mu-edit', ({ detail }) => edits.push(detail.value));

  keys(control, ' ');
  assert.equal(control.getAttribute('aria-expanded'), 'true');
  assert.equal(search.getAttribute('aria-autocomplete'), 'list');
  assert.equal(search.getAttribute('aria-controls'), list.id);
  type(search, 'aNnEx');
  assert.deepEqual(list.children.map((option) => option.textContent), ['East Annex', 'West Annex']);
  assert.equal(search.getAttribute('aria-activedescendant'), list.children[0].id);
  assert.equal(field.value, 'North Wing');

  type(search, '?');
  assert.equal(list.children.length, 0);
  assert.equal(search.getAttribute('aria-activedescendant'), null);
  assert.equal(status.getAttribute('aria-live'), 'polite');
  assert.equal(status.textContent, 'No match');
  keys(search, 'Enter');
  assert.equal(control.getAttribute('aria-expanded'), 'true');
  assert.equal(field.value, 'North Wing');

  type(search, 'wing');
  keys(search, 'End', 'Enter');
  assert.equal(control.getAttribute('aria-expanded'), 'false');
  assert.equal(field.value, 'South Wing');
  assert.equal(list.children[1].getAttribute('aria-selected'), 'true');
  assert.deepEqual(edits, ['South Wing']);
  keys(control, 'ArrowDown');
  assert.equal(search.value, '');
  assert.equal(list.children.find((node) => node.getAttribute('aria-selected') === 'true').textContent, 'South Wing');
  keys(search, 'Home', 'Escape');
  assert.equal(field.value, 'South Wing');
  assert.deepEqual(edits, ['South Wing']);
  field.disconnectedCallback();
});

test('a short list uses the control for keyboard navigation and the form sends the selected text', () => {
  const select = fill('select-field', { ...DATA, choices: DATA.choices.slice(0, 7) });
  const form = kit.mount('editable-form', { title: 'Pickup details', submit_label: 'Save', fields: [select] },
    { action: { tool: 'library.pick_branch', label: 'Save', title: 'Pickup details', editable: { branch: DATA.label } } });
  const field = find(form.shadowRoot, (node) => node.tag === 'mu-select-field');
  const control = part(field.shadowRoot, 'control');
  const list = part(field.shadowRoot, 'listbox');
  assert.equal(part(field.shadowRoot, 'search'), undefined);
  const requests = [];
  form.addEventListener('mu-action', ({ detail }) => {
    requests.push(detail.arguments);
    form.receipt({ id: detail.id, ok: true });
  });
  keys(control, ' ', 'End', 'Home', 'ArrowDown', 'ArrowDown', 'ArrowUp');
  assert.equal(control.getAttribute('aria-activedescendant'), list.children[1].id);
  assert.deepEqual(form.values(), { branch: 'North Wing' });
  keys(control, 'Enter');
  assert.deepEqual(requests, []);
  assert.deepEqual(form.values(), { branch: 'East Annex' });
  find(form.shadowRoot, (node) => node.tag === 'form').dispatchEvent(new Event('submit', { cancelable: true }));
  assert.deepEqual(requests, [{ branch: 'East Annex' }]);
  assert.equal(form.dataset.state, 'done');
});
