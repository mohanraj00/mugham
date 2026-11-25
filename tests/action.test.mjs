// Tests of the action path. Each expected result comes from principle 4 of the constitution:
// the kit shows an action as done only after the receipt of the API comes back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActionState, bindingErrors, deliverReceipt } from '../src/actions/action.js';

test('a binding needs a valid tool name and scalar arguments', () => {
  assert.deepEqual(bindingErrors({ tool: 'library.renew', arguments: { loan_id: 'L-0001' } }), []);
  assert.deepEqual(bindingErrors({ tool: 'Run Anything' }), ['the tool name is not valid']);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', arguments: { loan: { id: 1 } } }),
    ['each argument must be a string, a number or true or false']);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', label: 'Renew' }), []);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', label: '' }), ['the label must be a text of 1 to 80 characters']);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', label: 'R'.repeat(81) }), ['the label must be a text of 1 to 80 characters']);
  const TITLE = ['the title must be a text of 1 to 120 characters'];
  assert.deepEqual(bindingErrors({ tool: 'library.renew', title: 'Loan details' }), []);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', title: '' }), TITLE);
  // The editable-form contract accepts a title of 120 characters, so the binding accepts the same limit.
  assert.deepEqual(bindingErrors({ tool: 'library.renew', title: 'T'.repeat(120) }), []);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', title: 'T'.repeat(121) }), TITLE);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', title: 7 }), TITLE);
  const DESCRIPTION = ['the description must be a text of 1 to 200 characters'];
  assert.deepEqual(bindingErrors({ tool: 'library.renew', description: 'D'.repeat(200) }), []);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', description: '' }), DESCRIPTION);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', description: 'D'.repeat(201) }), DESCRIPTION);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', description: 7 }), DESCRIPTION);
  const LIST = ['editable must map each field name to its label'];
  assert.deepEqual(bindingErrors({ tool: 'library.renew', editable: { shelf: 'Shelf code', note_text: 'Note' } }), []);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', editable: 'shelf' }), LIST);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', editable: ['shelf'] }), LIST);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', editable: { 'Shelf Code': 'Shelf code' } }), LIST);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', editable: { shelf: '' } }), LIST);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', editable: { shelf: 'S'.repeat(81) } }), LIST);
  // A form card has up to 10 sections of 40 fields, so the binding accepts 400 editable names and no more.
  const names = (count) => Object.fromEntries(Array.from({ length: count }, (_, index) => [`field_${index}`, `Field ${index}`]));
  assert.deepEqual(bindingErrors({ tool: 'library.renew', editable: names(400) }), []);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', editable: names(401) }), LIST);
});

test('an extra value needs a name that the binding gives as editable', () => {
  const action = new ActionState();
  action.bind({ tool: 'library.update_loan', editable: { shelf: 'Shelf code' } });
  assert.deepEqual({ ...action.editable }, { shelf: 'Shelf code' });
  assert.equal(action.start({ constructor: 'C-2' }), null);
  assert.equal(action.start({ shelf: 'C-2', approved: true }), null);
  assert.equal(action.state, 'default');
  assert.deepEqual({ ...action.start({ shelf: 'C-2' }).arguments }, { shelf: 'C-2' });
  const plain = new ActionState();
  plain.bind({ tool: 'library.update_loan' });
  assert.deepEqual({ ...plain.editable }, {});
  assert.equal(plain.start({ shelf: 'C-2' }), null);
});

test('the label comes from the binding', () => {
  const action = new ActionState();
  assert.equal(action.label, null);
  action.bind({ tool: 'library.renew' });
  assert.equal(action.label, '');
  action.bind({ tool: 'library.renew', label: 'Renew' });
  assert.equal(action.label, 'Renew');
});

test('the state and the message can only be read', () => {
  const action = new ActionState();
  action.bind({ tool: 'library.renew' });
  assert.throws(() => { action.state = 'done'; }, TypeError);
  assert.throws(() => { action.message = 'Accepted'; }, TypeError);
  assert.equal(action.state, 'default');
  assert.equal(action.message, '');
});

test('a value from a fill cannot change a bound argument', () => {
  // A form would show the editable value, but the request would carry the bound value. Thus the binding is refused.
  assert.deepEqual(bindingErrors({ tool: 'library.update_loan', arguments: { loan_id: 'L-0001' },
    editable: { loan_id: 'Loan', shelf: 'Shelf code' } }), ['a bound argument cannot be editable: loan_id']);
  const action = new ActionState();
  action.bind({ tool: 'library.update_loan', arguments: { loan_id: 'L-0001' }, editable: { shelf: 'Shelf code' } });
  assert.equal(action.start({ loan_id: 'L-9999', shelf: 'C-2' }), null);
  assert.deepEqual({ ...action.start({ shelf: 'C-2' }).arguments }, { loan_id: 'L-0001', shelf: 'C-2' });
});

test('the action is done only after the receipt with the same id', () => {
  const action = new ActionState();
  assert.equal(action.start(), null);
  action.bind({ tool: 'library.renew' });
  const request = action.start();
  assert.equal(action.state, 'pending');
  assert.equal(action.start(), null);
  assert.equal(action.receipt({ id: 'other', ok: true }), false);
  assert.equal(action.receipt({ id: request.id, ok: 'yes' }), false);
  assert.equal(action.receipt({ id: request.id, ok: true, message: 'x'.repeat(201) }), false);
  assert.equal(action.state, 'pending');
  assert.equal(action.receipt({ id: request.id, ok: true, message: 'Renewed.' }), true);
  assert.equal(action.state, 'done');
  assert.equal(action.receipt({ id: request.id, ok: false }), false);
  assert.equal(action.state, 'done');
});

test('a binding of null disables the action', () => {
  const action = new ActionState();
  action.bind({ tool: 'library.renew' });
  action.start();
  action.bind(null);
  assert.equal(action.state, 'disabled');
  assert.equal(action.start(), null);
});

test('only a done or an error action can reopen', () => {
  const action = new ActionState();
  action.bind({ tool: 'library.renew' });
  assert.equal(action.reopen(), false);
  const request = action.start();
  assert.equal(action.reopen(), false);
  assert.equal(action.state, 'pending');
  action.receipt({ id: request.id, ok: true });
  assert.equal(action.reopen('Save again.'), true);
  assert.equal(action.state, 'default');
  assert.equal(action.message, 'Save again.');
  assert.notEqual(action.start(), null);
});

test('the title comes from the binding', () => {
  const action = new ActionState();
  assert.equal(action.title, null);
  action.bind({ tool: 'library.update_loan' });
  assert.equal(action.title, '');
  action.bind({ tool: 'library.update_loan', title: 'Loan details' });
  assert.equal(action.title, 'Loan details');
});

// An array of the code points of a text of 5,000,000 characters needs about 140 MB here. The heap limit is 64 MB.
// Thus each length check must count the characters with no copy of the text.
test('a very long text gets its error with no copy of the text', async () => {
  const { spawnSync } = await import('node:child_process');
  const code = `
    const { ActionState, bindingErrors } = await import(${JSON.stringify(new URL('../src/actions/action.js', import.meta.url).href)});
    const long = '\\u{1F600}'.repeat(5000000);
    const action = new ActionState();
    action.bind({ tool: 'library.renew' });
    const request = action.start();
    const results = [action.receipt({ id: request.id, ok: true, message: long }), action.state,
      bindingErrors({ tool: 'library.renew', label: long, title: long, description: long, editable: { shelf: long } })];
    action.receipt({ id: request.id, ok: false });
    action.reopen(long);
    results.push([...action.message].length);
    console.log(JSON.stringify(results));`;
  const run = spawnSync(process.execPath, ['--max-old-space-size=64', '--input-type=module', '-e', code], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr.slice(0, 400));
  assert.deepEqual(JSON.parse(run.stdout), [false, 'pending', ['the label must be a text of 1 to 80 characters',
    'the title must be a text of 1 to 120 characters', 'the description must be a text of 1 to 200 characters',
    'editable must map each field name to its label'], 200]);
});

test('the description comes from the binding', () => {
  const action = new ActionState();
  assert.equal(action.description, null);
  action.bind({ tool: 'library.renew' });
  assert.equal(action.description, '');
  action.bind({ tool: 'library.renew', description: 'Renews the loan of Rivers and deltas.' });
  assert.equal(action.description, 'Renews the loan of Rivers and deltas.');
});

// The confirm step and the receipt reference. The expected results come from catalog/README.md#actions.
const CONFIRM = ['confirm must have only a message of 1 to 200 characters and a label of 1 to 40 characters'];

test('a binding can give a confirm step with a message and a label', () => {
  assert.deepEqual(bindingErrors({ tool: 'library.cancel', confirm: { message: 'Cancel the loan L-0001?', label: 'Cancel the loan' } }), []);
  assert.deepEqual(bindingErrors({ tool: 'library.cancel', confirm: { message: 'M'.repeat(200), label: 'L'.repeat(40) } }), []);
  assert.deepEqual(bindingErrors({ tool: 'library.cancel', confirm: true }), CONFIRM);
  assert.deepEqual(bindingErrors({ tool: 'library.cancel', confirm: null }), CONFIRM);
  assert.deepEqual(bindingErrors({ tool: 'library.cancel', confirm: { message: 'Cancel?' } }), CONFIRM);
  assert.deepEqual(bindingErrors({ tool: 'library.cancel', confirm: { message: '', label: 'Yes' } }), CONFIRM);
  assert.deepEqual(bindingErrors({ tool: 'library.cancel', confirm: { message: 'M'.repeat(201), label: 'Yes' } }), CONFIRM);
  assert.deepEqual(bindingErrors({ tool: 'library.cancel', confirm: { message: 'Cancel?', label: 'L'.repeat(41) } }), CONFIRM);
  assert.deepEqual(bindingErrors({ tool: 'library.cancel', confirm: { message: 'Cancel?', label: 'Yes', tool: 'shell.run' } }), CONFIRM);
});

test('an action with a confirm step starts only after a person confirms', () => {
  const action = new ActionState();
  assert.equal(action.confirm, null);
  action.bind({ tool: 'library.renew' });
  assert.equal(action.confirm, null);
  action.bind({ tool: 'library.cancel', confirm: { message: 'Cancel the loan L-0001?', label: 'Cancel the loan' } });
  assert.deepEqual({ ...action.confirm }, { message: 'Cancel the loan L-0001?', label: 'Cancel the loan' });
  assert.throws(() => { action.confirm.label = 'Run'; }, TypeError);
  assert.equal(action.start(), null);
  assert.deepEqual([action.state, action.key, action.message],
    ['error', '', 'The request did not leave this device. Confirm the action and try again.']);
  const request = action.start({}, true);
  assert.equal(request.tool, 'library.cancel');
  assert.equal(action.state, 'pending');
});

test('a receipt can carry a reference as text with a length limit', () => {
  const action = new ActionState();
  assert.equal(action.reference, '');
  action.bind({ tool: 'library.renew' });
  let request = action.start();
  assert.equal(action.receipt({ id: request.id, ok: true, reference: 'R'.repeat(81) }), false);
  assert.equal(action.receipt({ id: request.id, ok: true, reference: 7 }), false);
  assert.equal(action.state, 'pending');
  assert.equal(action.reference, '');
  const markup = '<img src=x onerror=alert(1)>';
  assert.equal(action.receipt({ id: request.id, ok: true, reference: markup }), true);
  assert.equal(action.reference, markup);
  action.reopen();
  assert.equal(action.reference, '');
  request = action.start();
  assert.equal(action.receipt({ id: request.id, ok: true, reference: 'R'.repeat(80) }), true);
  assert.equal(action.reference, 'R'.repeat(80));
  action.reopen();
  request = action.start();
  assert.equal(action.receipt({ id: request.id, ok: false }), true);
  assert.equal(action.reference, '');
});

// Typed edits (catalog/README.md, "Typed edits"). Principle 4: each form edit records its type.
const TYPED = { tool: 'library.update_loan', editable: { due_date: 'Due date', note: 'Note' }, typed: ['due_date'],
  editor: { type: 'human', id: 'person-ana' } };
const TIME = '2026-11-15T09:30:00.000Z';

test('a typed binding names editable fields and a person as the editor', () => {
  assert.deepEqual(bindingErrors(TYPED), []);
  assert.deepEqual(bindingErrors({ tool: 'library.update_loan', editable: { note: 'Note' }, typed: [] }), []);
  const NAMES = ['typed must list names that editable gives, each one time'];
  assert.deepEqual(bindingErrors({ ...TYPED, typed: 'due_date' }), NAMES);
  assert.deepEqual(bindingErrors({ ...TYPED, typed: ['shelf'] }), NAMES);
  assert.deepEqual(bindingErrors({ ...TYPED, typed: ['due_date', 'due_date'] }), NAMES);
  const EDITOR = ['editor must be a person: { type: human, id } with an id of 1 to 128 characters'];
  assert.deepEqual(bindingErrors({ ...TYPED, editor: undefined }), EDITOR);
  assert.deepEqual(bindingErrors({ ...TYPED, editor: { type: 'agent', id: 'agent-check' } }), EDITOR);
  assert.deepEqual(bindingErrors({ ...TYPED, editor: { type: 'human', id: '' } }), EDITOR);
  assert.deepEqual(bindingErrors({ ...TYPED, editor: { type: 'human', id: 'p'.repeat(129) } }), EDITOR);
  assert.deepEqual(bindingErrors({ ...TYPED, editor: { type: 'human', id: 'person-ana', role: 'admin' } }), EDITOR);
  assert.deepEqual(bindingErrors({ ...TYPED, editor: { type: 'human', id: 'p'.repeat(128) } }), []);
});

test('the request of a typed binding has each edit with its type, the values, the actor and the time', () => {
  for (const type of ['judgment', 'correction', 'override']) {
    const action = new ActionState();
    action.bind(TYPED);
    const request = action.start({ due_date: '2026-12-08', note: 'x' }, false,
      [{ field: 'due_date', type, old_value: '2026-12-01', time: TIME }]);
    assert.deepEqual(JSON.parse(JSON.stringify(request.edits)), [{ field: 'due_date', type, old_value: '2026-12-01',
      new_value: '2026-12-08', actor: { type: 'human', id: 'person-ana' }, time: TIME }]);
    assert.ok(Object.isFrozen(request.edits) && Object.isFrozen(request.edits[0]) && Object.isFrozen(request.edits[0].actor));
  }
  const action = new ActionState();
  action.bind(TYPED);
  assert.deepEqual(action.start({ due_date: '2026-12-01' }, false, []).edits, []);
  const plain = new ActionState();
  plain.bind({ tool: 'library.update_loan', editable: { note: 'Note' } });
  assert.equal('edits' in plain.start({ note: 'x' }), false);
});

test('a request with a bad edit is refused', () => {
  const edit = { field: 'due_date', type: 'judgment', old_value: '2026-12-01', time: TIME };
  const bad = [
    [{ ...edit, type: undefined }],
    [{ ...edit, type: 'guess' }],
    [{ ...edit, field: 'note' }],
    [{ ...edit, old_value: '2026-12-08' }],
    [{ ...edit, old_value: { day: 1 } }],
    [{ ...edit, time: 'yesterday' }],
    [{ ...edit, actor: { type: 'agent', id: 'agent-check' } }],
    [edit, edit],
    'due_date',
  ];
  for (const edits of bad) {
    const action = new ActionState();
    action.bind(TYPED);
    assert.equal(action.start({ due_date: '2026-12-08' }, false, edits), null, JSON.stringify(edits));
    assert.equal(action.state, 'default');
  }
  // An edit needs a value in the request. A typed binding needs an edits list.
  const missing = new ActionState();
  missing.bind(TYPED);
  assert.equal(missing.start({ note: 'x' }, false, [edit]), null);
  assert.equal(missing.start({ due_date: '2026-12-08' }), null);
  const plain = new ActionState();
  plain.bind({ tool: 'library.update_loan', editable: { note: 'Note' } });
  assert.equal(plain.start({ note: 'x' }, false, [{ ...edit, field: 'note' }]), null);
});

test('the typed names and the editor come from the binding', () => {
  const action = new ActionState();
  assert.equal(action.typed, null);
  assert.equal(action.editor, null);
  action.bind(TYPED);
  assert.deepEqual([...action.typed], ['due_date']);
  assert.deepEqual({ ...action.editor }, { type: 'human', id: 'person-ana' });
  assert.ok(Object.isFrozen(action.typed) && Object.isFrozen(action.editor));
  action.bind({ tool: 'library.renew' });
  assert.deepEqual([...action.typed], []);
  assert.equal(action.editor, null);
});

// The expected results of the tests below come from "The request" and "The action elements" in
// docs/contracts/offline-queue.md.
const pendingAction = () => {
  const action = new ActionState();
  action.bind({ tool: 'tool.reserve', arguments: { tool_id: 'T-01' } });
  return { action, request: action.start() };
};

test('receipt delivery rejects a foreign id and a late receipt after a cancel', async () => {
  const { action, request } = pendingAction();
  const element = { action, receipt: (value) => action.receipt(value), noReceipt: (id) => action.noReceipt(id) };
  await deliverReceipt(element, request, () => ({ id: 'other', key: request.key, ok: true }));
  assert.deepEqual([action.state, action.wait], ['pending', 'stalled']);
  const retry = action.retry();
  assert.equal(retry.key, request.key);
  assert.notEqual(retry.id, request.id);
  let answer;
  const late = deliverReceipt(element, retry, () => new Promise((resolve) => { answer = resolve; }));
  assert.equal(action.noReceipt(retry.id), true);
  assert.equal(action.cancel(), true);
  const next = action.start();
  answer({ id: retry.id, key: retry.key, ok: true });
  await late;
  assert.deepEqual([action.state, action.wait, action.key], ['pending', 'sent', next.key]);
});

test('an action has one key for all its tries, and each try has a new id', () => {
  const { action, request } = pendingAction();
  assert.ok(typeof request.key === 'string' && request.key.length > 0 && request.key !== request.id);
  assert.deepEqual([action.state, action.wait, action.key], ['pending', 'sent', request.key]);
  // A try in flight has no retry and no cancel.
  assert.equal(action.retry(), null);
  assert.equal(action.cancel(), false);
  assert.equal(action.hold({ key: request.key, wait: 'stalled' }), true);
  assert.deepEqual([action.state, action.wait, action.message], ['pending', 'stalled', 'No receipt came back.']);
  const again = action.retry();
  assert.deepEqual([again.key, again.tool, again.arguments], [request.key, request.tool, request.arguments]);
  assert.notEqual(again.id, request.id);
  assert.ok(Object.isFrozen(again));
  assert.deepEqual([action.state, action.wait, action.message], ['pending', 'sent', '']);
  // A new action after the receipt has a new key.
  assert.equal(action.receipt({ id: again.id, ok: false }), true);
  assert.deepEqual([action.wait, action.key], ['', '']);
  assert.notEqual(action.start().key, request.key);
});

test('a detail of the pending state needs the key of the action and never changes the state to done', () => {
  const { action, request } = pendingAction();
  for (const update of [null, 'queued', { wait: 'queued' }, { key: 'other', wait: 'queued' }, { key: request.key, wait: 'done' },
    { key: request.key, wait: 'queued', tries: -1 }, { key: request.key, wait: 'queued', message: 7 }]) {
    assert.equal(action.hold(update), false, JSON.stringify(update));
  }
  assert.deepEqual([action.state, action.wait, action.message], ['pending', 'sent', '']);
  assert.equal(action.hold({ key: request.key, wait: 'queued', tries: 0 }), true);
  assert.deepEqual([action.state, action.wait, action.message], ['pending', 'queued', 'Waiting for a connection.']);
  assert.equal(action.hold({ key: request.key, wait: 'queued', message: 'Waiting for an earlier action.' }), true);
  assert.equal(action.message, 'Waiting for an earlier action.');
  assert.equal(action.hold({ key: request.key, wait: 'sent', tries: 1 }), true);
  assert.deepEqual([action.state, action.wait, action.message], ['pending', 'sent', '']);
  const idle = new ActionState();
  assert.equal(idle.hold({ key: request.key, wait: 'queued' }), false);
});

test('a cancel of a waiting action goes back to the start state and says if a try left the device', () => {
  const unsent = pendingAction();
  unsent.action.hold({ key: unsent.request.key, wait: 'queued', tries: 0 });
  assert.equal(unsent.action.cancel(), true);
  assert.deepEqual([unsent.action.state, unsent.action.message], ['default', 'Canceled. The request did not leave this device.']);
  const sent = pendingAction();
  sent.action.hold({ key: sent.request.key, wait: 'stalled' });
  assert.equal(sent.action.cancel(), true);
  assert.deepEqual([sent.action.state, sent.action.message],
    ['default', 'Canceled. No receipt came back, so it is possible that the service did the action.']);
  // A receipt after the cancel does nothing. The action never shows done without a pending request.
  assert.equal(sent.action.receipt({ id: sent.request.id, ok: true }), false);
  assert.equal(sent.action.receipt({ key: sent.request.key, ok: true }), false);
  assert.equal(sent.action.state, 'default');
  assert.equal(sent.action.cancel(), false);
});

test('a receipt needs a matching key or id, and both must match when present', () => {
  const first = pendingAction();
  first.action.hold({ key: first.request.key, wait: 'stalled' });
  const second = first.action.retry();
  // The receipt of the first try comes back after the retry.
  assert.equal(first.action.receipt({ id: 'other', ok: true }), false);
  assert.equal(first.action.receipt({ id: first.request.id, ok: true, reference: 'B-0001' }), true);
  assert.deepEqual([first.action.state, first.action.reference], ['done', 'B-0001']);
  assert.equal(first.action.receipt({ id: second.id, ok: false }), false);
  const keyed = pendingAction();
  assert.equal(keyed.action.receipt({ id: keyed.request.id, key: 'other', ok: true }), false);
  assert.equal(keyed.action.receipt({ id: 'other', key: keyed.request.key, ok: true }), false);
  assert.equal(keyed.action.receipt({ id: undefined, key: keyed.request.key, ok: true }), false);
  assert.equal(keyed.action.receipt({ id: keyed.request.id, key: undefined, ok: true }), false);
  assert.equal(keyed.action.receipt({ key: keyed.request.key, ok: false, message: 'The tool is reserved.' }), true);
  assert.deepEqual([keyed.action.state, keyed.action.message], ['error', 'The tool is reserved.']);
});

for (const field of ['message', 'reference']) {
  test(`an action refuses a receipt with a null ${field}`, () => {
    const { action, request } = pendingAction();
    assert.equal(action.receipt({ id: request.id, ok: true, [field]: null }), false);
    assert.equal(action.state, 'pending');
    assert.equal(action.receipt({ id: request.id, ok: true }), true);
  });
}
