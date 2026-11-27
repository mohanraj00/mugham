import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createKit, fill, toolSchema, validateFill } from '../src/kit.js';

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
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  querySelectorAll(selector) {
    const matches = (node) => node.tag === 'input' && (selector === 'input' || (selector === 'input:checked' && node.checked));
    return this.children.flatMap((node) => [...(matches(node) ? [node] : []), ...(node.querySelectorAll?.(selector) ?? [])]);
  }
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
  createElementNS: (namespaceURI, tag) => Object.assign(new TestNode(), { namespaceURI, tag }),
  createTextNode: (textContent) => ({ textContent }),
});
globalThis.Node = TestNode;
globalThis.HTMLElement = class extends TestNode {
  attachShadow() { return (this.shadowRoot = new TestNode()); }
};
globalThis.CSSStyleSheet = class { replaceSync() {} };

const { MuElement, define, register } = await import('../src/components/index.js');
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

test('the booking form refuses time zones that do not agree with the binding', () => {
  const binding = { tool: 'rooms.save', title: 'Room booking', label: 'Save',
    editable: { setup: 'Setup date and time', note: 'Note' } };
  const field = fill('date-time-field', { name: 'setup', label: binding.editable.setup,
    value: '2028-02-29T08:00', time_zone: 'Europe/Oslo' });
  const note = fill('field', { name: 'note', label: binding.editable.note });
  const wrongZone = 'data.fields: the time zone of the field setup is not the time zone of the application';
  for (const [fields, time_zones, reason] of [
    [[field], { setup: 'America/New_York' }, wrongZone],
    [[field], undefined, wrongZone],
    [[fill('time-field', { name: 'setup', label: binding.editable.setup, value: '08:00' })], { setup: 'Europe/Oslo' },
      'data.fields: the time zone of the application for setup needs a date and time field'],
    [[field, note], { setup: 'Europe/Oslo', note: 'Europe/Oslo' },
      'data.fields: the time zone of the application for note needs a date and time field'],
    [[field], { setup: 'Europe/Oslo', note: 'Europe/Oslo' },
      'data.fields: the time zone of the application for note needs a date and time field'],
  ]) {
    const form = kit.mount('editable-form', { title: binding.title, submit_label: binding.label, fields },
      { action: { ...binding, time_zones } });
    assert.equal(form.dataset.state, 'refused');
    assert.match(part(form.shadowRoot, 'details').textContent, new RegExp(reason));
    assert.equal(part(form.shadowRoot, 'button'), undefined);
  }
});

test('the booking form submits a date pair and two text values after invalid edits are fixed', () => {
  const values = { dates: ['2028-02-29', '2028-03-01'], start_time: '09:35', setup: '2028-02-29T08:00' };
  const editable = { dates: 'Booking dates', start_time: 'Start time', setup: 'Setup date and time' };
  const form = kit.mount('editable-form', { title: 'Room booking', submit_label: 'Save', fields: [
    fill('date-range-field', { name: 'dates', label: editable.dates, value: values.dates, earliest: '2028-02-29' }),
    fill('time-field', { name: 'start_time', label: editable.start_time, value: values.start_time, earliest: '09:05', step: 15 }),
    fill('date-time-field', { name: 'setup', label: editable.setup, value: values.setup, time_zone: 'Europe/Oslo', hint: 'Set the setup time.' }),
  ] }, { action: { tool: 'rooms.save', title: 'Room booking', label: 'Save', editable, time_zones: { setup: 'Europe/Oslo' } } });
  const field = (name) => find(form.shadowRoot, (node) => node.tag === 'mu-' + name);
  const dates = field('date-range-field');
  const time = field('time-field');
  const setup = field('date-time-field');
  const group = part(dates.shadowRoot, 'group');
  assert.equal(group.getAttribute('role'), 'group');
  assert.equal(group.getAttribute('aria-labelledby'), part(dates.shadowRoot, 'label').id);
  const start = part(dates.shadowRoot, 'start');
  const end = part(dates.shadowRoot, 'end');
  const clock = part(time.shadowRoot, 'input');
  const local = part(setup.shadowRoot, 'input');
  const zone = part(setup.shadowRoot, 'time-zone');
  assert.deepEqual([start, end, clock, local].map((node) => node.getAttribute('type')), ['date', 'date', 'time', 'datetime-local']);
  for (const [root, input, label] of [[dates.shadowRoot, start, 'Start date'], [dates.shadowRoot, end, 'End date'],
    [time.shadowRoot, clock, editable.start_time], [setup.shadowRoot, local, editable.setup]]) {
    assert.equal(find(root, (node) => node.getAttribute?.('for') === input.id).textContent, label);
  }
  assert.equal(clock.step, '900');
  assert.equal(clock.min, '09:05');
  assert.equal(start.min, '2028-02-29');
  assert.equal(end.min, '2028-02-29');
  assert.equal(zone.textContent, 'Time zone Europe/Oslo');
  assert.ok(local.getAttribute('aria-describedby').split(' ').includes(zone.id));
  assert.deepEqual(form.values(), values);
  assert.equal(dates.changed, false);

  const requests = [];
  form.addEventListener('mu-action', ({ detail }) => {
    requests.push(detail.arguments);
    form.receipt({ id: detail.id, ok: true });
  });
  const submit = () => find(form.shadowRoot, (node) => node.tag === 'form').dispatchEvent(new Event('submit', { cancelable: true }));
  for (const [node, root, input, value] of [
    [dates, dates.shadowRoot, start, '2028-03-02'],
    [time, time.shadowRoot, clock, '09:30'],
    [setup, setup.shadowRoot, local, ''],
  ]) {
    const old = input.value;
    type(input, value);
    submit();
    assert.deepEqual(requests, []);
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    assert.equal(focused, node === dates ? end : input);
    assert.ok(part(root, 'problem').textContent);
    type(input, old);
    assert.equal(input.getAttribute('aria-invalid'), null);
  }
  assert.ok(local.getAttribute('aria-describedby').split(' ').includes(zone.id));
  assert.equal(dates.changed, false);
  type(end, '2028-02-29');
  type(clock, '09:50');
  type(local, '2028-02-29T08:15');
  submit();
  assert.deepEqual(requests, [{ dates: ['2028-02-29', '2028-02-29'], start_time: '09:50', setup: '2028-02-29T08:15' }]);
  assert.equal(form.dataset.state, 'done');
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

class SampleField extends MuElement {
  static component = 'sample-field';
  value = '';
  validationMessage = '';
  disabled = false;
  editType = null;

  render(data) {
    this.value = data.value;
    this.disabled = Boolean(data.disabled);
    return [];
  }
}
class SampleDisplay extends MuElement {
  static component = 'sample-display';
}

const sampleData = {
  name: { type: 'text', size: 'short' },
  label: { type: 'text', required: true, size: 'line' },
  value: { type: 'text', required: true, size: 'line' },
  disabled: { type: 'boolean' },
  typed: { type: 'boolean' },
  time_zone: { type: 'text', size: 'line' },
};
register({ name: 'sample-field', description: 'A synthetic field.', field: true, data: sampleData }, SampleField);
register({ name: 'sample-display', description: 'A synthetic display.', ai_content: false, data: sampleData }, SampleDisplay);

const sample = { name: 'color', label: 'Color', value: 'Rain blue' };
const sampleAction = { title: 'Sample label', label: 'Save', tool: 'labels.save', editable: { color: 'Color' } };
function sampleForm(fields, action = sampleAction, title = sampleAction.title) {
  return kit.mount('editable-form', { title, submit_label: 'Save', fields }, { action });
}
function submit(form) {
  find(form.shadowRoot, (node) => node.tag === 'form').dispatchEvent(new Event('submit', { cancelable: true }));
}
function requestsFrom(form) {
  const requests = [];
  form.addEventListener('mu-action', ({ detail }) => {
    requests.push(detail);
    form.receipt({ id: detail.id, ok: true });
  });
  return requests;
}

test('a kit field and a registered field send the same request arguments and typed edit', () => {
  const action = { ...sampleAction, typed: ['color'], editor: { type: 'human', id: 'editor-1' } };
  for (const name of ['field', 'sample-field']) {
    const form = sampleForm([fill(name, { ...sample, typed: true })], action);
    const field = find(form.shadowRoot, (node) => node instanceof SampleField || node.tag === 'mu-field');
    const requests = requestsFrom(form);
    if (field instanceof SampleField) {
      assert.deepEqual(field.fill.slots, form.fill.slots);
      assert.deepEqual(field.actor, form.actor);
      field.value = 'Reed green';
      field.dispatchEvent(new CustomEvent('mu-edit', { detail: { value: 'Other' } }));
      submit(form);
      assert.equal(requests.length, 0);
      assert.equal(part(form.shadowRoot, 'reason').textContent, 'Choose an edit type.');
      field.editType = 'correction';
      field.dispatchEvent(new CustomEvent('mu-edit'));
    } else {
      type(part(field.shadowRoot, 'input'), 'Reed green');
      const correction = find(part(field.shadowRoot, 'edit-type'), (node) => node.tag === 'input' && node.value === 'correction');
      correction.checked = true;
      correction.dispatchEvent(new Event('change'));
    }
    assert.equal(field.disabled, false);
    assert.equal(field.validationMessage, '');
    assert.equal(field.editType, 'correction');
    assert.deepEqual(form.values(), { color: 'Reed green' });
    submit(form);
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0].arguments, { color: 'Reed green' });
    const [{ time, ...edit }] = requests[0].edits;
    assert.equal(new Date(time).toISOString(), time);
    assert.deepEqual(edit, { field: 'color', type: 'correction', old_value: 'Rain blue', new_value: 'Reed green', actor: action.editor });
  }
  const schema = toolSchema('editable-form');
  assert.ok(schema.$defs['sample-field']);
  assert.equal(schema.$defs['sample-display'], undefined);
});

test('an editable form refuses a registered display and checks the binding of a registered field', () => {
  const cases = [
    ['sample-display', sample, sampleAction, sampleAction.title, 'data.fields[0].component: must be a field'],
    ['sample-field', sample, sampleAction, 'Other label', 'data.title: the title is not the title of the application'],
    ['sample-field', { ...sample, name: 'color?' }, sampleAction, sampleAction.title, 'data.fields: each field needs a name'],
    ['sample-field', { ...sample, name: 'other' }, sampleAction, sampleAction.title, 'data.fields: the application does not accept the field other'],
    ['sample-field', { ...sample, label: 'Other' }, sampleAction, sampleAction.title, 'data.fields: the label of the field color is not the label of the application'],
    ['sample-field', { ...sample, typed: true }, sampleAction, sampleAction.title, 'data.fields: the edit type of the field color is not the rule of the application'],
    ['sample-field', { ...sample, time_zone: 'America/New_York' }, { ...sampleAction, time_zones: { color: 'Europe/Oslo' } },
      sampleAction.title, 'data.fields: the time zone of the field color is not the time zone of the application'],
    ['sample-field', sample, { ...sampleAction, time_zones: { color: 'Europe/Oslo' } },
      sampleAction.title, 'data.fields: the time zone of the application for color needs a date and time field'],
  ];
  for (const [component, data, action, title, reason] of cases) {
    const form = sampleForm([fill(component, data)], action, title);
    assert.equal(form.dataset.state, 'refused');
    assert.ok(part(form.shadowRoot, 'details').textContent.includes(reason), reason);
    assert.equal(part(form.shadowRoot, 'button'), undefined);
  }
});

test('the form shows a registered field error and refuses unsupported action values', () => {
  const form = sampleForm([fill('sample-field', sample)]);
  const field = find(form.shadowRoot, (node) => node instanceof SampleField);
  const requests = requestsFrom(form);
  field.validationMessage = 'Choose a color.';
  submit(form);
  assert.equal(part(form.shadowRoot, 'reason').textContent, 'Choose a color.');
  assert.equal(focused, field);
  field.validationMessage = '';

  const cycle = {};
  cycle.self = cycle;
  for (const value of [cycle, null, undefined, Infinity, [2, 1], ['Text', 2], Array(1)]) {
    field.value = value;
    submit(form);
    assert.equal(requests.length, 0);
    assert.equal(part(form.shadowRoot, 'reason').textContent, 'Color: the value is not valid for the action.');
  }
  field.value = ['Rain blue', 'Reed green'];
  submit(form);
  assert.equal(form.dataset.state, 'done');
  assert.deepEqual(requests.map((request) => request.arguments), [{ color: ['Rain blue', 'Reed green'] }]);
});

test('the form leaves a disabled registered field out of the request', () => {
  for (const disabled of [true, false]) {
    const form = sampleForm([
      fill('sample-field', { ...sample, disabled }),
      fill('field', { name: 'note', label: 'Note', value: 'Sample label' }),
    ], { ...sampleAction, editable: { color: 'Color', note: 'Note' } });
    const field = find(form.shadowRoot, (node) => node instanceof SampleField);
    assert.equal(field.disabled, disabled);
    field.disabled = true;
    const requests = requestsFrom(form);
    assert.deepEqual(form.values(), { note: 'Sample label' });
    submit(form);
    assert.deepEqual(requests.map((request) => request.arguments), [{ note: 'Sample label' }]);
  }
});

test('an editable form sends a rich text field as a frozen rich text fill', () => {
  const note = fill('rich-text', { blocks: [
    fill('rich-paragraph', { content: [fill('rich-span', { text: 'A library note.', mark: 'strong' })] }),
  ] });
  const data = { name: 'note', label: 'Note', required: true, value: note };
  const form = document.createElement('mu-editable-form');
  form.actor = { type: 'human', id: 'reader' };
  const requests = [];
  form.addEventListener('mu-action', ({ detail }) => requests.push(detail));
  form.action = { tool: 'library.save_note', title: 'Library note', label: 'Save', editable: { note: 'Note' } };
  const setFields = (...fields) => {
    form.fill = { component: 'editable-form', version: '0.1.0',
      data: { title: 'Library note', submit_label: 'Save', fields },
      slots: { authorship: { type: 'human', id: 'reader' } } };
  };
  setFields(fill('rich-text-field', { name: 'note', label: 'Note', required: true }));
  let control = part(form.shadowRoot, 'form');
  control.dispatchEvent(new Event('submit', { cancelable: true }));
  const empty = find(control, (node) => node.tag === 'mu-rich-text-field');
  assert.equal(requests.length, 0);
  assert.equal(empty.validationMessage, 'Enter text.');
  assert.equal(part(empty.shadowRoot, 'problem').textContent, 'Enter text.');
  assert.equal(focused, part(empty.shadowRoot, 'input'));

  setFields(fill('rich-text-field', data));
  control = part(form.shadowRoot, 'form');
  const editor = find(control, (node) => node.tag === 'mu-rich-text-field');
  editor.value.data.blocks.length = 0;
  editor.fill.data.value.data.blocks.length = 0;
  assert.deepEqual(form.values(), { note });
  control.dispatchEvent(new Event('submit', { cancelable: true }));
  assert.deepEqual(requests[0].arguments, { note });
  assert.ok(Object.isFrozen(requests[0].arguments.note.data.blocks[0].data.content[0].data));
  assert.equal(form.receipt({ id: requests[0].id, ok: true }), true);
  assert.equal(form.dataset.state, 'done');

  setFields(fill('rich-text-field', { ...data, read_only: true }));
  const readonly = find(part(form.shadowRoot, 'form'), (node) => node.tag === 'mu-rich-text-field');
  assert.equal(part(readonly.shadowRoot, 'input').contentEditable, 'false');
  assert.equal(part(readonly.shadowRoot, 'input').getAttribute('aria-readonly'), 'true');
  assert.deepEqual(form.values(), { note });
});
