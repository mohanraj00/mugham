// Tests of the offline queue. Each expected result comes from docs/contracts/offline-queue.md: a queued action
// is pending and never done, the queue sends each action one time and in order with one key, a rejection shows
// on its action, and the store holds no secret. The data is synthetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActionQueue, indexedDbStore, memoryStore, openQueue, queueFill } from '../src/offline/queue.js';

const RECORD_KEYS = ['arguments', 'key', 'label', 'message', 'order', 'owner', 'queued', 'state', 'tool', 'tries'];
const sleep = (ms = 0) => new Promise((done) => setTimeout(done, ms));
async function until(condition, what) {
  for (let i = 0; i < 200; i += 1) {
    if (await condition()) return;
    await sleep(5);
  }
  assert.fail('timeout: ' + what);
}

const request = (toolId = 'T-01', extra = {}) => ({ id: crypto.randomUUID(), key: crypto.randomUUID(), tool: 'tool.reserve',
  arguments: { tool_id: toolId }, ...extra });

// A page part that waits for a receipt. It records each detail that the queue gives.
const element = (label = 'Reserve Ladder') => ({ action: { label }, holds: [], canceled: [],
  hold(update) { this.holds.push(update); return true; }, cancel(key) { this.canceled.push(key); return true; } });

// A device with a network switch, and a service that records each request that it gets.
function device({ answer, ...options } = {}) {
  const net = { online: true, events: new EventTarget(), sent: [], store: options.store ?? memoryStore() };
  net.go = (online) => {
    net.online = online;
    net.events.dispatchEvent(new Event(online ? 'online' : 'offline'));
  };
  net.send = async (value, context) => {
    net.sent.push(value);
    return (answer ?? (() => ({ ok: true, reference: 'R-' + net.sent.length })))(value, context, net.sent.length);
  };
  net.open = (more = {}) => openQueue({ send: net.send, store: net.store, online: () => net.online, events: net.events,
    locks: null, timeout: 200, ...options, ...more });
  return net;
}

test('an action made offline is queued and pending, and the queue sends nothing', async () => {
  const net = device();
  net.online = false;
  const queue = await net.open();
  const button = element();
  const first = request();
  let receipt = 'none';
  queue.perform(first, button).then((value) => { receipt = value; });
  await until(() => queue.entries.length === 1, 'the entry');
  await sleep(20);
  assert.equal(net.sent.length, 0);
  assert.equal(receipt, 'none');
  assert.deepEqual(queue.entries.map((entry) => [entry.key, entry.tool, entry.label, entry.state, entry.tries, entry.message]),
    [[first.key, 'tool.reserve', 'Reserve Ladder', 'queued', 0, 'Waiting for a connection.']]);
  assert.deepEqual(button.holds.at(-1), { key: first.key, wait: 'queued', tries: 0, message: 'Waiting for a connection.' });
  assert.ok(!queue.entries.some((entry) => entry.state === 'done'));
  assert.equal((await net.store.all()).length, 1);
  queue.close();
});

test('after the device reconnects, the queue sends each action one time, in order, with its key', async () => {
  const net = device();
  net.online = false;
  const queue = await net.open();
  const requests = [request('T-01'), request('T-02'), request('T-03')];
  const receipts = requests.map((item) => queue.perform(item, element()));
  await until(() => queue.entries.length === 3, 'three entries');
  net.go(true);
  const got = await Promise.all(receipts);
  assert.deepEqual(net.sent.map((item) => item.arguments.tool_id), ['T-01', 'T-02', 'T-03']);
  assert.deepEqual(net.sent.map((item) => item.key), requests.map((item) => item.key));
  assert.deepEqual(got.map((item) => [item.ok, item.key, item.reference]), requests.map((item, index) => [true, item.key, 'R-' + (index + 1)]));
  assert.deepEqual(queue.entries, []);
  assert.deepEqual(await net.store.all(), []);
  queue.close();
});

test('the queue sends one action at a time', async () => {
  let flying = 0;
  let most = 0;
  const net = device({ answer: async () => {
    flying += 1;
    most = Math.max(most, flying);
    await sleep(10);
    flying -= 1;
    return { ok: true };
  } });
  const queue = await net.open();
  await Promise.all([queue.perform(request('T-01')), queue.perform(request('T-02')), queue.perform(request('T-03'))]);
  assert.equal(most, 1);
  assert.deepEqual(net.sent.map((item) => item.arguments.tool_id), ['T-01', 'T-02', 'T-03']);
  queue.close();
});

test('two online events and a flush during a try send no duplicate', async () => {
  const net = device({ answer: async () => {
    await sleep(20);
    return { ok: true };
  } });
  net.online = false;
  const queue = await net.open();
  const receipts = [queue.perform(request('T-01')), queue.perform(request('T-02'))];
  await until(() => queue.entries.length === 2, 'two entries');
  net.go(true);
  net.go(true);
  queue.flush();
  await sleep(5);
  queue.flush();
  await Promise.all(receipts);
  await queue.flush();
  assert.deepEqual(net.sent.map((item) => item.arguments.tool_id), ['T-01', 'T-02']);
  queue.close();
});

test('a try with no receipt stays pending as stalled, and a retry has the same key and a new id', async () => {
  const net = device({ answer: (value, context, count) => {
    if (count === 1) throw new Error('The connection closed.');
    return { ok: true, reference: 'R-9' };
  } });
  const queue = await net.open();
  const button = element();
  const first = request();
  let receipt = 'none';
  const promise = queue.perform(first, button).then((value) => { receipt = value; return value; });
  await until(() => queue.entries[0]?.state === 'stalled', 'the stalled state');
  assert.equal(receipt, 'none');
  assert.deepEqual(button.holds.at(-1), { key: first.key, wait: 'stalled', tries: 1, message: 'No receipt came back.' });
  // The queue stops at the action with no receipt. A later action waits behind it.
  const later = queue.perform(request('T-02'), element());
  await promise;
  await later;
  assert.equal(net.sent.length, 3);
  assert.deepEqual(net.sent.map((item) => item.key), [first.key, first.key, net.sent[2].key]);
  assert.notEqual(net.sent[0].id, net.sent[1].id);
  assert.deepEqual([receipt.ok, receipt.key, receipt.reference], [true, first.key, 'R-9']);
  queue.close();
});

test('a retry of a person sends a stalled action again and gives the same promise', async () => {
  let fail = true;
  const net = device({ answer: () => {
    if (fail) throw new Error('The connection closed.');
    return { ok: true };
  } });
  const queue = await net.open();
  const first = request();
  const promise = queue.perform(first, element());
  await until(() => queue.entries[0]?.state === 'stalled', 'the stalled state');
  fail = false;
  // The element sends a new request for the retry: the same key and a new id.
  const again = queue.perform({ ...first, id: crypto.randomUUID() }, element());
  assert.equal(again, promise);
  assert.equal((await promise).ok, true);
  assert.equal(net.sent.length, 2);
  assert.ok(net.sent.every((item) => item.key === first.key));
  queue.close();
});

test('a try with no answer in the time limit is stalled, and its signal aborts', async () => {
  let signal = null;
  const net = device({ timeout: 20, answer: (value, context) => {
    signal = context.signal;
    return new Promise(() => {});
  } });
  const queue = await net.open();
  queue.perform(request(), element());
  await until(() => queue.entries[0]?.state === 'stalled', 'the stalled state');
  assert.equal(signal.aborted, true);
  assert.equal(queue.entries[0].tries, 1);
  queue.close();
});

test('a result that is not a valid receipt is no receipt', async () => {
  for (const value of [null, 'ok', { ok: 'yes' }, { ok: true, id: 'other' }, { ok: true, key: 'other' },
    { ok: true, message: 'm'.repeat(201) }, { ok: true, reference: 'r'.repeat(81) }]) {
    const net = device({ answer: () => value });
    const queue = await net.open();
    queue.perform(request(), element());
    await until(() => queue.entries[0]?.state === 'stalled', 'the stalled state for ' + JSON.stringify(value));
    queue.close();
  }
});

test('a rejection of a queued action shows on that action', async () => {
  const net = device({ answer: (value) => (value.arguments.tool_id === 'T-02'
    ? { ok: false, message: 'The tool T-02 is already reserved.' } : { ok: true }) });
  net.online = false;
  const queue = await net.open();
  const receipts = [queue.perform(request('T-01'), element()), queue.perform(request('T-02'), element('Reserve Drill'))];
  await until(() => queue.entries.length === 2, 'two entries');
  net.go(true);
  const [done, rejected] = await Promise.all(receipts);
  assert.equal(done.ok, true);
  assert.deepEqual([rejected.ok, rejected.message], [false, 'The tool T-02 is already reserved.']);
  assert.deepEqual(queue.entries, []);
  queue.close();
});

test('after a reload, the queue takes the stored actions and sends them with the same key', async () => {
  const net = device();
  net.online = false;
  const before = await net.open();
  const first = request('T-01');
  const second = request('T-02');
  before.perform(first, element());
  before.perform(second, element('Reserve Drill'));
  await until(() => before.entries.length === 2, 'two entries');
  before.close();
  // A new queue on the same store is the page after a reload. It has no element for the stored actions.
  const changes = [];
  const after = await net.open({ send: async (value) => {
    net.sent.push(value);
    return value.arguments.tool_id === 'T-02' ? { ok: false, message: 'The tool T-02 is already reserved.' } : { ok: true };
  } });
  after.watch((entries, change) => changes.push(change));
  assert.deepEqual(after.entries.map((entry) => [entry.key, entry.label, entry.state]),
    [[first.key, 'Reserve Ladder', 'queued'], [second.key, 'Reserve Drill', 'queued']]);
  net.go(true);
  await until(() => net.sent.length === 2, 'two tries');
  await after.flush();
  assert.deepEqual(net.sent.map((item) => item.key), [first.key, second.key]);
  // The rejection of an action with no element stays until a person dismisses it.
  assert.deepEqual(after.entries.map((entry) => [entry.key, entry.state, entry.message]),
    [[second.key, 'rejected', 'The tool T-02 is already reserved.']]);
  assert.deepEqual(changes.filter(Boolean).map((change) => [change.key, change.receipt.ok]), [[first.key, true], [second.key, false]]);
  assert.equal(after.dismiss(first.key), false);
  assert.equal(after.dismiss(second.key), true);
  await until(async () => (await net.store.all()).length === 0, 'the empty store');
  after.close();
});

test('a cancel removes a waiting action, and the queue refuses a cancel of a try in flight', async () => {
  let release;
  const net = device({ answer: () => new Promise((done) => { release = () => done({ ok: true }); }) });
  net.online = false;
  const queue = await net.open();
  const button = element();
  const first = request();
  const promise = queue.perform(first, button);
  await until(() => queue.entries.length === 1, 'the entry');
  assert.equal(queue.cancel(first.key), true);
  assert.equal(await promise, null);
  assert.deepEqual(button.canceled, [first.key]);
  assert.deepEqual(queue.entries, []);
  await until(async () => (await net.store.all()).length === 0, 'the empty store');
  net.go(true);
  const second = request('T-02');
  const flying = queue.perform(second, element());
  await until(() => net.sent.length === 1, 'the try');
  assert.equal(queue.entries[0].state, 'sent');
  assert.equal(queue.cancel(second.key), false);
  assert.equal(queue.cancel('unknown'), false);
  release();
  assert.equal((await flying).ok, true);
  assert.equal(net.sent.length, 1);
  queue.close();
});

test('the store holds only the keys of the contract, and no secret of the request or of the send function', async () => {
  const net = device();
  net.online = false;
  const queue = await net.open({ send: async (value) => {
    // The application adds its credential here. The queue never gets it.
    net.sent.push({ ...value, headers: { authorization: 'Bearer synthetic-credential' } });
    return { ok: true };
  } });
  const first = request('T-01', { headers: { authorization: 'Bearer synthetic-credential' }, token: 'synthetic-credential',
    edits: [{ field: 'note', type: 'correction', old_value: 'a', new_value: 'b', actor: { type: 'human', id: 'person-1' }, time: '2026-11-24T10:00:00.000Z' }] });
  queue.perform(first, element());
  await until(() => queue.entries.length === 1, 'the entry');
  const [record] = await net.store.all();
  assert.deepEqual(Object.keys(record).sort(), [...RECORD_KEYS, 'edits'].sort());
  assert.deepEqual(record.arguments, { tool_id: 'T-01' });
  assert.ok(!JSON.stringify(await net.store.all()).includes('synthetic-credential'));
  net.go(true);
  await until(() => net.sent.length === 1, 'the try');
  await queue.flush();
  assert.ok(!JSON.stringify(await net.store.all()).includes('synthetic-credential'));
  queue.close();
});

test('the queue refuses an argument name that looks like a credential, online and offline', async () => {
  for (const online of [true, false]) {
    for (const name of ['token', 'api_key', 'apiKey', 'access_token', 'password', 'client_secret', 'authorization', 'session_cookie']) {
      const net = device();
      net.online = online;
      const queue = await net.open();
      const receipt = await queue.perform({ ...request(), arguments: { tool_id: 'T-01', [name]: 'synthetic-credential' } }, element());
      assert.deepEqual([receipt.ok, receipt.message], [false, `The queue does not keep the argument ${name}. Its name looks like a credential.`]);
      assert.equal(net.sent.length, 0);
      assert.deepEqual(await net.store.all(), []);
      queue.close();
    }
  }
});

test('the queue refuses a request that is not valid and keeps nothing', async () => {
  const net = device();
  const queue = await net.open();
  const cases = [
    [null, 'The request is not valid.'],
    [{ ...request(), id: '' }, 'The request has no valid id.'],
    [{ ...request(), key: 'a b' }, 'The request has no valid key.'],
    [{ ...request(), tool: 'Tool Reserve' }, 'The tool name is not valid.'],
    [{ ...request(), arguments: { nested: { a: 1 } } }, 'The arguments are not valid.'],
    [{ ...request(), edits: [{ actor: { nested: {} } }] }, 'The edits are not valid.'],
    [{ ...request(), arguments: { note: 'n'.repeat(200001) } }, 'The action is too large for the queue.'],
  ];
  for (const [value, message] of cases) {
    assert.deepEqual(await queue.perform(value, element()), { ok: false, message });
  }
  assert.equal(net.sent.length, 0);
  assert.deepEqual(await net.store.all(), []);
  queue.close();
});

test('the queue holds 100 actions at the maximum', async () => {
  const net = device();
  net.online = false;
  const queue = await net.open();
  for (let i = 0; i < 100; i += 1) queue.perform(request('T-' + i));
  const receipt = await queue.perform(request('T-100'));
  assert.deepEqual(receipt, { ok: false, message: 'The device holds 100 pending actions. Wait until the device sends them.' });
  assert.equal(queue.entries.length, 100);
  queue.close();
});

test('if the store cannot keep an action, the action is not done and the queue does not send it', async () => {
  const store = { all: async () => [], put: async () => { throw new Error('The disk is full.'); }, remove: async () => {} };
  const net = device({ store });
  const queue = await net.open();
  assert.deepEqual(await queue.perform(request(), element()), { ok: false, message: 'The device cannot keep the action.' });
  assert.equal(net.sent.length, 0);
  assert.deepEqual(queue.entries, []);
  queue.close();
});

test('if the store cannot give its records, the queue does not open', async () => {
  const store = { all: async () => { throw new Error('The database is blocked.'); }, put: async () => {}, remove: async () => {} };
  await assert.rejects(openQueue({ send: async () => ({ ok: true }), store, locks: null, events: null }), /blocked/);
  assert.throws(() => new ActionQueue({ store }), /send/);
  assert.throws(() => new ActionQueue({ send: async () => null, store: {} }), /store/);
  assert.throws(() => new ActionQueue({ send: async () => null, store, name: 'Not Valid' }), /name/);
  assert.throws(() => indexedDbStore('actions', null), /IndexedDB/);
});

// A small model of the Web Locks API: request holds a name until its callback settles, and query lists the held names.
function fakeLocks() {
  const held = new Map();
  const waiting = [];
  const grant = () => {
    for (const item of [...waiting]) {
      if (held.has(item.name)) continue;
      waiting.splice(waiting.indexOf(item), 1);
      held.set(item.name, true);
      Promise.resolve().then(item.work).then(item.done, item.fail).finally(() => {
        held.delete(item.name);
        grant();
      });
    }
  };
  return {
    request: (name, work) => new Promise((done, fail) => {
      waiting.push({ name, work, done, fail });
      grant();
    }),
    query: async () => ({ held: [...held.keys()].map((name) => ({ name })) }),
  };
}

test('with locks, a queue takes only the records of an owner that is not live', async () => {
  const locks = fakeLocks();
  const net = device();
  net.online = false;
  const one = await net.open({ locks });
  const first = request('T-01');
  one.perform(first, element());
  await until(() => one.entries.length === 1, 'the entry');
  // A second page is open at the same time. It does not take the record of the first page.
  const two = await net.open({ locks });
  assert.deepEqual(two.entries, []);
  net.go(true);
  await until(() => net.sent.length === 1, 'the try of the first page');
  await Promise.all([one.flush(), two.flush()]);
  assert.equal(net.sent.length, 1);
  // The first page closes with a waiting record. Then the second page takes it.
  net.online = false;
  const second = request('T-02');
  one.perform(second, element());
  await until(() => one.entries.length === 1, 'the second entry');
  one.close();
  await sleep(5);
  net.go(true);
  await until(() => net.sent.length === 2, 'the try of the second page');
  await two.flush();
  assert.deepEqual(net.sent.map((item) => item.key), [first.key, second.key]);
  two.close();
});

test('listen connects the cancel event and the steps of the queue component', async () => {
  let release;
  const net = device({ answer: () => new Promise((done) => { release = () => done({ ok: true }); }) });
  net.online = false;
  const queue = await net.open();
  const root = new EventTarget();
  const stop = queue.listen(root);
  const cancel = (key) => {
    const event = new Event('mu-action-cancel', { cancelable: true });
    event.detail = { key };
    return root.dispatchEvent(event);
  };
  const step = (key, name) => {
    const event = new Event('mu-queue-step');
    event.detail = { key, step: name };
    root.dispatchEvent(event);
  };
  const first = request('T-01');
  const waiting = queue.perform(first, element());
  await until(() => queue.entries.length === 1, 'the entry');
  // The queue has the action and cancels it, so the element can cancel too.
  assert.equal(cancel(first.key), true);
  assert.equal(await waiting, null);
  // The queue does not know this key. The element decides.
  assert.equal(cancel('unknown'), true);
  const second = request('T-02');
  const third = request('T-03');
  const flying = queue.perform(second, element());
  queue.perform(third, element());
  net.go(true);
  await until(() => net.sent.length === 1, 'the try');
  // A try is in flight. The queue prevents the cancel, so the element stays pending.
  assert.equal(cancel(second.key), false);
  step(third.key, 'cancel');
  assert.deepEqual(queue.entries.map((entry) => entry.key), [second.key]);
  release();
  assert.equal((await flying).ok, true);
  stop();
  queue.close();
});

test('queueFill gives a fill of the action-queue component', async () => {
  const net = device();
  net.online = false;
  const queue = await net.open({ now: () => Date.parse('2026-11-24T10:00:00.000Z') });
  const first = request();
  queue.perform(first, element());
  await until(() => queue.entries.length === 1, 'the entry');
  assert.deepEqual(queueFill('Pending actions', queue.entries), { component: 'action-queue', version: '0.1.0', data: { label: 'Pending actions',
    actions: [{ component: 'queued-action', version: '0.1.0', data: { key: first.key, label: 'Reserve Ladder', state: 'queued', tries: 0,
      queued: '2026-11-24T10:00:00.000Z', message: 'Waiting for a connection.' } }] } });
  assert.deepEqual(queueFill('Pending actions', []), { component: 'action-queue', version: '0.1.0', data: { label: 'Pending actions', actions: [] } });
  queue.close();
});
