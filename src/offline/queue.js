// The offline queue of pending actions. docs/contracts/offline-queue.md is the contract.
// The queue keeps each action on the device and sends the actions in order, one at a time. Each try of an action
// has the same key and a new id. The application gives the send function, and it adds its credentials there.
// The queue keeps no header, no cookie and no credential. It never shows an action as done: only a receipt does.
const TOOL = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;
const ID = /^[A-Za-z0-9._:-]{1,128}$/;
const NAME = /^[a-z0-9_-]{1,64}$/;
// An argument name that looks like a credential. This is a guard, not a proof.
const CREDENTIAL = /token|secret|passw|passphrase|authorization|cookie|credential|bearer|api_?key|access_?key|private_?key/i;
const STATES = ['queued', 'sent', 'stalled', 'rejected'];
const MAX_ACTIONS = 100;
const MAX_RECORD = 200000;
const MAX_LABEL = 120;
const MAX_MESSAGE = 200;
const MAX_REFERENCE = 80;
const TIMEOUT = 10000;
const REJECTED = 'The service rejected the action.';
const FULL = 'The device holds 100 pending actions. Wait until the device sends them.';
const NOT_KEPT = 'The device cannot keep the action.';
const CLOSED = 'The queue is closed.';
const NO_CONNECTION = 'Waiting for a connection.';
const EARLIER = 'Waiting for an earlier action.';
const NO_RECEIPT = 'No receipt came back.';

const isPlain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const isScalar = (value) => typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
const isCount = (value) => Number.isInteger(value) && value >= 0;
const refusal = (message) => Object.freeze({ ok: false, message });

// A deep copy of the typed edits of a request, or null. An edit has only scalar values and one actor object.
function editsOf(edits) {
  if (!Array.isArray(edits) || edits.length > 400) return null;
  const copy = [];
  for (const edit of edits) {
    if (!isPlain(edit)) return null;
    const item = {};
    for (const [name, value] of Object.entries(edit)) {
      if (isScalar(value)) item[name] = value;
      else if (isPlain(value) && Object.values(value).every(isScalar)) item[name] = { ...value };
      else return null;
    }
    copy.push(item);
  }
  return copy;
}

// Makes the record of a request. The result is { record } or { error }. The record has only the keys of the
// contract, so nothing else of the request goes into the store.
function recordOf(request, label, owner, order, queued) {
  if (!isPlain(request)) return { error: 'The request is not valid.' };
  const { id, key, tool, arguments: args = {} } = request;
  if (typeof id !== 'string' || !ID.test(id)) return { error: 'The request has no valid id.' };
  if (typeof key !== 'string' || !ID.test(key)) return { error: 'The request has no valid key.' };
  if (typeof tool !== 'string' || tool.length > 80 || !TOOL.test(tool)) return { error: 'The tool name is not valid.' };
  if (!isPlain(args) || !Object.values(args).every(isScalar)) return { error: 'The arguments are not valid.' };
  const secret = Object.keys(args).find((name) => CREDENTIAL.test(name));
  if (secret !== undefined) return { error: `The queue does not keep the argument ${secret.slice(0, 40)}. Its name looks like a credential.` };
  const record = { key, owner, order, tool, arguments: { ...args }, label: (typeof label === 'string' && label ? label : tool).slice(0, MAX_LABEL),
    queued, tries: 0, state: 'queued', message: '' };
  if (request.edits !== undefined) {
    record.edits = editsOf(request.edits);
    if (!record.edits) return { error: 'The edits are not valid.' };
  }
  if (JSON.stringify(record).length > MAX_RECORD) return { error: 'The action is too large for the queue.' };
  return { record };
}

// Returns true if a record of the store has the form of the contract. The queue does not send other records.
function isRecord(record) {
  return isPlain(record) && typeof record.key === 'string' && ID.test(record.key) && typeof record.owner === 'string'
    && typeof record.order === 'number' && typeof record.tool === 'string' && TOOL.test(record.tool)
    && isPlain(record.arguments) && Object.values(record.arguments).every(isScalar)
    && !Object.keys(record.arguments).some((name) => CREDENTIAL.test(name))
    && (record.edits === undefined || editsOf(record.edits) !== null)
    && typeof record.label === 'string' && typeof record.queued === 'string' && isCount(record.tries)
    && STATES.includes(record.state) && typeof record.message === 'string';
}

// The frozen receipt of a try, or null if the value is not a valid receipt of this request.
function receiptOf(value, request) {
  if (!isPlain(value) || typeof value.ok !== 'boolean') return null;
  if (value.id !== undefined && value.id !== request.id) return null;
  if (value.key !== undefined && value.key !== request.key) return null;
  const message = value.message ?? '';
  const reference = value.reference ?? '';
  if (typeof message !== 'string' || message.length > MAX_MESSAGE) return null;
  if (typeof reference !== 'string' || reference.length > MAX_REFERENCE) return null;
  return Object.freeze({ id: request.id, key: request.key, ok: value.ok, message, reference });
}

// A store that keeps the records in memory only. A reload loses them.
export function memoryStore() {
  const records = new Map();
  return {
    all: async () => [...records.values()].map((record) => structuredClone(record)),
    put: async (record) => { records.set(record.key, structuredClone(record)); },
    remove: async (key) => { records.delete(key); },
  };
}

// A store that keeps the records in IndexedDB, so they stay after a reload. The name is the name of the queue.
export function indexedDbStore(name = 'actions', factory = globalThis.indexedDB) {
  if (typeof name !== 'string' || !NAME.test(name)) throw new TypeError('name: 1 to 64 characters of a-z, 0-9, - and _');
  if (!factory) throw new TypeError('store: this device has no IndexedDB. Give a store.');
  let opened = null;
  const database = () => {
    opened ??= new Promise((done, fail) => {
      const request = factory.open('mugham-queue:' + name, 1);
      request.addEventListener('upgradeneeded', () => request.result.createObjectStore('actions', { keyPath: 'key' }));
      request.addEventListener('success', () => done(request.result));
      request.addEventListener('error', () => fail(request.error));
    }).catch((error) => {
      opened = null;
      throw error;
    });
    return opened;
  };
  const run = async (mode, work) => {
    const db = await database();
    return new Promise((done, fail) => {
      const transaction = db.transaction('actions', mode);
      const request = work(transaction.objectStore('actions'));
      transaction.addEventListener('complete', () => done(request.result));
      transaction.addEventListener('error', () => fail(transaction.error));
      transaction.addEventListener('abort', () => fail(transaction.error));
    });
  };
  return {
    all: () => run('readonly', (store) => store.getAll()),
    put: async (record) => { await run('readwrite', (store) => store.put(record)); },
    remove: async (key) => { await run('readwrite', (store) => store.delete(key)); },
  };
}

export class ActionQueue {
  #send;
  #store;
  #name;
  #timeout;
  #online;
  #events;
  #locks;
  #now;
  #owner = crypto.randomUUID();
  // The records of this owner, in order. Each record is also in the store.
  #list = [];
  // The page parts that wait for a receipt: key -> { element, promise, resolve }.
  #waiters = new Map();
  // The keys of the records that this queue removed. The queue never takes them from the store again.
  #gone = new Set();
  #watchers = new Set();
  #adds = Promise.resolve();
  #running = null;
  #again = false;
  #order = 0;
  #loaded = null;
  #closed = false;
  #release = null;
  #reconnect = () => { this.flush(); };
  #disconnect = () => { this.#changed(); };

  constructor({ send, name = 'actions', store, timeout = TIMEOUT, online, events, locks, now } = {}) {
    if (typeof send !== 'function') throw new TypeError('send: a function is necessary');
    if (typeof name !== 'string' || !NAME.test(name)) throw new TypeError('name: 1 to 64 characters of a-z, 0-9, - and _');
    if (!(Number.isFinite(timeout) && timeout > 0)) throw new TypeError('timeout: a number of milliseconds above 0');
    this.#send = send;
    this.#name = name;
    this.#store = store ?? indexedDbStore(name);
    for (const method of ['all', 'put', 'remove']) {
      if (typeof this.#store?.[method] !== 'function') throw new TypeError(`store: the method ${method} is necessary`);
    }
    this.#timeout = timeout;
    this.#online = online ?? (() => globalThis.navigator?.onLine !== false);
    this.#events = events === undefined ? (typeof globalThis.addEventListener === 'function' ? globalThis : null) : events;
    this.#locks = locks === undefined ? (globalThis.navigator?.locks ?? null) : locks;
    this.#now = now ?? Date.now;
  }

  // Reads the store, takes the records with no live owner and starts the first flush. openQueue calls it.
  load() {
    this.#loaded ??= (async () => {
      await this.#own();
      try {
        await this.#adopt();
      } catch (error) {
        this.close();
        throw error;
      }
      this.#events?.addEventListener('online', this.#reconnect);
      this.#events?.addEventListener('offline', this.#disconnect);
      this.#changed();
      this.flush();
    })();
    return this.#loaded;
  }

  // The actions of the queue, in order. No state of the queue is done.
  get entries() {
    return Object.freeze(this.#list.map((record) => Object.freeze({ key: record.key, tool: record.tool, label: record.label,
      arguments: Object.freeze({ ...record.arguments }), queued: record.queued, tries: record.tries, ...this.#shown(record) })));
  }

  // Calls the listener with the entries after each change. A receipt gives { key, receipt } as the second argument.
  watch(listener) {
    this.#watchers.add(listener);
    return () => this.#watchers.delete(listener);
  }

  // Adds a request to the queue and returns a promise of its receipt. A cancel gives null. The element, if given,
  // gets the detail of the pending state through hold(). A second request with the same key is a retry of a
  // person: it gives the same promise, and the queue sends the action again.
  perform(request, element = null) {
    const key = isPlain(request) ? request.key : undefined;
    const waiting = this.#waiters.get(key);
    if (waiting) {
      this.flush();
      return waiting.promise;
    }
    if (this.#closed) return Promise.resolve(refusal(CLOSED));
    const waiter = { element };
    waiter.promise = new Promise((resolve) => { waiter.resolve = resolve; });
    const add = this.#adds.then(async () => {
      if (this.#find(key)) return 'The queue has an action with this key.';
      if (this.#list.length >= MAX_ACTIONS) return FULL;
      this.#order = Math.max(this.#order + 1, this.#now());
      const label = element?.action?.label || element?.action?.title || '';
      const { record, error } = recordOf(request, label, this.#owner, this.#order, new Date(this.#now()).toISOString());
      if (error) return error;
      try {
        await this.#store.put({ ...record });
      } catch {
        return NOT_KEPT;
      }
      this.#list.push(record);
      return '';
    });
    this.#adds = add.catch(() => {});
    // The waiter is in the map before the record is in the store, so a retry or a cancel in that time finds it.
    if (typeof key === 'string') this.#waiters.set(key, waiter);
    const added = (error) => {
      if (error) {
        this.#waiters.delete(key);
        waiter.resolve(refusal(error));
        return;
      }
      this.flush();
      this.#changed();
    };
    add.then(added, () => added(NOT_KEPT));
    return waiter.promise;
  }

  // Sends the queue now. One flush runs at a time. A flush that starts during a flush runs one more pass after it.
  flush() {
    this.#again = true;
    this.#running ??= (async () => {
      try {
        while (this.#again && !this.#closed) {
          this.#again = false;
          await this.#pass();
        }
      } finally {
        this.#running = null;
      }
    })();
    return this.#running;
  }

  // Sends the queue again after a try with no receipt. The key of each action stays the same. Returns false if the
  // action does not wait.
  retry(key) {
    const state = this.#find(key)?.state;
    if (state !== 'stalled' && state !== 'queued') return false;
    this.flush();
    return true;
  }

  // Removes an action that waits for a connection or that got no receipt. Returns false for each other action,
  // also for an action with a try in flight.
  cancel(key) {
    const record = this.#find(key);
    // The queue cancels only an action that shows a cancel: not a try in flight, and not the action that it sends next.
    const shown = record ? this.#shown(record).state : '';
    if (shown !== 'queued' && shown !== 'stalled') return false;
    this.#drop(record);
    const waiter = this.#waiters.get(key);
    this.#waiters.delete(key);
    waiter?.element?.cancel?.(key);
    waiter?.resolve(null);
    this.#changed();
    return true;
  }

  // Removes a rejected action after a person read the rejection.
  dismiss(key) {
    const record = this.#find(key);
    if (record?.state !== 'rejected') return false;
    this.#drop(record);
    this.#changed();
    return true;
  }

  // Connects the cancel events of the action elements and the steps of mu-action-queue below root to the queue.
  // Returns a function that removes the listeners.
  listen(root) {
    const cancel = (event) => {
      const key = event.detail?.key;
      // If the queue has the action and cannot cancel it now, the element must not cancel it.
      if ((this.#waiters.has(key) || this.#find(key)) && !this.cancel(key)) event.preventDefault();
    };
    const step = (event) => {
      const { key, step: name } = event.detail ?? {};
      if (name === 'retry') this.retry(key);
      else if (name === 'cancel') this.cancel(key);
      else if (name === 'dismiss') this.dismiss(key);
    };
    root.addEventListener('mu-action-cancel', cancel);
    root.addEventListener('mu-queue-step', step);
    return () => {
      root.removeEventListener('mu-action-cancel', cancel);
      root.removeEventListener('mu-queue-step', step);
    };
  }

  // Stops the queue. The records stay in the store, and a later queue takes them.
  close() {
    this.#closed = true;
    this.#events?.removeEventListener('online', this.#reconnect);
    this.#events?.removeEventListener('offline', this.#disconnect);
    this.#release?.();
    this.#release = null;
  }

  #find(key) {
    return this.#list.find((record) => record.key === key);
  }

  #drop(record) {
    this.#list = this.#list.filter((item) => item !== record);
    this.#gone.add(record.key);
    this.#store.remove(record.key).catch(() => {});
  }

  // The state and the message that the page shows for a record. Offline, an action waits for a connection. Online,
  // the queue sends the first action next, and each other action waits for the action before it.
  #shown(record) {
    if (record.state === 'rejected') return { state: 'rejected', message: record.message };
    if (record.state === 'sent') return { state: 'sent', message: '' };
    if (!this.#online()) return { state: 'queued', message: NO_CONNECTION };
    if (record.state === 'stalled') return { state: 'stalled', message: NO_RECEIPT };
    const first = this.#list.find((item) => item.state !== 'rejected') === record;
    return first ? { state: 'sent', message: '' } : { state: 'queued', message: EARLIER };
  }

  // A failed write does not stop the queue. The key of the action protects against a second send after a reload.
  async #keep(record) {
    try {
      await this.#store.put({ ...record });
    } catch {
      // The record stays in memory.
    }
  }

  // Gives the detail of each pending action to its element, then calls the listeners.
  #changed(change) {
    for (const record of this.#list) {
      const element = this.#waiters.get(record.key)?.element;
      if (typeof element?.hold !== 'function' || record.state === 'rejected') continue;
      const { state, message } = this.#shown(record);
      try {
        element.hold({ key: record.key, wait: state, tries: record.tries, message });
      } catch {
        // An element of the application cannot stop the queue.
      }
    }
    const entries = this.entries;
    for (const listener of this.#watchers) {
      try {
        listener(entries, change);
      } catch {
        // A listener of the application cannot stop the queue.
      }
    }
  }

  // Holds a lock with the owner id while the page is open. A different queue reads it to know that this owner is live.
  #own() {
    if (!this.#locks) return Promise.resolve();
    return new Promise((ready) => {
      this.#locks.request(`mugham-queue:${this.#name}:${this.#owner}`, () => {
        ready();
        return new Promise((release) => { this.#release = release; });
      }).catch(() => {
        // With no lock, a different queue cannot know that this owner is live. Then the queue uses no locks.
        this.#locks = null;
        ready();
      });
    });
  }

  // Takes each record of the store whose owner holds no lock, for example after a reload. With no Web Locks API,
  // the queue takes each record. The lock of the queue name lets only one queue take records at a time.
  async #adopt() {
    const take = async () => {
      const held = this.#locks ? new Set(((await this.#locks.query()).held ?? []).map((lock) => lock.name)) : null;
      for (const record of await this.#store.all()) {
        if (!isRecord(record) || this.#find(record.key) || this.#gone.has(record.key)) continue;
        // A record of this owner that is not in the list is in the middle of perform. perform adds it to the list.
        if (record.owner === this.#owner || held?.has(`mugham-queue:${this.#name}:${record.owner}`)) continue;
        // A try that was in flight has no receipt now. The record waits, and the next try has the same key.
        const mine = { ...record, owner: this.#owner, state: record.state === 'rejected' ? 'rejected' : 'queued' };
        if (mine.state === 'queued') mine.message = '';
        await this.#store.put({ ...mine });
        this.#list.push(mine);
      }
      this.#list.sort((a, b) => a.order - b.order || (a.queued < b.queued ? -1 : a.queued > b.queued ? 1 : 0));
      this.#order = Math.max(this.#order, ...this.#list.map((record) => record.order));
    };
    if (this.#locks) await this.#locks.request(`mugham-queue:${this.#name}`, take);
    else await take();
  }

  // One pass: sends each action in order until the queue is empty, the device is offline or a try gets no receipt.
  async #pass() {
    try {
      await this.#adopt();
    } catch {
      // The store cannot give its records now. The pass sends the records in memory.
    }
    while (!this.#closed && this.#online()) {
      const record = this.#list.find((item) => item.state !== 'rejected');
      if (!record) return;
      record.tries += 1;
      record.state = 'sent';
      record.message = '';
      this.#changed();
      // The store knows about the try before the request leaves the device.
      await this.#keep(record);
      const request = Object.freeze({ id: crypto.randomUUID(), key: record.key, tool: record.tool,
        arguments: Object.freeze({ ...record.arguments }), ...(record.edits ? { edits: Object.freeze(editsOf(record.edits)) } : {}) });
      const receipt = await this.#try(request);
      if (!receipt) {
        record.state = this.#online() ? 'stalled' : 'queued';
        await this.#keep(record);
        this.#changed();
        return;
      }
      const waiter = this.#waiters.get(record.key);
      if (receipt.ok || waiter) {
        this.#drop(record);
        this.#waiters.delete(record.key);
        waiter?.resolve(receipt);
      } else {
        // The page has no element for this action. The rejection stays until a person dismisses it.
        record.state = 'rejected';
        record.message = receipt.message || REJECTED;
        await this.#keep(record);
      }
      this.#changed({ key: record.key, receipt });
    }
  }

  // One try. The result is a receipt, or null if no valid receipt came back in the time limit.
  async #try(request) {
    const control = new AbortController();
    let timer;
    try {
      const answer = Promise.resolve().then(() => this.#send(request, { signal: control.signal }));
      const late = {};
      const clock = new Promise((done) => { timer = setTimeout(() => done(late), this.#timeout); });
      const value = await Promise.race([answer, clock]);
      if (value !== late) return receiptOf(value, request);
      control.abort();
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

// Opens a queue: reads the store and starts the first flush. If the store cannot give its records, the promise rejects.
export async function openQueue(options) {
  const queue = new ActionQueue(options);
  await queue.load();
  return queue;
}

// A fill of the action-queue component from the entries of a queue.
export function queueFill(label, entries) {
  return { component: 'action-queue', version: '0.1.0', data: { label, actions: entries.map((entry) => ({
    component: 'queued-action', version: '0.1.0',
    data: { key: entry.key, label: entry.label, state: entry.state, tries: entry.tries, queued: entry.queued,
      ...(entry.message ? { message: entry.message } : {}) } })) } };
}
