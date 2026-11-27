// Tests of the offline queue. Each expected result comes from docs/contracts/offline-queue.md: a queued action
// is pending and never done, the queue sends each action one time and in order with one key, a rejection shows
// on its action, and the store holds no secret. The data is synthetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActionQueue, indexedDbStore, memoryStore, openQueue, queueFill } from '../src/offline/queue.js';
import { richTextLinkSchemes, setRichTextLinkSchemes } from '../src/render/rich-text.js';

const RECORD_KEYS = ['arguments', 'key', 'label', 'message', 'order', 'owner', 'principal', 'queued', 'state', 'tool', 'tries'];
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
const fill = (component, data) => ({ component, version: '0.1.0', data });
const paragraph = (...content) => fill('rich-paragraph', { content });
const note = (...blocks) => fill('rich-text', { blocks });
const link = (url) => fill('rich-link', { text: 'Reading list', url });
const span = (text) => fill('rich-span', { text });
const edit = (old_value, new_value) => ({ field: 'note', type: 'correction', old_value, new_value,
  actor: { type: 'human', id: 'editor' }, time: '2026-11-25T12:00:00.000Z' });

function assertFrozenTree(value) {
  assert.ok(Object.isFrozen(value));
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === 'object') assertFrozenTree(child);
  }
}

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
  net.open = (more = {}) => openQueue({ send: net.send, principal: 'member-1', store: net.store, online: () => net.online, events: net.events,
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

test('the queue copies text lists and sends them after it opens again', async () => {
  const net = device();
  net.online = false;
  const queue = await net.open();
  for (const value of [[1, 'plant'], Array(1), Array(501).fill('Plant'), ['x'.repeat(81)]]) {
    const receipt = await queue.perform(request('T-01', { arguments: { plants: value } }));
    assert.deepEqual([receipt.ok, receipt.message], [false, 'The arguments are not valid.']);
  }
  const plants = ['Dune bell', 'Mist fern'];
  const edits = [{ field: 'plants', type: 'judgment', old_value: [], new_value: plants,
    actor: { type: 'human', id: 'gardener' }, time: '2026-11-25T12:00:00.000Z' }];
  const saved = request('T-01', { arguments: { plants }, edits });
  void queue.perform(saved);
  await until(async () => (await net.store.all()).length === 1, 'stored action');
  plants.reverse();
  assert.deepEqual(queue.entries[0].arguments.plants, ['Dune bell', 'Mist fern']);
  assert.ok(Object.isFrozen(queue.entries[0].arguments.plants));
  queue.close();
  const reopened = await net.open();
  net.go(true);
  await until(() => net.sent.length === 1, 'sent action');
  assert.equal(net.sent[0].key, saved.key);
  assert.deepEqual(net.sent[0].arguments.plants, ['Dune bell', 'Mist fern']);
  assert.deepEqual(net.sent[0].edits[0].old_value, []);
  assert.deepEqual(net.sent[0].edits[0].new_value, ['Dune bell', 'Mist fern']);
  reopened.close();
});

test('the queue stores and sends a numeric pair and its edit', async () => {
  const net = device();
  net.online = false;
  const queue = await net.open();
  const arguments_ = { price: [15, 30] };
  const edits = [{ field: 'price', type: 'correction', old_value: [10, 30], new_value: [15, 30],
    actor: { type: 'human', id: 'editor' }, time: '2026-11-25T12:00:00.000Z' }];
  const outcome = queue.perform(request('T-01', { arguments: arguments_, edits }));
  await until(() => queue.entries.length === 1, 'the entry');
  assert.deepEqual(queue.entries[0].arguments.price, [15, 30]);
  assert.ok(Object.isFrozen(queue.entries[0].arguments.price));
  assert.deepEqual((await net.store.all())[0].edits, edits);
  arguments_.price[0] = 30;
  edits[0].old_value[0] = 30;
  net.go(true);
  assert.equal((await outcome).ok, true);
  assert.deepEqual(net.sent[0].arguments.price, [15, 30]);
  assert.deepEqual(net.sent[0].edits[0].old_value, [10, 30]);
  queue.close();
});

test('the queue keeps a frozen copy of a rich text argument after the link policy changes', async (t) => {
  const schemes = richTextLinkSchemes();
  t.after(() => setRichTextLinkSchemes(schemes));
  setRichTextLinkSchemes(['https:', 'http:']);
  const net = device();
  net.online = false;
  const queue = await net.open();
  const original = note(paragraph(link('http://example.org/reading')));
  const save = request('T-01', { tool: 'note.save', arguments: { note: structuredClone(original) } });
  void queue.perform(save);
  await until(() => queue.entries.length === 1, 'the rich text save');
  save.arguments.note.data.blocks[0].data.content[0].data.text = 'A later edit.';
  assert.deepEqual(queue.entries[0].arguments.note, original);
  assertFrozenTree(queue.entries[0].arguments.note);
  assert.deepEqual((await net.store.all())[0].arguments.note, original);
  queue.close();

  setRichTextLinkSchemes(['https:']);
  const reopened = await net.open();
  assert.deepEqual(reopened.entries.map((entry) => entry.key), [save.key]);
  assert.deepEqual(reopened.entries[0].arguments.note, original);
  assertFrozenTree(reopened.entries[0].arguments.note);
  net.online = true;
  await reopened.flush();
  assert.equal(net.sent[0].key, save.key);
  assert.deepEqual(net.sent[0].arguments.note, original);
  assertFrozenTree(net.sent[0].arguments.note);
  reopened.close();
});

test('the queue keeps and sends a typed rich text edit after the link policy changes', async (t) => {
  const schemes = richTextLinkSchemes();
  t.after(() => setRichTextLinkSchemes(schemes));
  setRichTextLinkSchemes(['https:', 'http:']);
  const net = device();
  net.online = false;
  const queue = await net.open();
  const old = note(paragraph(link('http://example.org/old')));
  const next = note(paragraph(link('http://example.org/reading')));
  const expected = edit(old, next);
  const change = structuredClone(expected);
  const save = request('T-01', { tool: 'note.save', edits: [change] });
  void queue.perform(save);
  await until(() => queue.entries.length === 1, 'the typed rich text edit');
  change.old_value.data.blocks.length = 0;
  change.new_value.data.blocks.length = 0;
  assert.deepEqual((await net.store.all())[0].edits, [expected]);
  queue.close();

  setRichTextLinkSchemes(['https:']);
  const reopened = await net.open();
  assert.deepEqual(reopened.entries.map((entry) => entry.key), [save.key]);
  net.online = true;
  await reopened.flush();
  assert.deepEqual(net.sent[0].edits, [expected]);
  assertFrozenTree(net.sent[0].edits[0].old_value);
  assertFrozenTree(net.sent[0].edits[0].new_value);
  reopened.close();
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
  assert.deepEqual(await promise, { id: first.id, key: first.key, ok: true, message: '', reference: '' });
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
    { ok: true, id: undefined }, { ok: true, key: undefined },
    { ok: true, message: 'm'.repeat(201) }, { ok: true, reference: 'r'.repeat(81) }]) {
    const net = device({ answer: () => value });
    const queue = await net.open();
    queue.perform(request(), element());
    await until(() => queue.entries[0]?.state === 'stalled', 'the stalled state for ' + JSON.stringify(value));
    queue.close();
  }
});

test('null text in a receipt leaves the stored record pending', async (t) => {
  for (const field of ['message', 'reference']) {
    await t.test(field, async () => {
      const net = device({ answer: () => ({ ok: true, [field]: null }) });
      const queue = await net.open();
      const first = request();
      queue.perform(first, element());
      await until(() => net.sent.length === 1, 'the try');
      await queue.flush();
      assert.equal(queue.entries[0]?.state, 'stalled');
      assert.deepEqual((await net.store.all()).map((record) => [record.key, record.state]), [[first.key, 'stalled']]);
      queue.close();
    });
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
  // The store has no record of the action at the time of the cancel.
  assert.deepEqual(await net.store.all(), []);
  assert.deepEqual(button.canceled, [first.key]);
  assert.deepEqual(queue.entries, []);
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
  assert.deepEqual(Object.keys(record).sort(), [...RECORD_KEYS, 'edits', 'version'].sort());
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
    [request('T-01', { file: new File(['Synthetic text'], 'note.txt') }), 'The queue cannot keep a file.'],
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

test('the queue refuses invalid rich text and a rich text record over the size limit', async () => {
  const net = device();
  const queue = await net.open();
  const safe = note(paragraph(span('A note.')));
  const refusedLink = note(paragraph(link('javascript:ignored')));
  const malformed = { component: 'rich-text', version: '0.1.0' };
  const large = note(...Array.from({ length: 100 }, () => paragraph(span('x'.repeat(2000)))));
  for (const value of [refusedLink, malformed]) {
    assert.deepEqual(await queue.perform(request('T-01', { arguments: { note: value } })),
      { ok: false, message: 'The arguments are not valid.' });
    assert.deepEqual(await queue.perform(request('T-01', { edits: [edit(safe, value)] })),
      { ok: false, message: 'The edits are not valid.' });
    assert.deepEqual(await queue.perform(request('T-01', { edits: [edit(value, safe)] })),
      { ok: false, message: 'The edits are not valid.' });
  }
  assert.deepEqual(await queue.perform(request('T-01', { arguments: { note: large } })),
    { ok: false, message: 'The action is too large for the queue.' });
  assert.deepEqual(net.sent, []);
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
  await assert.rejects(openQueue({ send: async () => ({ ok: true }), principal: 'member-1', store, locks: null, events: null }), /blocked/);
  assert.throws(() => new ActionQueue({ store, principal: 'member-1' }), /send/);
  assert.throws(() => new ActionQueue({ send: async () => null, principal: 'member-1', store: {} }), /store/);
  assert.throws(() => new ActionQueue({ send: async () => null, principal: 'member-1', store, name: 'Not Valid' }), /name/);
  // The application must name the principal. The queue has no default.
  for (const principal of [undefined, '', 7, 'p'.repeat(129)]) {
    assert.throws(() => new ActionQueue({ send: async () => null, store, principal }), /principal/);
  }
  assert.throws(() => indexedDbStore('actions', null), /IndexedDB/);
});

test('a queue takes and sends only the records of its principal', async () => {
  const net = device();
  net.online = false;
  const first = await net.open({ principal: 'member-1' });
  const mine = request('T-01');
  first.perform(mine, element());
  await until(() => first.entries.length === 1, 'the entry');
  assert.equal((await net.store.all())[0].principal, 'member-1');
  first.close();
  // A different person signs in on the same device. The send function now adds the credentials of that person.
  const second = await net.open({ principal: 'member-2' });
  assert.deepEqual(second.entries, []);
  const other = request('T-03');
  const receipt = second.perform(other, element());
  net.go(true);
  assert.equal((await receipt).ok, true);
  await second.flush();
  assert.deepEqual(net.sent.map((item) => item.key), [other.key]);
  // The record of the first person stays in the store, and no queue of a different person sends it.
  assert.deepEqual((await net.store.all()).map((record) => [record.key, record.principal]), [[mine.key, 'member-1']]);
  second.close();
  // The first person signs in again. Then the queue sends the action of that person.
  const again = await net.open({ principal: 'member-1' });
  await until(() => net.sent.length === 2, 'the try of the first person');
  await again.flush();
  assert.deepEqual(net.sent.map((item) => item.key), [other.key, mine.key]);
  assert.deepEqual(await net.store.all(), []);
  again.close();
});

test('a record with no principal, or with a principal that is not valid, is not sent', async () => {
  const net = device();
  net.online = false;
  const before = await net.open();
  const first = request('T-01');
  before.perform(first, element());
  await until(() => before.entries.length === 1, 'the entry');
  before.close();
  const [record] = await net.store.all();
  for (const principal of [undefined, '', 7]) {
    const changed = { ...record, principal };
    if (principal === undefined) delete changed.principal;
    await net.store.put(changed);
    net.online = true;
    const queue = await net.open();
    await queue.flush();
    assert.deepEqual(queue.entries, []);
    assert.equal(net.sent.length, 0);
    queue.close();
  }
});

test('after a cancel of the stalled first action, the queue sends the next action', async () => {
  const net = device({ answer: (value) => {
    if (value.arguments.tool_id === 'T-01') throw new Error('The connection closed.');
    return { ok: true };
  } });
  const queue = await net.open();
  const first = request('T-01');
  const second = request('T-02');
  const stalled = queue.perform(first, element());
  await until(() => queue.entries[0]?.state === 'stalled', 'the stalled state');
  const button = element('Reserve Drill');
  const waiting = queue.perform(second, button);
  await until(() => queue.entries.length === 2 && net.sent.length >= 2, 'the second entry and the second try');
  await queue.flush();
  // The first action stopped the queue again. The second action waits behind it and shows no try in flight.
  assert.deepEqual(queue.entries.map((entry) => [entry.key, entry.state, entry.message]),
    [[first.key, 'stalled', 'No receipt came back.'], [second.key, 'queued', 'Waiting for an earlier action.']]);
  assert.equal(queue.cancel(first.key), true);
  assert.equal(await stalled, null);
  assert.equal((await waiting).ok, true);
  assert.deepEqual(net.sent.at(-1).key, second.key);
  assert.deepEqual(queue.entries, []);
  queue.close();
});

test('the first action shows a try in flight only while a flush runs', async () => {
  const net = device();
  net.online = false;
  const queue = await net.open();
  const first = request('T-01');
  queue.perform(first, element());
  await until(() => queue.entries.length === 1, 'the entry');
  // The device is online again, but the queue got no online event. No try is in flight, so the action still waits.
  net.online = true;
  assert.deepEqual(queue.entries.map((entry) => [entry.state, entry.message]), [['queued', 'Waiting for a connection.']]);
  assert.equal(queue.retry(first.key), true);
  await queue.flush();
  assert.equal(net.sent.length, 1);
  queue.close();
});

// A store with changed methods. Each other method goes to the base store.
const storeWith = (base, over) => ({ all: () => base.all(), put: (record) => base.put(record), remove: (key) => base.remove(key), ...over });

test('a cancel is complete only after the store removed the record, and the queue sends nothing in that time', async () => {
  const base = memoryStore();
  let removal;
  const store = storeWith(base, { remove: (key) => new Promise((done) => { removal = () => done(base.remove(key)); }) });
  const net = device({ store });
  net.online = false;
  const queue = await net.open();
  const buttons = [element(), element('Reserve Drill')];
  const requests = [request('T-01'), request('T-02')];
  const receipts = requests.map((item, index) => queue.perform(item, buttons[index]));
  let first = 'none';
  receipts[0].then((value) => { first = value; });
  await until(() => queue.entries.length === 2, 'two entries');
  assert.equal(queue.cancel(requests[0].key), true);
  // A second cancel of the same action starts nothing.
  assert.equal(queue.cancel(requests[0].key), false);
  net.go(true);
  await queue.flush();
  await sleep(20);
  // The store still has the record. The action is pending, not canceled, and no request left the device.
  assert.equal(first, 'none');
  assert.deepEqual(buttons[0].canceled, []);
  assert.deepEqual(queue.entries.map((entry) => [entry.key, entry.state]), requests.map((item) => [item.key, 'queued']));
  assert.equal(net.sent.length, 0);
  removal();
  assert.equal(await receipts[0], null);
  assert.deepEqual(buttons[0].canceled, [requests[0].key]);
  // After the cancel, the queue continues with the next action.
  assert.equal((await receipts[1]).ok, true);
  assert.deepEqual(net.sent.map((item) => item.key), [requests[1].key]);
  queue.close();
});

test('if the store cannot remove a canceled action, the action stays pending and shows no cancel', async () => {
  const base = memoryStore();
  let broken = true;
  const store = storeWith(base, { remove: async (key) => {
    if (broken) throw new Error('The store is read-only.');
    return base.remove(key);
  } });
  const net = device({ store });
  net.online = false;
  const queue = await net.open();
  const button = element();
  const first = request();
  let receipt = 'none';
  const promise = queue.perform(first, button);
  promise.then((value) => { receipt = value; });
  await until(() => queue.entries.length === 1, 'the entry');
  queue.cancel(first.key);
  await until(() => queue.entries[0].message === 'The device cannot remove the action. Try again.', 'the message');
  // No cancel shows: the store still has the record, so a reload sends the action.
  assert.equal(receipt, 'none');
  assert.deepEqual(button.canceled, []);
  assert.deepEqual(queue.entries.map((entry) => [entry.key, entry.state]), [[first.key, 'queued']]);
  assert.deepEqual(button.holds.at(-1), { key: first.key, wait: 'queued', tries: 0, message: 'The device cannot remove the action. Try again.' });
  assert.deepEqual((await base.all()).map((record) => record.key), [first.key]);
  assert.equal(await queue.clear(), 0);
  assert.equal(queue.entries.length, 1);
  // The store works again. The second cancel removes the record, and then the cancel shows.
  broken = false;
  assert.equal(queue.cancel(first.key), true);
  assert.equal(await promise, null);
  assert.deepEqual(button.canceled, [first.key]);
  assert.deepEqual(await base.all(), []);
  net.go(true);
  await queue.flush();
  assert.equal(net.sent.length, 0);
  queue.close();
});

test('a queue that closes during the store write of a try sends nothing', async () => {
  // Expected: after a sign-out, the send function can have the credentials of a different person. The queue
  // reads its closed state again after the store write, so the request does not leave the device.
  const base = memoryStore();
  let write;
  const waits = [];
  const store = storeWith(base, { put: (record) => (record.state === 'sent'
    ? new Promise((done) => { waits.push(record.key); write = () => done(base.put(record)); }) : base.put(record)) });
  const net = device({ store });
  const queue = await net.open();
  const first = request();
  queue.perform(first, element());
  await until(() => waits.length === 1, 'the store write of the try');
  queue.close();
  write();
  await queue.flush();
  await sleep(20);
  assert.equal(net.sent.length, 0);
  // The record stays for its principal as it was before the try.
  assert.deepEqual((await base.all()).map((record) => [record.key, record.state, record.tries]), [[first.key, 'queued', 0]]);
  const other = await openQueue({ send: net.send, principal: 'member-2', store: base, online: () => true, events: net.events, locks: null });
  await other.flush();
  assert.equal(net.sent.length, 0);
  other.close();
  const again = await openQueue({ send: net.send, principal: 'member-1', store: base, online: () => true, events: net.events, locks: null });
  await until(() => net.sent.length === 1, 'the try of the same person');
  assert.equal(net.sent[0].key, first.key);
  await again.flush();
  again.close();
});

test('the send function gets the principal of the queue', async () => {
  const seen = [];
  const net = device({ answer: (value, context) => {
    seen.push([context.principal, context.signal instanceof AbortSignal]);
    return { ok: true };
  } });
  const queue = await net.open();
  assert.equal((await queue.perform(request(), element())).ok, true);
  assert.deepEqual(seen, [['member-1', true]]);
  queue.close();
});

test('a send function that throws in its call gives no receipt', async () => {
  const net = device();
  const queue = await openQueue({ send: () => { throw new Error('No session.'); }, principal: 'member-1', store: net.store,
    online: () => true, events: net.events, locks: null });
  queue.perform(request(), element());
  await until(() => queue.entries[0]?.state === 'stalled', 'the stalled action');
  assert.equal(queue.entries[0].message, 'No receipt came back.');
  queue.close();
});

test('a stored record that breaks a limit of the contract is not taken', async () => {
  // Expected: the queue view accepts each entry of the queue. A record with a label, a message or a time that the
  // contract of the view refuses stays in the store.
  const net = device();
  net.online = false;
  const before = await net.open();
  const first = request('T-01');
  before.perform(first, element());
  await until(() => before.entries.length === 1, 'the entry');
  before.close();
  const [record] = await net.store.all();
  for (const change of [{ label: '' }, { label: 'x'.repeat(121) }, { message: 'x'.repeat(201) }, { queued: 'yesterday' }, { queued: '2026-11-25' }]) {
    await net.store.put({ ...record, ...change });
    const queue = await net.open();
    assert.deepEqual(queue.entries, [], JSON.stringify(Object.keys(change)));
    queue.close();
  }
  await net.store.put(record);
  const queue = await net.open();
  assert.deepEqual(queue.entries.map((entry) => entry.key), [first.key]);
  queueFill('Pending actions', queue.entries);
  queue.close();
});

test('only valid stored records of a known version are sent', async (t) => {
  const net = device();
  net.online = false;
  const before = await net.open();
  const first = request();
  before.perform(first, element());
  await until(() => before.entries.length === 1, 'the stored action');
  before.close();
  const [record] = await net.store.all();
  const { version, ...legacy } = record;
  const safe = note(paragraph(span('A note.')));
  const refusedLink = note(paragraph(link('javascript:ignored')));
  for (const [name, change] of [
    ['unknown version', { version: 2 }],
    ['invalid tool name', { tool: 'Tool.Reserve' }],
    ['long tool name', { tool: 'x'.repeat(81) }],
    ['large record', { arguments: { note: 'x'.repeat(200000) } }],
    ['extra key', { extra: true }],
    ['invalid arguments', { arguments: { tool: { id: 'T-01' } } }],
    ['unsupported link scheme in an argument', { arguments: { note: refusedLink } }],
    ['unsupported link scheme in an old value', { edits: [edit(refusedLink, safe)] }],
    ['unsupported link scheme in a new value', { edits: [edit(safe, refusedLink)] }],
    ['credential name', { arguments: { token: 'synthetic' } }],
    ['invalid order', { order: NaN }],
    ['invalid principal', { principal: '' }],
  ]) {
    await t.test(name, async () => {
      const invalid = { ...legacy, ...change };
      await net.store.put(invalid);
      const queue = await net.open({ online: () => true });
      await queue.flush();
      assert.deepEqual(net.sent.splice(0), []);
      assert.deepEqual(await net.store.all(), [invalid]);
      queue.close();
    });
  }
  assert.equal(version, 1);
  await net.store.put(legacy);
  const after = await net.open({ online: () => true });
  await after.flush();
  assert.deepEqual(net.sent.map((sent) => sent.key), [first.key]);
  assert.deepEqual(await net.store.all(), []);
  after.close();
});

test('the queue takes 100 stored actions at the maximum, the oldest first', async () => {
  const net = device();
  net.online = false;
  const before = await net.open();
  before.perform(request('T-01'), element());
  await until(() => before.entries.length === 1, 'the entry');
  before.close();
  const [record] = await net.store.all();
  await net.store.remove(record.key);
  // The store gives the newest record first.
  for (let order = 105; order >= 1; order -= 1) await net.store.put({ ...record, key: 'key-' + order, order, owner: 'gone' });
  const queue = await net.open();
  assert.equal(queue.entries.length, 100);
  assert.deepEqual([queue.entries[0].key, queue.entries[99].key], ['key-1', 'key-100']);
  assert.equal((await queue.perform(request('T-02'), element())).message, 'The device holds 100 pending actions. Wait until the device sends them.');
  // The other records stay in the store. The queue takes them when it has room.
  net.go(true);
  await until(() => net.sent.length === 105, 'each stored action');
  assert.deepEqual(net.sent.map((item) => item.key), Array.from({ length: 105 }, (unused, index) => 'key-' + (index + 1)));
  queue.close();
});

test('a rejection for an element that is not in the page stays in the queue until a person dismisses it', async () => {
  const net = device({ answer: () => ({ ok: false, message: 'The tool T-02 is already reserved.' }) });
  net.online = false;
  const queue = await net.open();
  const button = { ...element('Reserve Drill'), isConnected: true };
  const first = request('T-02');
  const promise = queue.perform(first, button);
  await until(() => queue.entries.length === 1, 'the entry');
  // The page removed the element while the action waited.
  button.isConnected = false;
  net.go(true);
  assert.equal((await promise).ok, false);
  await until(() => queue.entries[0]?.state === 'rejected', 'the rejection');
  assert.deepEqual(queue.entries.map((entry) => [entry.key, entry.state, entry.message]), [[first.key, 'rejected', 'The tool T-02 is already reserved.']]);
  assert.equal(queue.dismiss(first.key), true);
  assert.deepEqual(queue.entries, []);
  queue.close();
});

test('a rejection of an action that perform got with no element stays in the queue', async () => {
  // Expected: no element shows the rejection, so the queue view keeps it until a person dismisses it.
  const net = device({ answer: () => ({ ok: false, message: 'The tool T-02 is already reserved.' }) });
  const queue = await net.open();
  const first = request('T-02');
  const receipt = await queue.perform(first);
  assert.deepEqual([receipt.ok, receipt.message], [false, 'The tool T-02 is already reserved.']);
  await until(() => queue.entries[0]?.state === 'rejected', 'the rejection');
  assert.deepEqual(queue.entries.map((entry) => [entry.key, entry.state, entry.message]), [[first.key, 'rejected', 'The tool T-02 is already reserved.']]);
  assert.deepEqual((await net.store.all()).map((record) => [record.key, record.state]), [[first.key, 'rejected']]);
  // A receipt with ok: true needs no element. The action leaves the queue.
  const done = device();
  const other = await done.open();
  assert.equal((await other.perform(request('T-01'))).ok, true);
  assert.deepEqual(other.entries, []);
  assert.equal(queue.dismiss(first.key), true);
  queue.close();
  other.close();
});

test('clear removes each action with no try in flight, for a sign-out', async () => {
  let release;
  const net = device({ answer: () => new Promise((done) => { release = () => done({ ok: true }); }) });
  const queue = await net.open();
  const buttons = [element(), element('Reserve Drill'), element('Reserve Garden fork')];
  const requests = [request('T-01'), request('T-02'), request('T-03')];
  const receipts = requests.map((item, index) => queue.perform(item, buttons[index]));
  await until(() => queue.entries.length === 3 && net.sent.length === 1, 'three entries and the first try');
  // The fourth action is in the middle of perform. clear removes it too.
  const late = request('T-04');
  const last = queue.perform(late, element('Reserve Hand saw'));
  assert.equal(await queue.clear(), 3);
  assert.equal(await last, null);
  assert.deepEqual((await net.store.all()).map((record) => record.key), [requests[0].key]);
  assert.deepEqual(queue.entries.map((entry) => [entry.key, entry.state]), [[requests[0].key, 'sent']]);
  assert.deepEqual([await receipts[1], await receipts[2]], [null, null]);
  assert.deepEqual([buttons[1].canceled, buttons[2].canceled], [[requests[1].key], [requests[2].key]]);
  release();
  assert.equal((await receipts[0]).ok, true);
  await queue.flush();
  assert.equal(net.sent.length, 1);
  await until(async () => (await net.store.all()).length === 0, 'the empty store');
  queue.close();
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
  // The queue has the action, so the element does not cancel by itself. The queue cancels it after the store
  // removed the record.
  assert.equal(cancel(first.key), false);
  assert.equal(await waiting, null);
  assert.deepEqual(await net.store.all(), []);
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
  await until(() => queue.entries.length === 1, 'the cancel');
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
