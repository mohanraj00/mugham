import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createKit, fill, validateFill } from '../src/kit.js';

// The DOM calls used by the field and form. The browser checks cover focus order, layout and the accessibility tree.
let focused;
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
  get textContent() { return this.children.map((node) => typeof node === 'string' ? node : node.textContent).join(''); }
  set textContent(value) { this.replaceChildren({ textContent: String(value) }); }
  focus() { focused = this; }
  click() { this.dispatchEvent(new Event('click')); }
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
    const node = Object.assign(new Element(), { tag });
    if (tag === 'input') node.value = '';
    return node;
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

const PLANTS = { name: 'plants', label: 'Plants', value: ['Mist fern', 'Dune bell'],
  choices: ['Mist fern', 'Rain bell', 'Dune bell', 'Pebble reed', 'Glass moss', 'Drift vine', 'Cloud leaf', 'Fog cup'] };

test('a multi-choice fill rejects unknown, repeated, out-of-order and out-of-limit selections', () => {
  const name = 'multi-choice-field';
  assert.deepEqual(validateFill(fill(name, PLANTS)), []);
  assert.deepEqual(validateFill(fill(name, { label: PLANTS.label, choices: PLANTS.choices })), []);
  for (const [changes, reason] of [
    [{ value: ['Other'] }, 'value[0]: the value is not one of the choices'],
    [{ value: ['Mist fern', 'Mist fern'] }, 'value: the items are not unique'],
    [{ value: ['Dune bell', 'Mist fern'] }, 'value: use the order of the choices'],
    [{ value: Array(1) }, 'value[0]: must be a string'],
    [{ min_items: 3 }, 'value: fewer than 3 items'],
    [{ max_items: 1 }, 'value: more than 1 items'],
    [{ value: undefined, min_items: 1 }, 'value: fewer than 1 items'],
    [{ min_items: 3, max_items: 1 }, 'min_items: must be at most max_items'],
  ]) {
    const data = { ...PLANTS, ...changes };
    if (data.value === undefined) delete data.value;
    assert.deepEqual(validateFill(fill(name, data)), ['data.' + reason]);
  }
});

test('a checkbox group submits a bounded list in choice order', () => {
  const data = { ...PLANTS, choices: PLANTS.choices.slice(0, 7), value: [], min_items: 0, max_items: 2 };
  const form = kit.mount('editable-form', { title: 'Garden bed', submit_label: 'Save', fields: [fill('multi-choice-field', data)] },
    { action: { tool: 'garden.save', label: 'Save', title: 'Garden bed', editable: { plants: 'Plants' } } });
  const field = find(form.shadowRoot, (node) => node.tag === 'mu-multi-choice-field');
  const group = part(field.shadowRoot, 'group');
  assert.equal(group.getAttribute('role'), 'group');
  const label = part(field.shadowRoot, 'label');
  assert.equal(group.getAttribute('aria-labelledby'), label.id);
  assert.equal(label.textContent, 'Plants');
  assert.equal(part(field.shadowRoot, 'search'), undefined);
  const boxes = group.children.map((row) => part(row, 'checkbox'));
  assert.equal(boxes.length, 7);
  assert.ok(boxes.every((box) => box.tag === 'input' && box.getAttribute('type') === 'checkbox'));
  const change = (index, checked) => {
    boxes[index].checked = checked;
    boxes[index].dispatchEvent(new Event('change'));
  };
  const requests = [];
  form.addEventListener('mu-action', ({ detail }) => {
    requests.push(detail.arguments);
    form.receipt({ id: detail.id, ok: true });
  });
  const submit = () => find(form.shadowRoot, (node) => node.tag === 'form').dispatchEvent(new Event('submit', { cancelable: true }));
  change(2, true);
  change(1, true);
  change(0, true);
  submit();
  assert.deepEqual(requests, []);
  assert.equal(part(field.shadowRoot, 'problem').textContent, 'Select at most 2 choices.');
  change(1, false);
  assert.deepEqual(form.values(), { plants: ['Mist fern', 'Dune bell'] });
  submit();
  assert.deepEqual(requests, [{ plants: ['Mist fern', 'Dune bell'] }]);
  assert.equal(form.dataset.state, 'done');
  change(0, false);
  change(2, false);
  assert.equal(field.changed, false);
});

test('a tag picker toggles the active option and keeps the search open', () => {
  const field = kit.mount('multi-choice-field', PLANTS);
  const root = field.shadowRoot;
  const search = part(root, 'search');
  const list = part(root, 'listbox');
  const tags = part(root, 'tags');
  keys(search, 'ArrowDown');
  assert.equal(search.getAttribute('aria-autocomplete'), 'list');
  assert.equal(search.getAttribute('aria-expanded'), 'true');
  assert.equal(search.getAttribute('aria-controls'), list.id);
  assert.equal(list.getAttribute('aria-multiselectable'), 'true');
  type(search, 'bELL');
  assert.deepEqual(list.children.map((option) => option.textContent), ['Rain bell', 'Dune bell']);
  keys(search, 'End', 'Enter');
  assert.deepEqual(field.value, ['Mist fern']);
  assert.equal(list.children[1].getAttribute('aria-selected'), 'false');
  keys(search, 'Home', 'Enter');
  assert.deepEqual(field.value, ['Mist fern', 'Rain bell']);
  assert.equal(list.children[0].getAttribute('aria-selected'), 'true');
  assert.equal(search.getAttribute('aria-expanded'), 'true');
  keys(search, 'Escape');
  assert.equal(search.getAttribute('aria-expanded'), 'false');
  assert.equal(search.getAttribute('aria-activedescendant'), null);

  // A native remove button sends click when a person presses Enter or Space.
  const remove = () => part(tags.children[0], 'remove');
  assert.equal(remove().getAttribute('aria-label'), 'Remove Mist fern');
  remove().click();
  assert.equal(remove().getAttribute('aria-label'), 'Remove Rain bell');
  assert.equal(focused, remove());
  remove().click();
  assert.deepEqual(field.value, []);
  assert.equal(focused, search);
});
