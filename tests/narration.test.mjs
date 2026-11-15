// Expected results from issue 40, decision 0005 and catalog/narration-check.md.
// These assertions were written before the implementation ran.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import example from '../examples/narration.json' with { type: 'json' };
import { checkNarration } from '../src/narration/check.js';

const fill = example.fill;
const difference = (field) => ({ field, message: 'does not match the card value' });
const unknown = (field) => ({ field, message: 'no card field has this label' });
const syntax = { field: 'narration', message: 'must use [Field: value]' };
const pass = (checked) => ({ ok: true, checked, errors: [] });
const fail = (checked, ...errors) => ({ ok: false, checked, errors });

test('the example has a match and a different number', () => {
  assert.deepEqual(checkNarration(fill, example.cases[0].narration), pass(3));
  assert.deepEqual(checkNarration(fill, example.cases[1].narration), fail(3, difference('Count')));
});

test('a different date fails with its field name', () => {
  assert.deepEqual(checkNarration(fill, '[Date: 2026-11-16]'), fail(1, difference('Date')));
});

test('a different status fails with its field name', () => {
  assert.deepEqual(checkNarration(fill, '[Status: pending]'), fail(1, difference('Status')));
});

test('no claim reports zero comparisons, including unchecked free prose', () => {
  for (const text of ['', 'A tray is shown.', 'There are 13 items. The status is pending.']) {
    assert.deepEqual(checkNarration(fill, text), pass(0));
  }
});

test('each repeated claim is checked, in text order', () => {
  assert.deepEqual(checkNarration(fill, '[Count: 12] and [Count: 13]'), fail(2, difference('Count')));
  assert.deepEqual(checkNarration(fill, '[Status: pending] [Count: 13] [Date: 2026-11-16]'),
    fail(3, difference('Status'), difference('Count'), difference('Date')));
});

test('numbers, status, spaces and units use exact text', () => {
  for (const text of ['[Count: 12.0]', '[Count: 012]', '[Count: 12 items]', '[Count:  12]', '[Count: 12 ]']) {
    assert.deepEqual(checkNarration(fill, text), fail(1, difference('Count')));
  }
  assert.deepEqual(checkNarration(fill, '[Status: Ready]'), fail(1, difference('Status')));
  assert.deepEqual(checkNarration(fill, '[Date: tomorrow]'), fail(1, difference('Date')));
});

test('an unknown field fails, including a prototype name', () => {
  for (const field of ['Total', 'count', 'constructor', '__proto__']) {
    assert.deepEqual(checkNarration(fill, `[${field}: 12]`), fail(1, unknown(field)));
  }
});

test('an absent date or fact cannot match a claim', () => {
  const empty = structuredClone(fill);
  delete empty.data.date;
  delete empty.data.facts;
  assert.deepEqual(checkNarration(empty, '[Date: 2026-11-15] [Count: 12]'),
    fail(2, unknown('Date'), unknown('Count')));
});

test('a custom date label replaces the default label', () => {
  const custom = structuredClone(fill);
  custom.data.date_label = 'Checked on';
  assert.deepEqual(checkNarration(custom, '[Checked on: 2026-11-15]'), pass(1));
  assert.deepEqual(checkNarration(custom, '[Date: 2026-11-15]'), fail(1, unknown('Date')));
});

test('a malformed claim fails instead of being skipped', () => {
  for (const text of ['[Count: 12', 'Count: 12]', '[Count=12]', '[Count:12]', '[Count: ]',
    '[: 12]', '[Count:\n12]', '[Count: [12]']) {
    assert.equal(checkNarration(fill, text).ok, false, text);
    assert.deepEqual(checkNarration(fill, text).errors[0], syntax, text);
  }
  assert.deepEqual(checkNarration(fill, '[Count=12] [Status: ready]'), fail(1, syntax));
  assert.deepEqual(checkNarration(fill, 'Count: 12] [Status: ready]'), fail(1, syntax));
});

test('duplicate fact labels and date label collisions fail before comparison', () => {
  for (const label of ['Count', 'Date']) {
    const duplicate = structuredClone(fill);
    duplicate.data.facts[1].data.label = label;
    assert.deepEqual(checkNarration(duplicate, '[Count: 12]'),
      fail(0, { field: label, message: 'card labels must be unique' }));
  }
});

test('labels with unsupported syntax fail before comparison', () => {
  for (const label of ['', 'Bad: label', '[Count]', 'Count\n']) {
    const invalid = structuredClone(fill);
    invalid.data.facts[0].data.label = label;
    assert.deepEqual(checkNarration(invalid, ''), fail(0, { field: 'data.facts.0.data.label',
      message: 'must be a nonempty label with no colon, square bracket or line break' }));
  }
});

test('invalid fills and nontext narration fail with a field name', () => {
  for (const invalid of [null, {}, { component: 'fact' }]) {
    assert.deepEqual(checkNarration(invalid, ''),
      fail(0, { field: 'component', message: 'must be a card' }));
  }
  const invalid = structuredClone(fill);
  invalid.data.date = '2026-02-30';
  assert.deepEqual(checkNarration(invalid, ''),
    fail(0, { field: 'data.date', message: 'must be a date as YYYY-MM-DD' }));
  for (const narration of [null, {}, 12]) {
    assert.deepEqual(checkNarration(fill, narration),
      fail(0, { field: 'narration', message: 'must be a string' }));
  }
});

test('the title and summary do not supply claim values', () => {
  const changed = structuredClone(fill);
  changed.data.title = '[Count: 13]';
  changed.data.summary = '[Status: pending]';
  assert.deepEqual(checkNarration(changed, '[Count: 12] [Status: ready]'), pass(2));
});

test('markup stays data and the check does not change the fill', () => {
  const data = structuredClone(fill);
  const markup = '<img src=x onerror="throw 1">';
  data.data.facts[1].data.value = markup;
  const before = JSON.stringify(data);
  const narration = `[Status: ${markup}]`;
  const freeze = (value) => {
    for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
    Object.freeze(value);
  };
  freeze(data);
  assert.deepEqual(checkNarration(data, narration), pass(1));
  assert.deepEqual(checkNarration(data, narration), pass(1));
  assert.equal(JSON.stringify(data), before);
});
