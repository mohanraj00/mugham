import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ActionState, bindingErrors } from '../src/actions/action.js';
import { createKit, describe, fill, mount, onAction, queueActions, toolSchema, validateFill } from '../src/kit.js';
import { memoryStore, openQueue } from '../src/offline/queue.js';
import { CATALOG } from '../src/render/catalog.js';
import { rangeEditProblem, stepGrid } from '../src/render/range.js';
import { BRAND, register } from '../src/render/registry.js';
import { schemaErrors } from '../src/render/validate.js';

const ACTOR = { type: 'agent', id: 'loan-helper', name: 'Loan helper' };
const CITATION = { source: 'Synthetic rules', locator: 'https://example.org/rules' };
const DRAFT = 'https://json-schema.org/draft/2020-12/schema';

function useDocument(t, customElements, createElement) {
  Object.assign(globalThis, { customElements, document: { createElement } });
  t.after(() => {
    delete globalThis.customElements;
    delete globalThis.document;
  });
}

test('fill uses the contract version and retains stated versions and slots', () => {
  const data = { label: 'Renew' };
  assert.deepEqual(fill('button', data), { component: 'button', version: CATALOG.button.version, data });
  const value = fill('card', { title: 'Loan' }, { version: '1.0.0', slots: { citation: CITATION } });
  assert.deepEqual(value.slots, { citation: CITATION });
  assert.deepEqual(validateFill(value), [`version: must be ${CATALOG.card.version}`]);
});

test('validateFill returns readable errors for missing data, slots and unknown names', () => {
  assert.deepEqual(validateFill(fill('button', { label: 'Renew' })), []);
  assert.deepEqual(validateFill(fill('button', {})), ['data.label: a required field is missing']);
  assert.deepEqual(validateFill(fill('card', { title: 'Loan' })), ['slots.authorship: a required slot is missing']);
  assert.deepEqual(validateFill({ component: 'banner', version: '0.1.0', data: {} }), ['component: no contract has the name banner']);
  assert.deepEqual(validateFill(null), ['(fill): must be an object']);
  for (const helper of [fill, mount, describe, toolSchema]) assert.throws(() => helper('banner', {}), /no contract has the name banner/);
});

test('a kit makes nested fills and uses only its bound actor in outer fills', () => {
  const actor = { ...ACTOR };
  const kit = createKit({ actor });
  const fact = kit.fill('fact', { label: 'Shelf', value: 'B-14' });
  const slots = { authorship: { type: 'human', id: 'reader' }, citation: CITATION };
  actor.id = 'other';
  const outer = kit.outer('card', { title: 'Loan', facts: [fact] }, { slots });
  assert.deepEqual(outer.slots, { authorship: ACTOR, citation: CITATION });
  assert.equal(slots.authorship.id, 'reader');
  assert.equal(Object.hasOwn(fact, 'slots'), false);
  assert.equal(Object.hasOwn(kit.outer('button', { label: 'Renew' }), 'slots'), false);
  assert.deepEqual(validateFill(outer), []);
  outer.slots.authorship.id = 'other';
  assert.deepEqual(kit.outer('card', { title: 'Loan' }).slots.authorship, ACTOR);
  for (const options of [undefined, {}, { actor: null }, { actor: { type: 'agent' } }]) {
    assert.throws(() => createKit(options), /actor/);
  }
});

test('mount sets the actor and action before the fill and appends the element last', (t) => {
  class Card { static component = 'card'; }
  class Button { static component = 'action-button'; }
  const tags = new Map([['mu-card', Card], ['mu-action-button', Button]]);
  const calls = [];
  useDocument(t, tags, (tag) => ({ tag,
    set actor(value) { calls.push(['actor', value]); },
    set action(value) { calls.push(['action', value]); },
    set fill(value) { calls.push(['fill', value]); },
  }));
  const parent = { append: (value) => calls.push(['append', value]) };
  const kit = createKit({ actor: ACTOR });
  const data = { title: 'Loan' };
  const card = kit.mount('card', data, { parent, actor: { type: 'human', id: 'reader' } });
  assert.equal(card.tag, 'mu-card');
  assert.deepEqual(calls.splice(0), [['actor', ACTOR], ['fill', kit.outer('card', data)], ['append', card]]);
  const action = { tool: 'loan.renew', label: 'Renew' };
  const renew = mount('action-button', { label: 'Renew' }, { parent, slot: 'actions', action });
  assert.equal(renew.tag, 'mu-action-button');
  assert.equal(renew.slot, 'actions');
  assert.deepEqual(calls, [['actor', null], ['action', action], ['fill', fill('action-button', { label: 'Renew' })], ['append', renew]]);
  assert.throws(() => mount('fact', {}), /no defined element for fact/);
});

test('mount refuses an action on a component without an action binding', (t) => {
  class Button { static component = 'button'; }
  useDocument(t, new Map([['mu-button', Button]]), () => new Button());
  const parent = { append: t.mock.fn() };
  const action = { tool: 'loan.renew', label: 'Renew' };
  assert.throws(() => mount('button', { label: 'Renew' }, { parent, action }), {
    name: 'TypeError', message: 'mount: button does not support an action binding',
  });
  assert.equal(parent.append.mock.callCount(), 0);
});

test('the helpers use the resolved contract and tag of a registered component', (t) => {
  class Base {
    static [BRAND] = true;
    get actor() { return null; }
    get fill() { return null; }
  }
  class Tray extends Base { static component = 'seed-tray'; }
  const elements = new Map();
  elements.define = elements.set;
  register({ name: 'seed-tray', description: 'A tray label.', version: '1.0.0',
    data: { label: { type: 'text', size: 'line', required: true } } }, Tray, elements);
  useDocument(t, elements, (tag) => ({ tag }));
  const tray = mount('seed-tray', { label: 'Tray A1' }, { actor: ACTOR });
  assert.equal(tray.tag, 'mu-app-seed-tray');
  assert.equal(tray.fill.version, '1.0.0');
  assert.deepEqual(tray.fill.slots, { authorship: ACTOR });
  assert.equal(describe('seed-tray').properties.label.maxLength, 80);
  assert.equal(toolSchema('seed-tray').properties.version.const, '1.0.0');
  assert.deepEqual(validateFill(tray.fill), []);
});

test('onAction waits for the handler and sends the receipt to the source element', async () => {
  const root = new EventTarget();
  const source = new ActionState();
  source.bind({ tool: 'loan.renew', arguments: { loan_id: 'L-0001' } });
  const request = source.start();
  const { promise, resolve } = Promise.withResolvers();
  const calls = [];
  const stop = onAction(root, (...args) => { calls.push(args); return promise; });
  const event = new CustomEvent('mu-action', { detail: request });
  event.composedPath = () => [source, root];
  root.dispatchEvent(event);
  assert.deepEqual(calls, [[request.tool, request.arguments, request.id, request, source]]);
  assert.equal(source.state, 'pending');
  resolve({ ok: true, message: 'Renewed.', reference: 'R-0001' });
  await promise;
  assert.equal(source.state, 'done');
  assert.equal(source.reference, 'R-0001');
  stop();
  source.reopen();
  const next = new CustomEvent('mu-action', { detail: source.start() });
  next.composedPath = () => [source, root];
  root.dispatchEvent(next);
  assert.equal(calls.length, 1);
});

test('onAction runs only one handler for a received event', async () => {
  const root = new EventTarget();
  const source = new ActionState();
  source.bind({ tool: 'loan.renew' });
  onAction(root, () => ({ ok: false, message: 'The loan is closed.' }));
  let extra = 0;
  onAction(root, () => { extra += 1; return { ok: true }; });
  const event = new CustomEvent('mu-action', { detail: source.start() });
  event.composedPath = () => [source, root];
  root.dispatchEvent(event);
  await Promise.resolve();
  assert.equal(source.state, 'error');
  assert.equal(extra, 0);
});

test('onAction uses the target when the event path is unavailable or empty', async () => {
  let listen;
  const root = { addEventListener: (_type, handler) => { listen = handler; } };
  onAction(root, () => ({ ok: true }));

  for (const composedPath of [undefined, () => undefined, () => []]) {
    const target = new ActionState();
    target.bind({ tool: 'loan.renew' });
    await listen({ target, composedPath, detail: target.start() });
    assert.equal(target.state, 'done');
  }
});

for (const [name, handler] of [
  ['a thrown error', () => { throw new Error('The connection closed.'); }],
  ['a rejected promise', () => Promise.reject(new Error('The connection closed.'))],
  ['no result', () => undefined],
  ['a missing ok', () => ({ message: 'Renewed.' })],
  ['a message over 200 characters', () => ({ ok: true, message: 'x'.repeat(201) })],
  ['a foreign id', (request) => ({ id: 'other', key: request.key, ok: true })],
  ['a foreign key', (request) => ({ id: request.id, key: 'other', ok: true })],
]) {
  test(`onAction keeps the action pending after ${name} and a retry keeps the key`, async () => {
    let listen;
    const root = { addEventListener: (_type, listener) => { listen = listener; } };
    const source = new ActionState();
    source.bind({ tool: 'loan.renew' });
    const request = source.start();
    onAction(root, (_tool, _args, id, current) => (id === request.id ? handler(current) : { ok: true }));
    await listen({ target: source, detail: request });
    assert.deepEqual([source.state, source.wait, source.message], ['pending', 'stalled', 'No receipt came back.']);
    assert.equal(source.start(), null);
    const retry = source.retry();
    assert.equal(retry.key, request.key);
    assert.notEqual(retry.id, request.id);
    await listen({ target: source, detail: retry });
    assert.equal(source.state, 'done');
  });
}

test('onAction keeps the action pending when the element refuses the receipt', async (t) => {
  let listen;
  const root = { addEventListener: (_type, listener) => { listen = listener; } };
  const source = new ActionState();
  source.bind({ tool: 'loan.renew' });
  const request = source.start();
  const receipt = t.mock.method(source, 'receipt', () => false);
  onAction(root, () => ({ ok: true }));
  await listen({ target: source, detail: request });
  assert.deepEqual(receipt.mock.calls.map((call) => call.arguments[0]), [{ ok: true, id: request.id }]);
  assert.deepEqual([source.state, source.wait, source.key], ['pending', 'stalled', request.key]);
  assert.equal(source.cancel(), true);
});

test('a failed older try does not stall a newer try', async () => {
  let listen;
  const root = { addEventListener: (_type, listener) => { listen = listener; } };
  const source = new ActionState();
  source.bind({ tool: 'loan.renew' });
  const request = source.start();
  const { promise, reject } = Promise.withResolvers();
  onAction(root, () => promise);
  const received = listen({ target: source, detail: request });
  source.hold({ key: request.key, wait: 'stalled' });
  const retry = source.retry();
  reject(new Error('The connection closed.'));
  await received;
  assert.deepEqual([source.state, source.wait, source.key], ['pending', 'sent', retry.key]);
});

// This checks the part of the Draft 2020-12 meta-schema that the helpers emit.
const child = { $ref: '#/$defs/schema' };
const map = { type: 'object', additionalProperties: child };
const count = { type: 'integer', minimum: 0 };
const meta = { ...child, $defs: { schema: { type: 'object', additionalProperties: false, properties: {
  $schema: { const: DRAFT }, $defs: map, $ref: { type: 'string', pattern: '^#/[\\$]defs/[a-z][a-z0-9-]*$' },
  type: { enum: ['object', 'array', 'string', 'number', 'integer', 'boolean'] },
  description: { type: 'string' }, title: { type: 'string' }, properties: map, additionalProperties: { type: 'boolean' },
  required: { type: 'array', uniqueItems: true, items: { type: 'string' } }, const: {},
  enum: { type: 'array', minItems: 1, uniqueItems: true }, oneOf: { type: 'array', minItems: 1, items: child },
  minLength: count, maxLength: count, minItems: count, maxItems: count, uniqueItems: { type: 'boolean' }, items: child,
  minimum: { type: 'number' }, maximum: { type: 'number' },
  pattern: { type: 'string' }, format: { const: 'date' },
} } } };

function checkSchema(schema) {
  assert.equal(schema.$schema, DRAFT);
  assert.deepEqual(schemaErrors(schema, meta), []);
  function checkLinks(node) {
    if (node === null || typeof node !== 'object') return;
    if (node.$ref) assert.ok(Object.hasOwn(schema.$defs, node.$ref.split('/').at(-1)));
    if (node.pattern) assert.doesNotThrow(() => new RegExp(node.pattern, 'u'));
    Object.values(node).forEach(checkLinks);
  }
  checkLinks(schema);
}

// The instance validator treats format as an annotation in this draft.
function instanceErrors(value, schema) {
  return schemaErrors(value, JSON.parse(JSON.stringify(schema), (key, item) => key === 'format' ? undefined : item));
}

function sample(field) {
  switch (field.type) {
    case 'text': return 'x'.repeat(Math.max(field.min_length ?? 0, 1));
    case 'integer':
    case 'number': return Math.min(Math.max(0, field.minimum ?? 0), field.maximum ?? Infinity);
    case 'boolean': return true;
    case 'date': return '2026-12-01';
    case 'enum': return field.values[0];
    case 'list': return [sample(field.items)];
    case 'component': {
      const name = field.name ?? field.names[0];
      return fill(name, sampleData(CATALOG[name]));
    }
    default: assert.fail(`Unknown field type ${field.type}`);
  }
}

const TEMPORAL_SAMPLES = {
  'date-range-field': { label: 'Booking dates', value: ['2028-02-29', '2028-03-01'], earliest: '2028-02-28', latest: '2028-03-03' },
  'time-field': { label: 'Start time', value: '09:35', earliest: '09:05', latest: '17:00', step: 15 },
  'date-time-field': { label: 'Setup date and time', value: '2028-02-29T23:59', time_zone: 'Europe/Oslo' },
};

function sampleData(contract) {
  if (Object.hasOwn(TEMPORAL_SAMPLES, contract.name)) return TEMPORAL_SAMPLES[contract.name];
  if (contract.name === 'multi-choice-field') return { label: 'Plants', choices: ['Mist fern'], value: ['Mist fern'] };
  if (contract.name === 'range-field') return { label: 'Loan period in days', minimum: 7, maximum: 28, step: 7, value: 14 };
  return Object.fromEntries(Object.entries(contract.data).map(([key, field]) => [key, sample(field)]));
}

for (const [name, contract] of Object.entries(CATALOG)) {
  test(`${name} schemas accept valid data and refuse an extra field`, () => {
    const kit = createKit({ actor: ACTOR });
    const schema = toolSchema(name);
    const dataSchema = describe(name);
    for (const item of [schema, dataSchema]) checkSchema(item);
    const slots = contract.slots?.citation ? { citation: CITATION } : undefined;
    const valid = kit.outer(name, sampleData(contract), { slots });
    const invalid = { ...valid, data: { ...valid.data, extra: true } };
    assert.deepEqual(validateFill(valid), []);
    assert.deepEqual(instanceErrors(valid, schema), []);
    assert.deepEqual(instanceErrors(valid.data, dataSchema), []);
    assert.notDeepEqual(instanceErrors(invalid, schema), []);
    assert.notDeepEqual(instanceErrors(invalid.data, dataSchema), []);
  });
}

test('schema exports refuse unknown field types', (t) => {
  const field = CATALOG.button.data.label;
  const originalType = field.type;
  t.after(() => { field.type = originalType; });
  field.type = 'future-type';
  for (const schema of [describe, toolSchema]) {
    assert.throws(() => schema('button'), { name: 'TypeError', message: /future-type/ });
  }
});

test('the editable form tool schema includes the three date and time fields', () => {
  const kit = createKit({ actor: ACTOR });
  const schema = toolSchema('editable-form');
  const data = (name) => schema.$defs[name].properties.data;
  assert.deepEqual(data('date-range-field').properties.value, {
    title: 'Value', type: 'array', minItems: 2, maxItems: 2,
    items: { ...toolSchema('date-field').properties.data.properties.value, title: 'Date' },
  });
  assert.deepEqual(data('time-field').properties.step, { title: 'Step', type: 'integer', minimum: 1 });
  assert.deepEqual(data('date-time-field').required, ['label', 'value', 'time_zone']);
  for (const [name, sample] of Object.entries(TEMPORAL_SAMPLES)) {
    const nested = (value) => kit.outer('editable-form', { title: 'Room booking', submit_label: 'Save',
      fields: [fill(name, { ...sample, value })] });
    assert.deepEqual(instanceErrors(nested(sample.value), schema), []);
    assert.notDeepEqual(instanceErrors(nested(12), schema), []);
  }
});

test('the date and time contracts refuse invalid values and limits in a form', () => {
  const kit = createKit({ actor: ACTOR });
  for (const [name, cases] of Object.entries({
    'date-range-field': [
      [{ value: ['2027-02-29', '2028-03-01'] }, 'value[0]: must be a date as YYYY-MM-DD'],
      [{ value: ['2028-02-29', '2028-02-30'] }, 'value[1]: must be a date as YYYY-MM-DD'],
      [{ value: ['2028-03-01'] }, 'value: fewer than 2 items'],
      [{ value: ['2028-02-28', '2028-03-01', '2028-03-02'] }, 'value: more than 2 items'],
      [{ value: ['2028-02-27', '2028-03-01'] }, 'value[0]: the date is outside the range'],
      [{ value: ['2028-02-29', '2028-03-04'] }, 'value[1]: the date is outside the range'],
      [{ value: ['2028-03-01', '2028-02-29'] }, 'value: the end date is before the start date'],
      [{ earliest: '2028-03-04' }, 'earliest: the earliest date is after the latest date'],
    ],
    'time-field': [
      [{ value: '24:00' }, 'value: must be a time as HH:MM'],
      [{ value: '09:60' }, 'value: must be a time as HH:MM'],
      [{ value: '09:00' }, 'value: the time is outside the range'],
      [{ value: '17:05' }, 'value: the time is outside the range'],
      [{ value: '09:30' }, 'value: the time is off a step'],
      [{ earliest: '18:00' }, 'earliest: the earliest time is after the latest time'],
      [{ earliest: '25:05' }, 'earliest: must be a time as HH:MM'],
      [{ latest: '17:60' }, 'latest: must be a time as HH:MM'],
      [{ step: 0 }, 'step: less than the minimum 1'],
      [{ step: 1.5 }, 'step: must be an integer'],
    ],
    'date-time-field': [
      [{ value: '2027-02-29T23:59' }, 'value: must be a date and time as YYYY-MM-DDTHH:MM'],
      [{ value: '2028-02-29T24:00' }, 'value: must be a date and time as YYYY-MM-DDTHH:MM'],
      [{ value: '2028-02-29 23:59' }, 'value: must be a date and time as YYYY-MM-DDTHH:MM'],
      [{ value: '2028-02-29T23:59Z' }, 'value: more than 16 characters'],
      [{ time_zone: '' }, 'time_zone: must have the form Area/Location'],
    ],
  })) {
    for (const [change, error] of cases) {
      const field = fill(name, { ...TEMPORAL_SAMPLES[name], ...change });
      assert.deepEqual(validateFill(field), ['data.' + error]);
      const form = kit.outer('editable-form', { title: 'Room booking', submit_label: 'Save', fields: [field] });
      assert.deepEqual(validateFill(form), ['data.fields[0].data.' + error]);
    }
  }
  assert.deepEqual(validateFill(fill('time-field', { label: 'Time', value: '00:15', step: 15 })), []);
  assert.deepEqual(validateFill(fill('time-field', { label: 'Time', value: '00:14', step: 15 })), ['data.value: the time is off a step']);
  assert.deepEqual(validateFill(fill('date-time-field', { label: 'Setup', value: '2028-02-29T00:00' })),
    ['data.time_zone: a required field is missing']);
});

test('the toggle tool schema gives a boolean and two displays, also in an editable form', () => {
  const kit = createKit({ actor: ACTOR });
  const schema = toolSchema('toggle-field');
  const formSchema = toolSchema('editable-form');
  const { properties, required } = schema.properties.data;
  assert.deepEqual(required, ['label']);
  assert.deepEqual(properties.value, { title: 'Value', type: 'boolean' });
  assert.deepEqual(properties.display, { title: 'Display', type: 'string', enum: ['checkbox', 'switch'] });
  const nested = (field) => kit.outer('editable-form', { title: 'Library notices', submit_label: 'Save', fields: [field] });
  for (const data of [{}, { value: false, display: 'checkbox' }, { value: true, display: 'switch' }]) {
    const field = fill('toggle-field', { name: 'reminder', label: 'Send a reminder', ...data });
    assert.deepEqual(instanceErrors(field, schema), []);
    assert.deepEqual(instanceErrors(nested(field), formSchema), []);
    assert.deepEqual(validateFill(nested(field)), []);
  }
  for (const value of ['false', 0, null]) {
    const field = fill('toggle-field', { name: 'reminder', label: 'Send a reminder', value });
    assert.notDeepEqual(instanceErrors(field, schema), []);
    assert.notDeepEqual(instanceErrors(nested(field), formSchema), []);
    assert.deepEqual(validateFill(field), ['data.value: must be true or false']);
  }
});

test('the range tool schema gives a number and an exact pair, also in an editable form', () => {
  const kit = createKit({ actor: ACTOR });
  const schema = toolSchema('range-field');
  const formSchema = toolSchema('editable-form');
  const data = schema.properties.data;
  assert.deepEqual(data.required, ['label', 'value', 'minimum', 'maximum', 'step']);
  assert.deepEqual(data.properties.value.oneOf, [
    { type: 'number' }, { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number' } },
  ]);
  for (const [value, valid] of [[14, true], [[7, 28], true], [[21, 21], true],
    [[14], false], [[7, 14, 21], false], [[7, '28'], false], [false, false]]) {
    const field = fill('range-field', { ...sampleData(CATALOG['range-field']), name: 'days', value });
    const form = kit.outer('editable-form', { title: 'Loan', submit_label: 'Save', fields: [field] });
    assert.equal(instanceErrors(field, schema).length === 0, valid);
    assert.equal(instanceErrors(form, formSchema).length === 0, valid);
  }
});

test('the range fill refuses values outside the range, off a step or in reverse order', () => {
  const base = { label: 'Price range', minimum: -0.05, maximum: 0.26, step: 0.1 };
  for (const value of [-0.05, 0.25, [0.05, 0.25], [0.15, 0.15]]) {
    assert.deepEqual(validateFill(fill('range-field', { ...base, value })), []);
  }
  for (const [data, reason] of [
    [{ value: [0.05, 0.3] }, 'value[1]: the number is outside the range'],
    [{ value: 0.05000000000000001 }, 'value: the number is off a step'],
    [{ value: [0.1, 0.25] }, 'value[0]: the number is off a step'],
    [{ value: [0.15, 0.05] }, 'value: the low value is more than the high value'],
    [{ value: 0.15, step: -0.1 }, 'step: must be more than zero'],
    [{ value: 0.15, maximum: -1 }, 'maximum: must be at least the minimum'],
    [{ value: Array(2) }, 'value: must be a number or a pair of numbers'],
  ]) {
    assert.deepEqual(validateFill(fill('range-field', { ...base, ...data })), ['data.' + reason]);
  }
  const kit = createKit({ actor: ACTOR });
  const form = kit.outer('editable-form', { title: 'Loan', submit_label: 'Save', fields: [
    fill('range-field', { ...base, name: 'price', value: 0.12 }),
  ] });
  assert.deepEqual(validateFill(form), ['data.fields[0].data.value: the number is off a step']);
});

test('the select tool schema gives up to 500 text choices, also in an editable form', () => {
  const kit = createKit({ actor: ACTOR });
  const schema = toolSchema('select-field');
  const formSchema = toolSchema('editable-form');
  const { properties, required } = schema.properties.data;
  assert.deepEqual(required, ['label', 'choices']);
  assert.equal(properties.choices.maxItems, 500);
  assert.equal(properties.choices.items.type, 'string');
  const choices = Array.from({ length: 500 }, (_, index) => 'Branch ' + index);
  for (const [items, valid] of [[choices, true], [[...choices, 'Other'], false]]) {
    const field = fill('select-field', { name: 'branch', label: 'Pickup branch', choices: items, value: choices.at(-1) });
    const form = kit.outer('editable-form', { title: 'Pickup details', submit_label: 'Save', fields: [field] });
    assert.equal(instanceErrors(field, schema).length === 0, valid);
    assert.equal(instanceErrors(form, formSchema).length === 0, valid);
    assert.equal(validateFill(form).length === 0, valid);
  }
});

test('the multi-choice tool schema gives unique lists of text, also in an editable form', () => {
  const name = 'multi-choice-field';
  const schema = toolSchema(name);
  const formSchema = toolSchema('editable-form');
  const { choices, value, min_items, max_items } = schema.properties.data.properties;
  assert.deepEqual([choices.minItems, choices.maxItems, choices.uniqueItems], [1, 500, true]);
  assert.deepEqual([value.items.type, value.maxItems, value.uniqueItems], ['string', 500, true]);
  for (const limit of [min_items, max_items]) assert.deepEqual([limit.type, limit.minimum, limit.maximum], ['integer', 0, 500]);
  const kit = createKit({ actor: ACTOR });
  const data = { name: 'plants', label: 'Plants', choices: ['Mist fern', 'Dune bell'] };
  for (const [selection, valid] of [[[], true], [['Mist fern'], true], [['Mist fern', 'Mist fern'], false], [[1], false]]) {
    const field = fill(name, { ...data, value: selection });
    const form = kit.outer('editable-form', { title: 'Bed', submit_label: 'Save', fields: [field] });
    assert.equal(instanceErrors(field, schema).length === 0, valid);
    assert.equal(instanceErrors(form, formSchema).length === 0, valid);
    assert.equal(validateFill(form).length === 0, valid);
  }
});

test('the step grid rounds to a step and moves within the available limits', () => {
  const grid = stepGrid({ minimum: -0.05, maximum: 0.26, step: 0.1 });
  assert.equal(grid.last, 0.25);
  assert.equal(grid.move(0.1, 0n), 0.15);
  assert.equal(grid.move(0.15, -1n), 0.05);
  assert.equal(grid.move(0.15, 10n), 0.25);
  assert.equal(grid.move(0.15, -10n), -0.05);
});

test('range edit problems give the reason and the declared limits', () => {
  const data = { minimum: 0.05, maximum: 0.25, step: 0.1 };
  const grid = stepGrid(data);
  for (const [value, reason] of [
    [NaN, 'Give a number.'],
    [0.04, 'The number is outside the range 0.05 to 0.25.'],
    [0.35, 'The number is outside the range 0.05 to 0.25.'],
    [0.1, 'Step size is 0.1. Start at 0.05.'],
    [0.25, 'The low value must be at most the high value.'],
    [0.15, null],
  ]) {
    assert.equal(rangeEditProblem(value, data, grid, [0.05, 0.15]), reason);
  }
});

test('the action button tool schema gives optional icon and display enums', () => {
  const name = 'action-button';
  const schema = toolSchema(name);
  const data = schema.properties.data;
  const icons = ['check', 'cross', 'edit', 'delete', 'send', 'retry'];
  const displays = ['text', 'icon', 'both'];
  assert.deepEqual(data.required, ['label']);
  assert.deepEqual(data.properties.icon, { title: 'Icon', type: 'string', enum: icons });
  assert.deepEqual(data.properties.display, { title: 'Display', type: 'string', enum: displays });
  const base = fill(name, { label: 'Approve request 42' });
  assert.deepEqual(instanceErrors(base, schema), []);
  for (const icon of icons) {
    for (const display of displays) {
      const value = { ...base, data: { ...base.data, icon, display } };
      assert.deepEqual(instanceErrors(value, schema), []);
      assert.deepEqual(validateFill(value), []);
    }
  }
  for (const fields of [{ icon: 'unknown' }, { icon: '<svg/>' }, { icon: 'https://example.org/icon.svg' }, { display: 'unknown' }]) {
    const value = { ...base, data: { ...base.data, ...fields } };
    const [key] = Object.keys(fields);
    assert.notDeepEqual(instanceErrors(value, schema), []);
    assert.match(validateFill(value)[0], new RegExp(`^data\\.${key}: must be one of`));
  }
});

test('an action button binding accepts only icons and displays from the contract', () => {
  const binding = { tool: 'request.approve', label: 'Approve request 42' };
  const { icon, display } = CATALOG['action-button'].data;
  for (const name of icon.values) {
    for (const mode of display.values) {
      assert.deepEqual(bindingErrors({ ...binding, icon: name, display: mode }), []);
    }
  }
  for (const value of ['unknown', '', null, 7]) {
    assert.deepEqual(bindingErrors({ ...binding, icon: value }),
      ['the icon must be one of check, cross, edit, delete, send, retry']);
    assert.deepEqual(bindingErrors({ ...binding, display: value }), ['the display must be one of text, icon, both']);
  }
});

test('schemas give resolved limits, enums and nested fill rules', () => {
  assert.equal(describe('card').properties.title.maxLength, 120);
  assert.equal(describe('card').properties.date.format, 'date');
  assert.deepEqual(describe('status').properties.state.enum, ['pending', 'passed', 'failed', 'unknown']);
  const schema = toolSchema('card-grid');
  const kit = createKit({ actor: ACTOR });
  const nested = kit.fill('card', { title: 'Loan' });
  const value = kit.outer('card-grid', { label: 'Loans', cards: [nested] });
  assert.deepEqual(instanceErrors(value, schema), []);
  const invalid = [
    { ...value, slots: {} },
    { ...value, version: '1.0.0' },
    { ...value, data: { ...value.data, cards: [{ ...nested, slots: { authorship: ACTOR } }] } },
    { ...value, data: { ...value.data, cards: [kit.fill('button', { label: 'Renew' })] } },
  ];
  for (const item of invalid) assert.notDeepEqual(instanceErrors(item, schema), []);
  schema.$defs.card.properties.data.properties.title.maxLength = 1;
  assert.deepEqual(instanceErrors(value, toolSchema('card-grid')), []);
});

test('onAction gives no receipt for an action that a cancel ended during the wait', async (t) => {
  const root = new EventTarget();
  const source = new ActionState();
  source.bind({ tool: 'tool.reserve' });
  const request = source.start();
  const { promise, resolve } = Promise.withResolvers();
  const errors = t.mock.method(console, 'error', () => {});
  onAction(root, () => promise);
  const event = new CustomEvent('mu-action', { detail: request });
  event.composedPath = () => [{ action: source, receipt: (value) => source.receipt(value) }, root];
  root.dispatchEvent(event);
  source.hold({ key: request.key, wait: 'queued', tries: 0 });
  source.cancel();
  resolve(null);
  await promise;
  await Promise.resolve();
  assert.equal(source.state, 'default');
  assert.equal(errors.mock.callCount(), 0);
});

test('queueActions sends each action through the queue and connects its listeners', async () => {
  const root = new EventTarget();
  const source = new ActionState();
  source.bind({ tool: 'tool.reserve', arguments: { tool_id: 'T-01' } });
  const element = { action: source, receipt: (value) => source.receipt(value) };
  const calls = [];
  const { promise, resolve } = Promise.withResolvers();
  const queue = {
    perform: (...args) => { calls.push(args); return promise; },
    listen: (target) => { calls.push(['listen', target]); return () => calls.push(['stop']); },
  };
  const stop = queueActions(root, queue);
  const request = source.start();
  const event = new CustomEvent('mu-action', { detail: request });
  event.composedPath = () => [element, root];
  root.dispatchEvent(event);
  assert.deepEqual(calls, [['listen', root], [request, element]]);
  // The queue checks its own transport id and returns the id of the element's request.
  resolve({ id: request.id, key: request.key, ok: true, reference: 'B-0001' });
  await promise;
  await Promise.resolve();
  assert.deepEqual([source.state, source.reference], ['done', 'B-0001']);
  stop();
  assert.deepEqual(calls.at(-1), ['stop']);
});

test('queueActions gives the element a receipt after a queued retry', { timeout: 3000 }, async (t) => {
  const root = new EventTarget();
  const source = new ActionState();
  source.bind({ tool: 'tool.reserve' });
  const stalled = Promise.withResolvers();
  const done = Promise.withResolvers();
  const sent = [];
  const element = {
    action: source,
    hold(update) {
      source.hold(update);
      if (source.wait === 'stalled') stalled.resolve();
    },
    receipt(value) {
      const accepted = source.receipt(value);
      if (accepted) done.resolve(value);
      return accepted;
    },
  };
  const queue = await openQueue({ principal: 'member-1', store: memoryStore(), locks: null, events: null,
    send: (request) => {
      sent.push(request);
      if (sent.length === 1) throw new Error('The connection closed.');
      return { id: request.id, key: request.key, ok: true };
    } });
  const stop = queueActions(root, queue);
  t.after(() => { stop(); queue.close(); });
  const dispatch = (request) => {
    const event = new CustomEvent('mu-action', { detail: request });
    event.composedPath = () => [element, root];
    root.dispatchEvent(event);
  };
  const first = source.start();
  dispatch(first);
  await stalled.promise;
  dispatch(source.retry());
  assert.equal((await done.promise).id, first.id);
  assert.equal(source.state, 'done');
  assert.deepEqual(sent.map((request) => request.key), [first.key, first.key]);
  assert.equal(new Set([first.id, ...sent.map((request) => request.id)]).size, 3);
});
