// Tests of the action path. Each expected result comes from principle 4 of the constitution:
// the kit shows an action as done only after the receipt of the API comes back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActionState, bindingErrors } from '../src/actions/action.js';

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
  const LIST = ['editable must map each field name to its label'];
  assert.deepEqual(bindingErrors({ tool: 'library.renew', editable: { shelf: 'Shelf code', note_text: 'Note' } }), []);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', editable: 'shelf' }), LIST);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', editable: ['shelf'] }), LIST);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', editable: { 'Shelf Code': 'Shelf code' } }), LIST);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', editable: { shelf: '' } }), LIST);
  assert.deepEqual(bindingErrors({ tool: 'library.renew', editable: { shelf: 'S'.repeat(81) } }), LIST);
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
      bindingErrors({ tool: 'library.renew', label: long, title: long, editable: { shelf: long } })];
    action.receipt({ id: request.id, ok: false });
    action.reopen(long);
    results.push([...action.message].length);
    console.log(JSON.stringify(results));`;
  const run = spawnSync(process.execPath, ['--max-old-space-size=64', '--input-type=module', '-e', code], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr.slice(0, 400));
  assert.deepEqual(JSON.parse(run.stdout), [false, 'pending', ['the label must be a text of 1 to 80 characters',
    'the title must be a text of 1 to 120 characters', 'editable must map each field name to its label'], 200]);
});
