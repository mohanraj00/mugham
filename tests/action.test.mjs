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
  const action = new ActionState();
  action.bind({ tool: 'library.update_loan', arguments: { loan_id: 'L-0001' } });
  const request = action.start({ loan_id: 'L-9999', shelf: 'C-2' });
  assert.deepEqual({ ...request.arguments }, { loan_id: 'L-0001', shelf: 'C-2' });
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
